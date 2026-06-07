'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock, LogIn, Mail } from 'lucide-react'
import { toast } from 'sonner'

const isSupabaseReady = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return url && !url.includes('placeholder')
}

export default function LoginPage() {
  const [tab, setTab] = useState<'gate' | 'supabase'>('gate')
  const [gatePwd, setGatePwd] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/resources'

  // 密码门登录
  const handleGateLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await fetch('/api/login', { method: 'POST' })
      if (r.ok) {
        toast.success('欢迎回来 🐰')
        router.push('/')
      } else {
        setError('验证失败，请重试')
      }
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  // Supabase 登录
  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isSupabaseReady()) {
      toast.info('数据库尚未配置。\n\n当前可正常浏览页面，高级功能需要连接 Supabase。')
      return
    }

    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        setError(authError.message === 'Invalid login credentials' ? '邮箱或密码错误' : '登录失败，请重试')
      } else {
        toast.success('登录成功')
        router.push(redirectTo)
        router.refresh()
      }
    } catch {
      setError('网络连接失败，请检查数据库配置')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      {/* Logo */}
      <div className="text-center mb-6">
        <span className="text-5xl">🐰</span>
        <h1 className="mt-3 text-2xl font-bold text-zinc-800 dark:text-white">迷你兔</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">个人数字花园</p>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800/60 p-1">
        <button
          onClick={() => { setTab('gate'); setError('') }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'gate'
              ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-800 dark:text-white'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Lock className="w-3.5 h-3.5" /> 访问密码
        </button>
        {isSupabaseReady() && (
          <button
            onClick={() => { setTab('supabase'); setError('') }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'supabase'
                ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-800 dark:text-white'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> 账号登录
          </button>
        )}
      </div>

      {/* Password Gate Form */}
      {tab === 'gate' && (
        <Card className="animate-scale-in">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">输入访问密码</CardTitle>
            <CardDescription>此网站仅限主人访问</CardDescription>
          </CardHeader>
          <form onSubmit={handleGateLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gate-pwd">密码</Label>
                <Input
                  id="gate-pwd"
                  type="password"
                  placeholder="输入访问密码"
                  value={gatePwd}
                  onChange={(e) => setGatePwd(e.target.value)}
                  autoFocus
                  className="glass border-white/30 dark:border-white/10"
                />
              </div>
              {error && (
                <p className="text-red-500 text-xs text-center">{error}</p>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full rounded-full" disabled={loading || !gatePwd}>
                <LogIn className="w-4 h-4 mr-1.5" />
                {loading ? '验证中...' : '进入花园'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* Supabase Login Form */}
      {tab === 'supabase' && (
        <Card className="animate-scale-in">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">账号登录</CardTitle>
            <CardDescription>登录你的秘密花园</CardDescription>
          </CardHeader>
          <form onSubmit={handleSupabaseLogin}>
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
              {error && (
                <p className="text-red-500 text-xs text-center">{error}</p>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full rounded-full" disabled={loading}>
                {loading ? '登录中...' : '登录'}
              </Button>
              <p className="text-sm text-muted-foreground">
                还没有账号？{' '}
                <Link href="/signup" className="text-primary hover:underline">立即注册</Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  )
}
