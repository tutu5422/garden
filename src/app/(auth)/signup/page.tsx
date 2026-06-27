import { redirect } from 'next/navigation'

export default function SignupPage() {
  // Supabase OAuth 已移除，注册功能不再可用。
  // 访问权限通过 SITE_PASSWORD 站点密码控制，无需注册。
  redirect('/login')
}
