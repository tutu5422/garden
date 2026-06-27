import { NextResponse } from 'next/server'

export async function GET() {
  // Supabase OAuth 已移除，OAuth 回调不再需要。
  return NextResponse.redirect(new URL('/login?error=oauth_disabled', process.env.NEXT_PUBLIC_SITE_URL || '/'))
}
