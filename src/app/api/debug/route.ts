import { NextRequest, NextResponse } from 'next/server';
import { configMissingResponse, getPass, isAuth } from '@/lib/auth';
import {
  LOCAL_USER_ID,
  dbFetch,
  vpsDbEnabled,
  vpsDbUrl,
  vpsStorageEnabled,
} from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  if (!getPass()) return configMissingResponse();
  if (!(await isAuth(req))) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const info: Record<string, unknown> = {
    localUserId: LOCAL_USER_ID,
    vpsDbEnabled: vpsDbEnabled(),
    vpsStorageEnabled: vpsStorageEnabled(),
    vpsDbUrl: vpsDbUrl() || '(not set)',
    vpsStorageUrl: (process.env.VPS_STORAGE_URL || '(not set)').replace(/\/+$/, ''),
  };

  if (vpsDbEnabled()) {
    // Test direct note insert
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
      const noteRes = await dbFetch('resources', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(noteData),
      });
      const noteInsert: Record<string, unknown> = { status: noteRes.status, ok: noteRes.ok };
      if (noteRes.ok) {
        noteInsert.data = JSON.stringify(noteRes.body).substring(0, 200);
      } else {
        noteInsert.body = noteRes.error || '';
      }
      info.noteDirectInsert = noteInsert;
      // Cleanup (scoped to LOCAL_USER_ID for defense-in-depth)
      if (noteRes.ok || noteRes.status === 409) {
        await dbFetch(`resources?id=eq.${testNoteId}&user_id=eq.${LOCAL_USER_ID}`, { method: 'DELETE' });
      }
    } catch (e: any) { info.noteDirectInsert = { error: e.message }; }

    // Test read (scoped to LOCAL_USER_ID for defense-in-depth)
    try {
      const r = await dbFetch(`resources?limit=3&user_id=eq.${LOCAL_USER_ID}&select=id,title,resource_type,metadata`);
      const serviceRead: Record<string, unknown> = { status: r.status, ok: r.ok };
      if (r.ok) { serviceRead.rows = r.body; }
      else { serviceRead.body = r.error || ''; }
      info.serviceRead = serviceRead;
    } catch (e: any) { info.serviceRead = { error: e.message }; }

    // Count total rows (user-scoped)
    try {
      const r = await dbFetch(`resources?select=count&user_id=eq.${LOCAL_USER_ID}`);
      if (r.ok && Array.isArray(r.body)) {
        info.totalRows = (r.body as { count: number }[])[0]?.count ?? 0;
      }
    } catch {}

    // Count notes (user-scoped)
    try {
      const r = await dbFetch(`resources?select=count&user_id=eq.${LOCAL_USER_ID}&metadata->>is_note=eq.true`);
      if (r.ok && Array.isArray(r.body)) {
        info.noteRows = (r.body as { count: number }[])[0]?.count ?? 0;
      }
    } catch {}

    // Count collections (user-scoped)
    try {
      const r = await dbFetch(`collections?select=count&user_id=eq.${LOCAL_USER_ID}`);
      if (r.ok && Array.isArray(r.body)) {
        info.collectionRows = (r.body as { count: number }[])[0]?.count ?? 0;
      }
    } catch {}

    // Count collection_resources junction
    try {
      const r = await dbFetch('collection_resources?select=count');
      if (r.ok && Array.isArray(r.body)) {
        info.junctionRows = (r.body as { count: number }[])[0]?.count ?? 0;
      }
    } catch {}
  }

  return NextResponse.json(info);
}
