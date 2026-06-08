import { NextRequest, NextResponse } from 'next/server';

const PASS = process.env.SITE_PASSWORD || '123';
const COOKIE = 'minitu_auth';

// Verify the user is authenticated
function isAuth(req: NextRequest): boolean {
  return req.cookies.get(COOKIE)?.value === PASS;
}

async function uploadToSupabase(path: string, buffer: ArrayBuffer, contentType: string): Promise<true | { ok: false; status: number; detail: string }> {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!serviceKey || !rawUrl) return { ok: false, status: 500, detail: 'Missing Supabase config' };
  const baseUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

  // Upload to Supabase Storage — POST raw binary (most compatible)
  const url = `${baseUrl}/storage/v1/object/minitu-garden/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': contentType || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (res.ok || res.status === 200) return true;

  const text = await res.text().catch(() => '');
  console.warn('Supabase upload failed', res.status, text.substring(0, 400));
  return { ok: false, status: res.status, detail: text.substring(0, 200) };
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
    const fileName = file.name;
    // Use safe filename to avoid Unicode/encoding issues with Supabase Storage
    const ext = file.name.split('.').pop() || 'bin';
    const safeName = `${id}.${ext}`;
    const storagePath = `${id}/${safeName}`;
    const result = await uploadToSupabase(storagePath, buffer, file.type || 'application/octet-stream');

    if (result !== true) {
      return NextResponse.json({
        error: '上传到存储失败',
        detail: typeof result === 'object' ? result : 'unknown',
        debug: { fileName, fileSize: buffer.byteLength, fileType: file.type },
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      storagePath,
      publicUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/minitu-garden/${storagePath}`,
      originalName: file.name,
    });
  } catch (e: any) {
    console.error('Upload error:', e);
    return NextResponse.json({ error: e.message || '上传异常' }, { status: 500 });
  }
}
