import { NextRequest, NextResponse } from 'next/server';
import { configMissingResponse, getPass, isAuth, isSafePath } from '@/lib/auth';
import { vpsDelete, vpsStorageEnabled } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  if (!getPass()) return configMissingResponse();
  if (!(await isAuth(req))) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const { storagePath } = await req.json();

    if (!storagePath) {
      return NextResponse.json({ error: '缺少存储路径' }, { status: 400 });
    }

    // Path traversal protection
    if (!isSafePath(String(storagePath))) {
      return NextResponse.json({ error: '非法存储路径' }, { status: 400 });
    }

    if (!vpsStorageEnabled()) {
      return NextResponse.json({ error: 'VPS 存储未配置' }, { status: 500 });
    }

    const ok = await vpsDelete(storagePath);
    if (!ok) {
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Music delete error:', e?.message || e);
    return NextResponse.json({ error: e.message || '删除异常' }, { status: 500 });
  }
}
