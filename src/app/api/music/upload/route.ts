import { NextRequest, NextResponse } from 'next/server';
import { configMissingResponse, getPass, isAuth, isSafePath } from '@/lib/auth';
import { MAX_FILE_SIZE } from '@/lib/constants/config';
import { vpsStorageEnabled, vpsStorageUrl, vpsUpload } from '@/lib/vps-db';
import { validateFileType } from '@/lib/utils/file-types';

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

    if (!vpsStorageEnabled()) {
      return NextResponse.json({ error: 'VPS 存储未配置' }, { status: 500 });
    }

    // 限制文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `文件过大，最大 ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 413 });
    }

    // 文件类型校验：仅允许音频格式，扩展名 + MIME 双重校验
    const typeCheck = validateFileType(file.name, file.type, ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac']);
    if (!typeCheck.ok) {
      return NextResponse.json({ error: typeCheck.reason || '仅支持音频文件' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const ext = file.name.split('.').pop() || 'mp3';
    const safeName = `${id}.${ext}`;
    const storagePath = `music/${id}/${safeName}`;
    const contentType = file.type || 'audio/mpeg';

    const vpsResult = await vpsUpload(storagePath, buffer, contentType);
    if (!vpsResult.ok) {
      return NextResponse.json({ error: '上传到 VPS 存储失败', detail: vpsResult.error }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      storagePath,
      publicUrl: vpsStorageUrl(storagePath),
      originalName: file.name,
    });
  } catch (e: any) {
    console.error('Music upload error:', e?.message || e);
    return NextResponse.json({ error: e.message || '上传异常' }, { status: 500 });
  }
}
