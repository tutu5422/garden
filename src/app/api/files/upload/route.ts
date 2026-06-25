import { NextRequest, NextResponse } from 'next/server';
import { configMissingResponse, getPass, isAuth, isSafePath } from '@/lib/auth';
import {
  SERVICE_KEY,
  SUPABASE_URL,
  storageHeaders,
  storageObjectUrl,
  storagePublicUrl,
  vpsStorageEnabled,
  vpsStorageUrl,
  vpsUpload,
} from '@/lib/supabase-admin';

const BUCKET = 'minitu-garden';

async function uploadToSupabase(path: string, buffer: ArrayBuffer, contentType: string): Promise<true | { ok: false; status: number; detail: string }> {
  if (!SERVICE_KEY || !SUPABASE_URL) return { ok: false, status: 500, detail: 'Missing Supabase config' };

  // Upload to Supabase Storage — POST raw binary (most compatible)
  const url = storageObjectUrl(BUCKET, path);
  const res = await fetch(url, {
    method: 'POST',
    headers: storageHeaders({
      'Content-Type': contentType || 'application/octet-stream',
      'x-upsert': 'true',
    }),
    body: buffer,
  });

  if (res.ok || res.status === 200) return true;

  const text = await res.text().catch(() => '');
  console.warn('Supabase upload failed', res.status, text.substring(0, 400));
  return { ok: false, status: res.status, detail: text.substring(0, 200) };
}

export async function POST(req: NextRequest) {
  if (!getPass()) return configMissingResponse();
  if (!(await isAuth(req))) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const id = formData.get('id') as string;

    if (!file || !id) {
      return NextResponse.json({ error: '缺少文件或 ID' }, { status: 400 });
    }

    // Path traversal protection: id is used to build the storage path
    if (!isSafePath(String(id))) {
      return NextResponse.json({ error: '非法 ID 参数' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const fileName = file.name;
    // Use safe filename to avoid Unicode/encoding issues with Supabase Storage
    const ext = file.name.split('.').pop() || 'bin';
    const safeName = `${id}.${ext}`;
    const storagePath = `${id}/${safeName}`;
    const contentType = file.type || 'application/octet-stream';

    // VPS storage takes priority when enabled; otherwise fall back to Supabase.
    if (vpsStorageEnabled()) {
      const vpsResult = await vpsUpload(storagePath, buffer, contentType);
      if (!vpsResult.ok) {
        return NextResponse.json({
          error: '上传到 VPS 存储失败',
          detail: vpsResult.error,
          debug: { fileName, fileSize: buffer.byteLength, fileType: file.type },
        }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        storagePath,
        publicUrl: vpsStorageUrl(storagePath),
        originalName: file.name,
      });
    }

    const result = await uploadToSupabase(storagePath, buffer, contentType);

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
      publicUrl: storagePublicUrl(BUCKET, storagePath),
      originalName: file.name,
    });
  } catch (e: any) {
    console.error('Upload error:', e?.message || e);
    return NextResponse.json({ error: e.message || '上传异常' }, { status: 500 });
  }
}
