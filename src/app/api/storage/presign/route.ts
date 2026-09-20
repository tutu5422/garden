import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { configMissingResponse, getPass, isAuth, isSafePath } from '@/lib/auth'
import { vpsStorageEnabled, vpsStorageUrl } from '@/lib/vps-db'

/**
 * 生成上传 URL。
 *
 * VPS 模式下客户端直传 nginx：
 * - 写：`/storage-write/<path>?e=<exp>&s=<sig>`，由 nginx `secure_link` 校验短时签名
 *   （密钥 STORAGE_SIGN_SECRET，10 分钟过期），未签名/签名错/过期分别 403/403/410。
 * - 读：`/storage/<path>` 公开（浏览器 <img>/<audio> 直连）。
 *
 * 服务端脚本/上传 API 仍可用 `x-storage-key` 头写 `/storage/<path>`。
 */

const STORAGE_WRITE_PREFIX = 'storage-write'
const SIGN_TTL_SECONDS = 600

/** nginx secure_link 签名：base64(md5(secret + uri + exp))，用 -_ 替换 +/ 并去掉 = */
function signWritePath(uri: string, exp: number): string {
  const secret = process.env.STORAGE_SIGN_SECRET || ''
  return crypto
    .createHash('md5')
    .update(`${secret}${uri}${exp}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

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

    // 签名失败会表现为 403：缺少密钥时明确报错，避免静默坏掉上传
    if (!process.env.STORAGE_SIGN_SECRET) {
      return NextResponse.json({ error: '服务端未配置 STORAGE_SIGN_SECRET' }, { status: 500 })
    }

    const base = (process.env.VPS_STORAGE_URL || '').replace(/\/+$/, '')  // https://…/storage
    const origin = base.replace(/\/storage$/, '')                        // https://…
    const writeUri = `/${STORAGE_WRITE_PREFIX}/${storagePath}`
    const exp = Math.floor(Date.now() / 1000) + SIGN_TTL_SECONDS
    const signedUrl = `${origin}${writeUri}?e=${exp}&s=${signWritePath(writeUri, exp)}`

    return NextResponse.json({
      ok: true,
      signedUrl,
      storagePath,
      publicUrl: vpsStorageUrl(storagePath),
      expiresAt: exp,
      vps: true,
    })
  } catch (e: any) {
    console.error('Presign error:', e?.message || e)
    return NextResponse.json({ error: e.message || '生成上传链接异常' }, { status: 500 })
  }
}
