'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const [gatePwd, setGatePwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

      {/* Password Gate Form */}
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
            <Lock className="size-4" />
            {loading ? '验证中...' : '进入花园'}
          </button>
        </form>
      </div>
    </div>
  )
}
