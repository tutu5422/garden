import { NextRequest, NextResponse } from 'next/server';

const PASS = process.env.SITE_PASSWORD || '123';
const COOKIE = 'minitu_auth';

// Verify the user is authenticated
function isAuth(req: NextRequest): boolean {
  return req.cookies.get(COOKIE)?.value === PASS;
}

async function uploadToSupabase(path: string, buffer: ArrayBuffer, contentType: string): Promise<boolean> {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!serviceKey || !rawUrl) return false;
  const baseUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

  // Try object route (v2 client convention)
  const url = `${baseUrl}/storage/v1/object/files/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (res.ok || res.status === 200) return true;

  // Fallback: try upload via POST (v1 style)
  const text = await res.text().catch(() => '');
  console.warn('Supabase PUT failed', res.status, text.substring(0, 200));
  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuth(req)) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const id = formData.get('id') as string;

    if (!file || !id) {
      return NextResponse.json({ error: '缺少文件或 ID' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const ok = await uploadToSupabase(`${id}/${file.name}`, buffer, file.type || 'application/octet-stream');

    if (!ok) {
      return NextResponse.json({ error: '上传到存储失败' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      storagePath: `${id}/${file.name}`,
      publicUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${id}/${file.name}`,
    });
  } catch (e: any) {
    console.error('Upload error:', e);
    return NextResponse.json({ error: e.message || '上传异常' }, { status: 500 });
  }
}
