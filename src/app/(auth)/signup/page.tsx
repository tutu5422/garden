'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

const isSupabaseReady = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return url && !url.includes('placeholder')
}

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isSupabaseReady()) {
      toast.info('数据库尚未配置，请先连接 Supabase。\n\n当前可正常浏览页面，添加/注册功能需要配置数据库后才能使用。')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/callback` },
      })

      if (error) {
        toast.error(error.message || '注册失败，请重试')
      } else {
        toast.success('注册成功！请查看邮箱确认链接。')
        router.push('/login')
      }
    } catch {
      toast.error('网络连接失败，请检查数据库配置')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="shadow-3d-lg animate-scale-in">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">创建账号</CardTitle>
        <CardDescription>开始搭建你的秘密花园 📝</CardDescription>
      </CardHeader>
      <form onSubmit={handleSignup}>
        <CardContent className="space-y-4">
          {!isSupabaseReady() && (
            <div className="glass rounded-lg p-3 text-sm text-muted-foreground text-center">
              ⚠️ 数据库未连接，注册功能暂不可用
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email" type="email" placeholder="your@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              required autoComplete="email"
              className="glass border-white/30 dark:border-white/10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password" type="password" placeholder="至少6位字符"
              value={password} onChange={(e) => setPassword(e.target.value)}
              required autoComplete="new-password" minLength={6}
              className="glass border-white/30 dark:border-white/10"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full btn-3d rounded-full" disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </Button>
          <p className="text-sm text-muted-foreground">
            已有账号？{' '}
            <Link href="/login" className="text-primary hover:underline">去登录</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
