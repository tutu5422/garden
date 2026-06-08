import { NextRequest, NextResponse } from 'next/server';

const PASS = process.env.SITE_PASSWORD || '123';
const COOKIE = 'minitu_auth';

export async function GET(req: NextRequest) {
  if (req.cookies.get(COOKIE)?.value !== PASS) {
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

  // Test direct Supabase connection
  if (SERVICE_KEY && SUPABASE_URL) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/resources?limit=1`, {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      });
      info.restTest = { status: res.status, ok: res.ok };
      if (!res.ok) {
        info.restTest.body = (await res.text()).substring(0, 300);
      } else {
        info.restTest.data = (await res.text()).substring(0, 200);
      }
    } catch (e: any) {
      info.restTest = { error: e.message };
    }

    // Test POST
    const testId = 'debug-' + Date.now().toString(36);
    try {
      const res2 = await fetch(`${SUPABASE_URL}/rest/v1/resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          id: testId,
          title: 'debug-test',
          resource_type: 'article',
          user_id: LOCAL_USER_ID,
          created_at: new Date().toISOString(),
        }),
      });
      info.postTest = { status: res2.status, ok: res2.ok };
      if (!res2.ok) {
        info.postTest.body = (await res2.text()).substring(0, 300);
      }
      // Cleanup
      if (res2.ok) {
        await fetch(`${SUPABASE_URL}/rest/v1/resources?id=eq.${testId}`, {
          method: 'DELETE',
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
        });
      }
    } catch (e: any) {
      info.postTest = { error: e.message };
    }
  }

  return NextResponse.json(info);
}
