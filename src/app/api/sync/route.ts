import { NextRequest, NextResponse } from 'next/server';
import { configMissingResponse, getPass, isAuth } from '@/lib/auth';
import {
  LOCAL_USER_ID,
  dbConfigOk,
  dbFetch,
  dbUpsertOwned,
  resolveStorageUrl,
} from '@/lib/supabase-admin';
import { syncPostSchema } from '@/lib/sync-schema';
import { SYNC_PAGE_LIMIT, NOTE_DESCRIPTION_MAX_LENGTH } from '@/lib/constants/config';
import type {
  ResourceRow,
  CollectionRow,
  CollectionResourceRow,
  MusicTrack,
  PatternNoteRow,
} from '@/lib/types';

// Music playlist resource ID — deterministic UUID v5 derived from LOCAL_USER_ID
// Pre-computed: crypto.createHash('md5').update('garden-music-' + LOCAL_USER_ID).digest('hex') → UUID
const MUSIC_PLAYLIST_ID = '254e932e-ac70-4320-8944-92107bcc4eb1';

// Valid resource_type enum values in the Supabase schema
const VALID_TYPES = new Set(['article', 'book', 'link', 'image', 'tool']);

function mapResourceType(type: string): string | null {
  if (VALID_TYPES.has(type)) return type;
  return null; // store in metadata instead
}

// ---------------------------------------------------------------------------
// Data-source dispatch: when VPS_DB_URL is set, route all DB calls through the
// VPS PostgREST instance; otherwise fall back to the existing Supabase logic.
// ---------------------------------------------------------------------------

