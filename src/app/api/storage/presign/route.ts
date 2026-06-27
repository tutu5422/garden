import { NextRequest, NextResponse } from 'next/server'
import { configMissingResponse, getPass, isAuth, isSafePath } from '@/lib/auth'
import { vpsStorageEnabled, vpsStorageUrl } from '@/lib/supabase-admin'

/**
 * 生成上传 URL。
 *
 * VPS 模式下不需要预签名（Nginx 直接接受 PUT），返回直接 PUT URL。
 * 客户端需要带 `x-storage-key: VPS_STORAGE_KEY` 头上传。
 */
export async function POST(req: NextRequest) {
  if (!getPass()) return configMissingResponse()
  if (!(await isAuth(req))) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  try {
    const { filename, id } = await req.json()

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

    if (!vpsStorageEnabled()) {
      return NextResponse.json({ error: 'VPS 存储未配置' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      signedUrl: vpsStorageUrl(storagePath),
      storagePath,
      publicUrl: vpsStorageUrl(storagePath),
      vps: true,
    })
  } catch (e: any) {
    console.error('Presign error:', e?.message || e)
    return NextResponse.json({ error: e.message || '生成上传链接异常' }, { status: 500 })
  }
}
