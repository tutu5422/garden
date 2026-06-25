import { NextRequest, NextResponse } from 'next/server'
import { configMissingResponse, getPass, isAuth, isSafePath } from '@/lib/auth'
import { supabaseAdmin, supabaseConfigOk, storagePublicUrl, vpsStorageEnabled, vpsStorageUrl } from '@/lib/supabase-admin'

const BUCKET = 'minitu-garden'

/**
 * Generate a presigned upload URL.
 * Client calls this → gets signed URL → uploads directly to Supabase (bypasses Vercel 4.5MB limit)
 *
 * When VPS storage is enabled (VPS_STORAGE_URL present), returns a direct VPS
 * PUT URL instead. The client must PUT the file to this URL with the
 * `x-storage-key` header set to VPS_STORAGE_KEY.
 */
export async function POST(req: NextRequest) {
  if (!getPass()) return configMissingResponse()
  if (!(await isAuth(req))) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  try {
    const { filename, contentType, id } = await req.json()

    if (!filename || !id) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 })
    }

    // Path traversal protection: id is used to build the storage path
    if (!isSafePath(String(id))) {
      return NextResponse.json({ error: '非法路径参数' }, { status: 400 })
    }

    const ext = filename.split('.').pop() || 'bin'
    const safeName = `${id}.${ext}`
    const storagePath = `${id}/${safeName}`
    if (!isSafePath(storagePath)) {
      return NextResponse.json({ error: '非法路径参数' }, { status: 400 })
    }

    // VPS storage: return a direct PUT URL. The client uploads via HTTP PUT
    // (Nginx accepts anonymous PUT for the storage location).
    if (vpsStorageEnabled()) {
      return NextResponse.json({
        ok: true,
        signedUrl: vpsStorageUrl(storagePath),
        storagePath,
        publicUrl: vpsStorageUrl(storagePath),
        vps: true,
      })
    }

    if (!supabaseConfigOk()) {
      return NextResponse.json({ error: '服务端配置缺失' }, { status: 500 })
    }

    // Generate signed upload URL (valid for 60 seconds)
    const { data, error } = await supabaseAdmin()
      .storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath)

    if (error) {
      console.error('Presign error:', error)
      return NextResponse.json({ error: '生成上传链接失败', detail: error.message }, { status: 500 })
    }

    const publicUrl = storagePublicUrl(BUCKET, storagePath)

    return NextResponse.json({
      ok: true,
      signedUrl: data.signedUrl,
      storagePath,
      publicUrl,
    })
  } catch (e: any) {
    console.error('Presign error:', e?.message || e)
    return NextResponse.json({ error: e.message || '生成上传链接异常' }, { status: 500 })
  }
}
