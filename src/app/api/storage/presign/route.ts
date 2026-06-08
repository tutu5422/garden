import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PASS = process.env.SITE_PASSWORD || '123'
const COOKIE = 'minitu_auth'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

function isAuth(req: NextRequest): boolean {
  return req.cookies.get(COOKIE)?.value === PASS
}

/**
 * Generate a presigned upload URL.
 * Client calls this → gets signed URL → uploads directly to Supabase (bypasses Vercel 4.5MB limit)
 */
export async function POST(req: NextRequest) {
  if (!isAuth(req)) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  if (!SERVICE_KEY || !SUPABASE_URL) {
    return NextResponse.json({ error: '服务端配置缺失' }, { status: 500 })
  }

  try {
    const { filename, contentType, id } = await req.json()

    if (!filename || !id) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 })
    }

    const ext = filename.split('.').pop() || 'bin'
    const safeName = `${id}.${ext}`
    const storagePath = `${id}/${safeName}`

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Generate signed upload URL (valid for 60 seconds)
    const { data, error } = await supabase.storage
      .from('minitu-garden')
      .createSignedUploadUrl(storagePath)

    if (error) {
      console.error('Presign error:', error)
      return NextResponse.json({ error: '生成上传链接失败', detail: error.message }, { status: 500 })
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/minitu-garden/${storagePath}`

    return NextResponse.json({
      ok: true,
      signedUrl: data.signedUrl,
      storagePath,
      publicUrl,
    })
  } catch (e: any) {
    console.error('Presign error:', e)
    return NextResponse.json({ error: e.message || '生成上传链接异常' }, { status: 500 })
  }
}
