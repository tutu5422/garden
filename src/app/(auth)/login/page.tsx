'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/resources'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isSupabaseReady()) {
      toast.info('数据库尚未配置，请先连接 Supabase。\n\n当前可正常浏览页面，登录功能需要配置数据库后才能使用。')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        toast.error(error.message === 'Invalid login credentials' ? '邮箱或密码错误' : '登录失败，请重试')
      } else {
        toast.success('登录成功')
        router.push(redirectTo)
        router.refresh()
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
        <CardTitle className="text-xl">欢迎回来</CardTitle>
        <CardDescription>登录你的秘密花园</CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          {!isSupabaseReady() && (
            <div className="glass rounded-lg p-3 text-sm text-muted-foreground text-center">
              ⚠️ 数据库未连接，登录功能暂不可用
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
              id="password" type="password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)}
              required autoComplete="current-password" minLength={6}
              className="glass border-white/30 dark:border-white/10"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full btn-3d rounded-full" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </Button>
          <p className="text-sm text-muted-foreground">
            还没有账号？{' '}
            <Link href="/signup" className="text-primary hover:underline">立即注册</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
