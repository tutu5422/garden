import { NextRequest, NextResponse } from 'next/server';
import { configMissingResponse, getPass, isAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!getPass()) return configMissingResponse();
  if (!(await isAuth(req))) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SUPABASE_URL = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
  const LOCAL_USER_ID = process.env.SUPABASE_LOCAL_USER_ID || '';

  const info: Record<string, any> = {
    supabaseUrl_raw: rawUrl,
    supabaseUrl_fixed: SUPABASE_URL,
    hasServiceKey: SERVICE_KEY.length > 0,
    serviceKeyLen: SERVICE_KEY.length,
    localUserId: LOCAL_USER_ID,
  };

  if (SERVICE_KEY && SUPABASE_URL) {
    // Test direct note insert (same format as /api/sync notes handler)
    const testNoteId = crypto.randomUUID();
    try {
      const noteData = {
        id: testNoteId,
        title: 'debug-note-test',
        description: 'test',
        resource_type: 'article',
        user_id: LOCAL_USER_ID,
        status: 'active',
        metadata: { is_note: true, content: 'hello', tags: [], type: 'article' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const noteRes = await fetch(`${SUPABASE_URL}/rest/v1/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=representation' },
        body: JSON.stringify(noteData),
      });
      info.noteDirectInsert = { status: noteRes.status, ok: noteRes.ok };
      if (noteRes.ok) {
        info.noteDirectInsert.data = (await noteRes.text()).substring(0, 200);
      } else {
        info.noteDirectInsert.body = (await noteRes.text()).substring(0, 300);
      }
      // Cleanup
      if (noteRes.ok || noteRes.status === 409) {
        await fetch(`${SUPABASE_URL}/rest/v1/resources?id=eq.${testNoteId}`, {
          method: 'DELETE',
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        });
      }
    } catch (e: any) { info.noteDirectInsert = { error: e.message }; }

    // Test read with service key
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/resources?limit=3&select=id,title,resource_type,metadata`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      info.serviceRead = { status: r.status, ok: r.ok };
      if (r.ok) { info.serviceRead.rows = await r.json(); }
      else { info.serviceRead.body = (await r.text()).substring(0, 300); }
    } catch (e: any) { info.serviceRead = { error: e.message }; }

    // Count total rows
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/resources?select=count`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      if (r.ok) {
        const d = await r.json();
        info.totalRows = d[0]?.count ?? 0;
      }
    } catch {}

    // Count notes
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/resources?select=count&metadata->>is_note=eq.true`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      if (r.ok) {
        const d = await r.json();
        info.noteRows = d[0]?.count ?? 0;
      }
    } catch {}

    // Count collections
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/collections?select=count`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      if (r.ok) {
        const d = await r.json();
        info.collectionRows = d[0]?.count ?? 0;
      }
    } catch {}
  }

  return NextResponse.json(info);
}
