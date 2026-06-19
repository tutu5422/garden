'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
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

  const handleGateLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: gatePwd }),
      })
      if (r.ok) {
        toast.success('欢迎回来 🐰')
        window.location.href = '/'
      } else {
        const data = await r.json().catch(() => ({ error: '验证失败' }))
        setError(data.error || '验证失败，请重试')
      }
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

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
    <div className="w-full max-w-sm space-y-5 page-enter">
      {/* Logo — Editorial */}
      <div className="text-center mb-3">
        <span className="section-number">LG</span>
        <h1 className="editorial-hero-sub mt-3 mb-1" style={{ color: 'var(--skin-text)' }}>
          迷你兔
        </h1>
        <p className="text-xs tracking-[0.15em] uppercase font-bold text-[var(--skin-text-secondary)]">
          个人数字花园 · 仅限主人访问
        </p>
        <div className="rule-thin mt-5 mb-2 mx-auto w-16" style={{ background: 'var(--skin-primary)' }} />
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--skin-muted)' }}>
        <button
          onClick={() => { setTab('gate'); setError('') }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all"
          style={tab === 'gate' ? {
            background: 'var(--skin-primary)', color: '#fff',
            boxShadow: 'var(--shadow-colored)',
          } : {
            background: 'transparent', color: 'var(--skin-text-secondary)',
          }}>
          <Lock className="size-3.5" /> 访问密码
        </button>
        {isSupabaseReady() && (
          <button
            onClick={() => { setTab('supabase'); setError('') }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all"
            style={tab === 'supabase' ? {
              background: 'var(--skin-primary)', color: '#fff',
              boxShadow: 'var(--shadow-colored)',
            } : {
              background: 'transparent', color: 'var(--skin-text-secondary)',
            }}>
            <Mail className="size-3.5" /> 账号登录
          </button>
        )}
      </div>

      {/* Password Gate Form */}
      {tab === 'gate' && (
        <div className="card card-rounded-tr p-6 animate-fade-in-scale" style={{ background: 'var(--skin-surface)', border: '2px solid var(--skin-border)' }}>
          <div className="text-center mb-5">
            <span className="text-xs font-extrabold tracking-wider uppercase" style={{ fontFamily: "var(--font-display)", color: 'var(--skin-text)' }}>
              输入访问密码
            </span>
            <p className="text-[10px] text-[var(--skin-text-secondary)] mt-1">此网站仅限主人访问</p>
          </div>
          <form onSubmit={handleGateLogin} className="space-y-4">
            <input
              type="password" placeholder="输入访问密码" value={gatePwd}
              onChange={(e) => setGatePwd(e.target.value)} autoFocus
              className="input-filled w-full text-sm" />
            {error && <p className="text-xs text-center" style={{ color: 'var(--skin-accent)' }}>{error}</p>}
            <button type="submit" className="btn w-full justify-center" disabled={loading || !gatePwd}>
              <LogIn className="size-4" />
              {loading ? '验证中...' : '进入花园'}
            </button>
          </form>
        </div>
      )}

      {/* Supabase Login Form */}
      {tab === 'supabase' && (
        <div className="card card-rounded-tr p-6 animate-fade-in-scale" style={{ background: 'var(--skin-surface)', border: '2px solid var(--skin-border)' }}>
          <div className="text-center mb-5">
            <span className="text-xs font-extrabold tracking-wider uppercase" style={{ fontFamily: "var(--font-display)", color: 'var(--skin-text)' }}>
              账号登录
            </span>
            <p className="text-[10px] text-[var(--skin-text-secondary)] mt-1">登录你的秘密花园</p>
          </div>
          <form onSubmit={handleSupabaseLogin} className="space-y-4">
            {!isSupabaseReady() && (
              <div className="rounded-lg p-3 text-[10px] text-center" style={{ background: 'var(--skin-muted)', color: 'var(--skin-text-secondary)' }}>
                ⚠️ 数据库未连接，登录功能暂不可用
              </div>
            )}
            <input type="email" placeholder="your@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
              className="input-filled w-full text-sm" />
            <input type="password" placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" minLength={6}
              className="input-filled w-full text-sm" />
            {error && <p className="text-xs text-center" style={{ color: 'var(--skin-accent)' }}>{error}</p>}
            <button type="submit" className="btn w-full justify-center" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </button>
            <p className="text-[10px] text-center text-[var(--skin-text-secondary)]">
              还没有账号？{' '}
              <Link href="/signup" className="font-bold hover:underline" style={{ color: 'var(--skin-primary)' }}>立即注册</Link>
            </p>
          </form>
        </div>
      )}
    </div>
  )
}
