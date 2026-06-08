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
  // Try POST first (create)
  const postResult = await supabaseFetch(table, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (postResult.ok) return { ok: true };
  // If conflict (duplicate id), update via PATCH
  if (postResult.status === 409) {
    const patchResult = await supabaseFetch(`${table}?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return { ok: patchResult.ok, error: patchResult.error };
  }
  return { ok: false, error: postResult.error || `POST returned ${postResult.status}` };
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
        if (!noteOk) return NextResponse.json({ error: '同步笔记失败', detail: noteErr }, { status: 500 });
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
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Sync error:', e);
    return NextResponse.json({ error: e.message || '同步异常' }, { status: 500 });
  }
}
