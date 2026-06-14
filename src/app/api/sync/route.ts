import { NextRequest, NextResponse } from 'next/server';

const PASS = process.env.SITE_PASSWORD || '123';
const COOKIE = 'minitu_auth';
const LOCAL_USER_ID = process.env.SUPABASE_LOCAL_USER_ID || '';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Ensure protocol prefix — critical: Vercel may set URL without https://
const SUPABASE_URL = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// Music playlist resource ID — deterministic UUID v5 derived from LOCAL_USER_ID
// Pre-computed: crypto.createHash('md5').update('garden-music-' + LOCAL_USER_ID).digest('hex') → UUID
const MUSIC_PLAYLIST_ID = '254e932e-ac70-4320-8944-92107bcc4eb1';

// Valid resource_type enum values in the Supabase schema
const VALID_TYPES = new Set(['article', 'book', 'link', 'image', 'tool']);

function isAuth(req: NextRequest): boolean {
  return req.cookies.get(COOKIE)?.value === PASS;
}

function mapResourceType(type: string): string | null {
  if (VALID_TYPES.has(type)) return type;
  return null; // store in metadata instead
}

async function supabaseFetch(path: string, options: RequestInit): Promise<{ ok: boolean; status: number; error?: string }> {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'return=minimal',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.error(`Supabase ${path}:`, res.status, err.substring(0, 300));
    return { ok: false, status: res.status, error: `${res.status}: ${err.substring(0, 200)}` };
  }
  return { ok: true, status: res.status };
}

