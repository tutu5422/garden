'use client'

import { useState, useEffect, useCallback } from 'react'
import { Heart, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import PatternCard from '@/components/patterns/PatternCard'
import type { Resource } from '@/lib/types'

export default function WishlistPage() {
  const [patterns, setPatterns] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)

  const loadWishlist = useCallback(async () => {
    setLoading(true)
    try {
      const localRaw = localStorage.getItem('garden_resources')
      if (localRaw) {
        let all: Resource[] = JSON.parse(localRaw)
        all = all.filter(
          (r) => (r.metadata as any)?.is_pattern && (r.metadata as any)?.patternStatus === 'wishlist',
        )
        all.sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime(),
        )
        setPatterns(all)
      }
    } catch (e) {
      console.error('加载心愿单失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWishlist()
  }, [loadWishlist])

  const handleWishlist = async (id: string, _currentStatus: string) => {
    // 从心愿单移除
    const localRaw = localStorage.getItem('garden_resources')
    if (localRaw) {
      const all: Resource[] = JSON.parse(localRaw)
      const idx = all.findIndex((r) => r.id === id)
      if (idx !== -1) {
        const meta = (all[idx].metadata || {}) as any
        meta.patternStatus = 'not-started'
        meta.patternLastUsedAt = new Date().toISOString()
        all[idx].metadata = meta
        all[idx].updated_at = new Date().toISOString()
        localStorage.setItem('garden_resources', JSON.stringify(all))
        loadWishlist()
        // 同步完整资源到服务端
        void fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'resources', action: 'upsert', data: all[idx] }),
        }).catch(() => {})
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* 返回 + 标题 */}
      <div className="flex items-center gap-3">
        <Link
          href="/patterns"
          className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft className="size-3.5" />
          返回织集
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="size-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(236,72,153,0.1)' }}
        >
          <Heart className="size-5" style={{ color: '#EC4899' }} />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-wider" style={{ color: 'var(--foreground)' }}>
            心愿单
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {patterns.length > 0 ? `${patterns.length} 个想要编织的图解` : '还没有加入心愿单的图解'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl animate-pulse"
              style={{ height: '320px', background: 'rgba(175,200,218,0.1)' }}
            />
          ))}
        </div>
      ) : patterns.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">💝</div>
          <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
            看到喜欢的图解，点击卡片右上角的 ♡ 加入心愿单
          </p>
          <Link
            href="/patterns"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
            style={{ background: 'var(--skin-primary)', color: '#fff' }}
          >
            浏览图解
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {patterns.map((pattern) => (
            <PatternCard key={pattern.id} pattern={pattern} onWishlist={handleWishlist} />
          ))}
        </div>
      )}
    </div>
  )
}