// GET: Pull all cloud data for the user (uses service key, bypasses RLS)
export async function GET(req: NextRequest) {
  if (!getPass()) return configMissingResponse();
  if (!(await isAuth(req))) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  if (!dbConfigOk()) {
    return NextResponse.json({ error: '服务端配置缺失' }, { status: 500 });
  }

  try {
    // Parallelize all DB queries (VPS PostgREST or Supabase REST).
    // All `resources`/`collections` queries are scoped to LOCAL_USER_ID as
    // app-layer RLS defense-in-depth (the service key bypasses DB-level RLS).
    // `pattern_notes` has no user_id column, so it is fetched separately after
    // we know the user's pattern IDs (see below) — fetching it unscoped here
    // would leak other users' associations because the service key bypasses
    // the RLS policy that normally filters via the `resources` owner.
    const [musicRes, notesRes, resRes, filesRes, colRes, patternRes] = await Promise.all([
      dbFetch(`resources?id=eq.${MUSIC_PLAYLIST_ID}&user_id=eq.${LOCAL_USER_ID}&select=metadata`),
      dbFetch(`resources?select=*&user_id=eq.${LOCAL_USER_ID}&resource_type=eq.article&metadata->>is_note=eq.true&order=created_at.desc&limit=${SYNC_PAGE_LIMIT}`),
      dbFetch(`resources?select=*&user_id=eq.${LOCAL_USER_ID}&or=(metadata->>is_note.is.null,metadata->>is_note.eq.false)&order=updated_at.desc&limit=${SYNC_PAGE_LIMIT}`),
      dbFetch(`resources?select=*&user_id=eq.${LOCAL_USER_ID}&metadata->>is_file=eq.true&order=updated_at.desc&limit=${SYNC_PAGE_LIMIT}`),
      dbFetch(`collections?select=*&user_id=eq.${LOCAL_USER_ID}&order=updated_at.desc`),
      dbFetch(`resources?select=*&user_id=eq.${LOCAL_USER_ID}&metadata->>is_pattern=eq.true&order=updated_at.desc&limit=${SYNC_PAGE_LIMIT}`),
    ]);

    let musicPlaylist: MusicTrack[] = [];
    if (musicRes.ok) {
      const musicData = musicRes.body as Pick<ResourceRow, 'metadata'>[] | undefined;
      if (musicData?.[0]?.metadata?.tracks) {
        // Rewrite each track's `url` from its `storagePath` at runtime so the
        // client always receives a URL pointing at the currently active storage
        // backend (VPS or Supabase). A stored absolute `url` is kept as a cache
        // but only trusted when no `storagePath` is present.
        musicPlaylist = musicData[0].metadata.tracks.map((t: MusicTrack) => {
          if (!t) return t;
          const resolved = t.storagePath ? resolveStorageUrl(t.storagePath) : t.url;
          return resolved ? { ...t, url: resolved } : t;
        });
      }
    }

    const notes = notesRes.ok ? ((notesRes.body as ResourceRow[]) || []) : [];
    const resources = resRes.ok ? ((resRes.body as ResourceRow[]) || []) : [];
    const cloudFiles = filesRes.ok ? ((filesRes.body as ResourceRow[]) || []) : [];
    const collections = colRes.ok ? ((colRes.body as CollectionRow[]) || []) : [];
    const patterns = patternRes.ok ? ((patternRes.body as ResourceRow[]) || []) : [];

    // Fetch pattern_notes scoped to the current user's patterns. The
    // `pattern_notes` junction has no user_id column, so we filter by
    // `pattern_id IN (user's pattern ids)` — mirroring how
    // `collection_resources` is scoped by the user's collection ids below.
    // This is the app-layer RLS defense-in-depth: even though the service key
    // bypasses DB-level RLS, this guarantees no cross-user association rows
    // are returned. When the user has no patterns we skip the call entirely
    // (an empty `in.()` filter would be a syntax error in PostgREST).
    let patternNotes: PatternNoteRow[] = [];
    if (patterns.length > 0) {
      const patternIds = patterns.map((p: ResourceRow) => p.id);
      const pnRes = await dbFetch(
        `pattern_notes?select=*&pattern_id=in.(${patternIds.join(',')})`,
      );
      if (pnRes.ok) patternNotes = (pnRes.body as PatternNoteRow[]) || [];
    }

    // Pull collection_resources junctions
    let junctions: CollectionResourceRow[] = [];
    if (collections.length > 0) {
      const colIds = collections.map((c: CollectionRow) => c.id);
      const juncRes = await dbFetch(
        `collection_resources?select=collection_id,resource_id&collection_id=in.(${colIds.join(',')})`,
      );
      if (juncRes.ok) junctions = (juncRes.body as CollectionResourceRow[]) || [];
    }

    // Map resource IDs to collections
    const resourceMap: Record<string, string[]> = {};
    for (const j of junctions) {
      if (!resourceMap[j.collection_id]) resourceMap[j.collection_id] = [];
      resourceMap[j.collection_id].push(j.resource_id);
    }

    const response = NextResponse.json({
      musicPlaylist: musicPlaylist || [],
      notes: (notes || []).map((r: ResourceRow) => ({
        id: r.id,
        title: r.title,
        content: r.metadata?.content || '',
        type: r.metadata?.type || 'article',
        tags: r.metadata?.tags || [],
        collectionId: r.metadata?.collectionId || undefined,
        collectionName: r.metadata?.collectionName || undefined,
        createdAt: r.created_at,
        image: r.metadata?.image || undefined,
        imageThumb: r.metadata?.imageThumb || undefined,
      })),
      resources: (resources || []).map((r: ResourceRow) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        resource_type: r.metadata?.actual_resource_type || r.resource_type,
        url: r.url,
        cover_image_url: r.cover_image_url,
        author: r.author,
        rating: r.rating,
        status: r.status,
        category_id: r.category_id,
        resource_tags: (r.metadata?.tags || []).map((name: string) => ({ tag: { name } })),
        metadata: r.metadata || {},
        pinned: r.pinned,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
      files: (cloudFiles || []).map((r: ResourceRow) => {
        const storagePath = r.metadata?.storagePath || '';
        return {
          id: r.id,
          name: r.title || '',
          size: r.metadata?.fileSize || '0 B',
          sizeBytes: r.metadata?.fileSizeBytes || 0,
          type: r.metadata?.fileType || '',
          category: r.metadata?.fileCategory || '',
          createdAt: r.created_at,
          storagePath,
          // Resolve at runtime so the client gets a URL for the active backend.
          url: resolveStorageUrl(storagePath) || undefined,
        };
      }),
      collections: (collections || []).map((c: CollectionRow) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        coverImage: c.cover_image_url || '',
        resourceIds: resourceMap[c.id] || [],
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
      patterns: (patterns || []).map((r: ResourceRow) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        status: r.status,
        category_id: r.category_id,
        metadata: r.metadata || {},
        pinned: r.pinned,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
      patternNotes: (patternNotes || []).map((pn: PatternNoteRow) => ({
        id: `${pn.pattern_id}_${pn.note_id}`,
        pattern_id: pn.pattern_id,
        note_id: pn.note_id,
        created_at: pn.created_at,
      })),
    });
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return response;
  } catch (e: any) {
    console.error('Sync GET error:', e?.message || e);
    return NextResponse.json({ error: e.message || '获取数据失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!getPass()) return configMissingResponse();
  if (!(await isAuth(req))) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  if (!dbConfigOk()) {
    return NextResponse.json({ error: '服务端配置缺失' }, { status: 500 });
  }

  let payload;
  try {
    const raw = await req.json();
    const parsed = syncPostSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '入参校验失败', detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') },
        { status: 400 },
      );
    }
    payload = parsed.data;
  } catch (e: any) {
    return NextResponse.json({ error: '请求体解析失败', detail: e.message }, { status: 400 });
  }

  try {
    const { table, action, data } = payload;

    if (action === 'upsert') {
      if (table === 'resources') {
        const resource = data;
        const supabaseType = resource.resource_type ? mapResourceType(resource.resource_type) : null;
        const supabaseData = {
          id: resource.id,
          title: resource.title || '',
          description: resource.description || null,
          resource_type: supabaseType,
          user_id: LOCAL_USER_ID,
          category_id: resource.category_id || null,
          status: resource.status || 'active',
          url: resource.url || null,
          cover_image_url: resource.cover_image_url || null,
          author: resource.author || null,
          rating: resource.rating || null,
          pinned: resource.pinned || false,
          metadata: {
            ...(resource.metadata || {}),
            actual_resource_type: !supabaseType && resource.resource_type ? resource.resource_type : undefined,
            collection_name: resource.metadata?.collectionName || undefined,
            tags: resource.resource_tags?.map((rt: { tag?: { name?: string } | string }) =>
              typeof rt.tag === 'string' ? rt.tag : rt.tag?.name) || [],
          },
          created_at: resource.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { ok, error } = await dbUpsertOwned('resources', supabaseData);
        if (!ok) return NextResponse.json({ error: '同步资源失败', detail: error }, { status: 500 });
      } else if (table === 'music_playlist') {
        // Store playlist as a resource row — use deterministic UUID derived from user_id
        const playlistId = MUSIC_PLAYLIST_ID;
        const supabaseData = {
          id: playlistId,
          title: '__music_playlist__',
          description: null,
          resource_type: 'article',
          user_id: LOCAL_USER_ID,
          status: 'active',
          metadata: { tracks: data.tracks || [], updated_at: new Date().toISOString() },
          created_at: data.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { ok: ok2, error: err2 } = await dbUpsertOwned('resources', supabaseData);
        if (!ok2) return NextResponse.json({ error: '同步播放列表失败', detail: err2 }, { status: 500 });
      } else if (table === 'notes') {
        // Store note as a resource row with resource_type='article'
        // Note-specific fields (content, image, tags, collectionId) go into metadata
        const note = data;
        const supabaseData = {
          id: note.id,
          title: note.title || '',
          description: note.content ? note.content.substring(0, NOTE_DESCRIPTION_MAX_LENGTH) : null,
          resource_type: 'article',
          user_id: LOCAL_USER_ID,
          status: 'active',
          metadata: {
            is_note: true,
            content: note.content || '',
            image: note.image || null,
            imageThumb: note.imageThumb || null,
            tags: Array.isArray(note.tags) ? note.tags : [],
            collectionId: note.collectionId || null,
            collectionName: note.collectionName || null,
            type: note.type || 'article',
          },
          created_at: note.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { ok: noteOk, error: noteErr } = await dbUpsertOwned('resources', supabaseData);
        if (!noteOk) return NextResponse.json({ error: '同步笔记失败', detail: noteErr, debug_data_keys: Object.keys(supabaseData) }, { status: 500 });
      } else if (table === 'collections') {
        const col = data;
        const supabaseData = {
          id: col.id,
          title: col.title,
          description: col.description || '',
          user_id: LOCAL_USER_ID,
          cover_image_url: col.coverImage || '',
          is_public: col.isPublic || false,
          sort_order: col.sort_order || 0,
          created_at: col.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        // Upsert collection
        const { ok: ok3, error: err3 } = await dbUpsertOwned('collections', supabaseData);
        if (!ok3) return NextResponse.json({ error: '同步合集失败', detail: err3 }, { status: 500 });
        // Sync resource associations via junction table
        const resourceIds: string[] = col.resourceIds || [];
        // Delete old associations
        await dbFetch(`collection_resources?collection_id=eq.${col.id}`, { method: 'DELETE' });
        // Insert new associations
        if (resourceIds.length > 0) {
          const rows = resourceIds.map((rid: string) => ({
            collection_id: col.id,
            resource_id: rid,
          }));
          await dbFetch('collection_resources', {
            method: 'POST',
            body: JSON.stringify(rows),
          });
        }
      } else if (table === 'files') {
        // Store file metadata as a resource row
        const file = data;
        const supabaseData = {
          id: file.id,
          title: file.name || '',
          description: null,
          resource_type: 'tool',
          user_id: LOCAL_USER_ID,
          status: 'active',
          metadata: {
            is_file: true,
            fileSize: file.size || '0 B',
            fileSizeBytes: file.sizeBytes || 0,
            fileType: file.type || '',
            fileCategory: file.category || '',
            storagePath: file.storagePath || '',
          },
          created_at: file.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { ok: fileOk, error: fileErr } = await dbUpsertOwned('resources', supabaseData);
        if (!fileOk) return NextResponse.json({ error: '同步文件失败', detail: fileErr }, { status: 500 });
      } else if (table === 'pattern_notes') {
        // 同步图解-笔记关联（pattern_notes 无 user_id 列）。
        // 幂等性：pattern_notes 上有 UNIQUE(pattern_id, note_id) 约束，但
        // dbUpsert 走 POST-first → 409 → PATCH ?id=eq.<id>，当客户端没传 id
        // 时回退的 PATCH 没有主键可匹配会失败。这里改用 PostgREST 原生
        // upsert：POST + `Prefer: resolution=merge-duplicates` +
        // `?on_conflict=pattern_id,note_id` 查询参数指定冲突列，
        // 让数据库在冲突时按唯一约束合并，无论客户端是否传 id 都幂等。
        // 注意：PostgREST 不识别 On-Conflict HTTP 头，必须用 on_conflict 查询参数。
        const pn = data;
        const upsertData: Record<string, unknown> = {
          pattern_id: pn.pattern_id,
          note_id: pn.note_id,
          created_at: pn.created_at || new Date().toISOString(),
        };
        // 仅在客户端显式传入 id 时带上，避免覆盖数据库已生成的主键。
        if (pn.id) upsertData.id = pn.id;
        const pnRes = await dbFetch('pattern_notes?on_conflict=pattern_id,note_id', {
          method: 'POST',
          body: JSON.stringify(upsertData),
          headers: {
            Prefer: 'return=minimal, resolution=merge-duplicates',
          },
        });
        if (!pnRes.ok) return NextResponse.json({ error: '同步图解笔记关联失败', detail: pnRes.error }, { status: 500 });
      }
    } else if (action === 'delete') {
      if (table === 'resources' || table === 'notes') {
        // Scope by user_id so a leaked/forged id can't delete another user's row.
        const result = await dbFetch(`resources?id=eq.${data.id}&user_id=eq.${LOCAL_USER_ID}`, { method: 'DELETE' });
        if (!result.ok) return NextResponse.json({ error: '删除失败', detail: result.error }, { status: 500 });
      } else if (table === 'collections') {
        // Delete junction table entries first (scoped via collection_id, which
        // is itself user-owned; the collections delete below enforces ownership).
        await dbFetch(`collection_resources?collection_id=eq.${data.id}`, { method: 'DELETE' });
        const result = await dbFetch(`collections?id=eq.${data.id}&user_id=eq.${LOCAL_USER_ID}`, { method: 'DELETE' });
        if (!result.ok) return NextResponse.json({ error: '删除合集失败', detail: result.error }, { status: 500 });
      } else if (table === 'files') {
        const result = await dbFetch(`resources?id=eq.${data.id}&user_id=eq.${LOCAL_USER_ID}`, { method: 'DELETE' });
        if (!result.ok) return NextResponse.json({ error: '删除文件失败', detail: result.error }, { status: 500 });
      } else if (table === 'pattern_notes') {
        // pattern_notes has no `id` column — delete by composite key
        if (data.pattern_id && data.note_id) {
          const result = await dbFetch(`pattern_notes?pattern_id=eq.${data.pattern_id}&note_id=eq.${data.note_id}`, { method: 'DELETE' });
          if (!result.ok) return NextResponse.json({ error: '删除图解笔记关联失败', detail: result.error }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Sync error:', e?.message || e);
    return NextResponse.json({ error: e.message || '同步异常' }, { status: 500 });
  }
}