// POST-first upsert: POST to create, PATCH on duplicate conflict
async function supabaseUpsert(table: string, data: Record<string, any>): Promise<{ ok: boolean; error?: string }> {
  const id = data.id;
  const postResult = await supabaseFetch(table, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (postResult.ok) return { ok: true };
  if (postResult.status === 409) {
    const patchResult = await supabaseFetch(`${table}?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return { ok: patchResult.ok, error: patchResult.error };
  }
  return { ok: false, error: postResult.error || `POST returned ${postResult.status}` };
}

// GET: Pull all cloud data for the user (uses service key, bypasses RLS)
export async function GET(req: NextRequest) {
  if (!isAuth(req)) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  if (!SERVICE_KEY || !SUPABASE_URL || !LOCAL_USER_ID) {
    return NextResponse.json({ error: '服务端配置缺失' }, { status: 500 });
  }

  try {
    // Parallelize all Supabase queries
    const [musicRes, notesRes, resRes, filesRes, colRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/resources?id=eq.${MUSIC_PLAYLIST_ID}&select=metadata`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/resources?select=*&resource_type=eq.article&metadata->>is_note=eq.true&order=created_at.desc&limit=200`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/resources?select=*&or=(metadata->>is_note.is.null,metadata->>is_note.eq.false)&order=updated_at.desc&limit=200`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/resources?select=*&metadata->>is_file=eq.true&order=updated_at.desc&limit=200`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/collections?select=*&user_id=eq.${LOCAL_USER_ID}&order=updated_at.desc`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      }),
    ]);

    let musicPlaylist: any[] = [];
    if (musicRes.ok) {
      const musicData = await musicRes.json();
      if (musicData?.[0]?.metadata?.tracks) {
        musicPlaylist = musicData[0].metadata.tracks;
      }
    }

    const notes = notesRes.ok ? await notesRes.json() : [];
    const resources = resRes.ok ? await resRes.json() : [];
    const cloudFiles = filesRes.ok ? await filesRes.json() : [];
    const collections = colRes.ok ? await colRes.json() : [];

    // Pull collection_resources junctions
    let junctions: any[] = [];
    if (collections.length > 0) {
      const colIds = collections.map((c: any) => c.id);
      const juncUrl = `${SUPABASE_URL}/rest/v1/collection_resources?select=collection_id,resource_id&collection_id=in.(${colIds.join(',')})`;
      const juncRes = await fetch(juncUrl, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      if (juncRes.ok) junctions = await juncRes.json();
    }

    // Map resource IDs to collections
    const resourceMap: Record<string, string[]> = {};
    for (const j of junctions) {
      if (!resourceMap[j.collection_id]) resourceMap[j.collection_id] = [];
      resourceMap[j.collection_id].push(j.resource_id);
    }

    const response = NextResponse.json({
      musicPlaylist: musicPlaylist || [],
      notes: (notes || []).map((r: any) => ({
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
      resources: (resources || []).map((r: any) => ({
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
      files: (cloudFiles || []).map((r: any) => ({
        id: r.id,
        name: r.title || '',
        size: r.metadata?.fileSize || '0 B',
        sizeBytes: r.metadata?.fileSizeBytes || 0,
        type: r.metadata?.fileType || '',
        category: r.metadata?.fileCategory || '',
        createdAt: r.created_at,
        storagePath: r.metadata?.storagePath || '',
      })),
      collections: (collections || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        coverImage: c.cover_image_url || '',
        resourceIds: resourceMap[c.id] || [],
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    });
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return response;
  } catch (e: any) {
    console.error('Sync GET error:', e);
    return NextResponse.json({ error: e.message || '获取数据失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuth(req)) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  if (!SERVICE_KEY || !SUPABASE_URL || !LOCAL_USER_ID) {
    return NextResponse.json({ error: '服务端配置缺失' }, { status: 500 });
  }

  try {
    const { table, action, data } = await req.json();

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
            tags: resource.resource_tags?.map((rt: any) => rt.tag?.name || rt.tag) || [],
          },
          created_at: resource.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { ok, error } = await supabaseUpsert('resources', supabaseData);
        if (!ok) return NextResponse.json({ error: '同步资源失败', detail: error, url: SUPABASE_URL }, { status: 500 });
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
        const { ok: ok2, error: err2 } = await supabaseUpsert('resources', supabaseData);
        if (!ok2) return NextResponse.json({ error: '同步播放列表失败', detail: err2 }, { status: 500 });
      } else if (table === 'notes') {
        // Store note as a resource row with resource_type='article'
        // Note-specific fields (content, image, tags, collectionId) go into metadata
        const note = data;
        const supabaseData = {
          id: note.id,
          title: note.title || '',
          description: note.content ? note.content.substring(0, 500) : null,
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
        const { ok: noteOk, error: noteErr } = await supabaseUpsert('resources', supabaseData);
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
        const { ok: ok3, error: err3 } = await supabaseUpsert('collections', supabaseData);
        if (!ok3) return NextResponse.json({ error: '同步合集失败', detail: err3, url: SUPABASE_URL }, { status: 500 });
        // Sync resource associations via junction table
        const resourceIds: string[] = col.resourceIds || [];
        // Delete old associations
        await supabaseFetch(`collection_resources?collection_id=eq.${col.id}`, { method: 'DELETE' });
        // Insert new associations
        if (resourceIds.length > 0) {
          const rows = resourceIds.map((rid: string) => ({
            collection_id: col.id,
            resource_id: rid,
          }));
          await supabaseFetch('collection_resources', {
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
        const { ok: fileOk, error: fileErr } = await supabaseUpsert('resources', supabaseData);
        if (!fileOk) return NextResponse.json({ error: '同步文件失败', detail: fileErr }, { status: 500 });
      }
    } else if (action === 'delete') {
      if (table === 'resources' || table === 'notes') {
        const result = await supabaseFetch(`resources?id=eq.${data.id}`, { method: 'DELETE' });
        if (!result.ok) return NextResponse.json({ error: '删除失败', detail: result.error }, { status: 500 });
      } else if (table === 'collections') {
        // Delete junction table entries first
        await supabaseFetch(`collection_resources?collection_id=eq.${data.id}`, { method: 'DELETE' });
        const result = await supabaseFetch(`collections?id=eq.${data.id}`, { method: 'DELETE' });
        if (!result.ok) return NextResponse.json({ error: '删除合集失败', detail: result.error }, { status: 500 });
      } else if (table === 'files') {
        const result = await supabaseFetch(`resources?id=eq.${data.id}`, { method: 'DELETE' });
        if (!result.ok) return NextResponse.json({ error: '删除文件失败', detail: result.error }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Sync error:', e);
    return NextResponse.json({ error: e.message || '同步异常' }, { status: 500 });
  }
}
