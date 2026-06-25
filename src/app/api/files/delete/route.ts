import { NextRequest, NextResponse } from 'next/server';
import { configMissingResponse, getPass, isAuth, isSafePath } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!getPass()) return configMissingResponse();
  if (!(await isAuth(req))) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const { storagePath } = await req.json();
    if (!storagePath) {
      return NextResponse.json({ error: '缺少文件路径' }, { status: 400 });
    }

    // Path traversal protection
    if (!isSafePath(String(storagePath))) {
      return NextResponse.json({ error: '非法文件路径' }, { status: 400 });
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

    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => '');
      console.error('Supabase delete error:', res.status, text.substring(0, 200));
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Delete error:', e);
    return NextResponse.json({ error: e.message || '删除异常' }, { status: 500 });
  }
}
