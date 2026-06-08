import { NextRequest, NextResponse } from 'next/server';

const PASS = process.env.SITE_PASSWORD || '123';
const COOKIE = 'minitu_auth';

function isAuth(req: NextRequest): boolean {
  return req.cookies.get(COOKIE)?.value === PASS;
}

export async function POST(req: NextRequest) {
  if (!isAuth(req)) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const { storagePath } = await req.json();

    if (!storagePath) {
      return NextResponse.json({ error: '缺少存储路径' }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (!serviceKey || !rawUrl) {
      return NextResponse.json({ error: '服务端配置缺失' }, { status: 500 });
    }
    const baseUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

    const url = `${baseUrl}/storage/v1/object/minitu-garden/${storagePath}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('Music delete failed:', res.status, text.substring(0, 200));
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Music delete error:', e);
    return NextResponse.json({ error: e.message || '删除异常' }, { status: 500 });
  }
}
