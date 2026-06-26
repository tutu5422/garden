'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Heart } from 'lucide-react'
import PatternCard from '@/components/patterns/PatternCard'
import type { Resource } from '@/lib/types'

const STATUS_FILTERS = [
  { label: '全部', value: '' },
  { label: '❤️ 心愿单', value: 'wishlist' },
  { label: '未开始', value: 'not-started' },
  { label: '进行中', value: 'in-progress' },
  { label: '已完成', value: 'completed' },
  { label: '暂停', value: 'paused' },
]

const DIFFICULTY_FILTERS = [
  { label: '全部难度', value: '' },
  { label: '★ 初学', value: 'beginner' },
  { label: '★★ 简单', value: 'easy' },
  { label: '★★★ 中级', value: 'intermediate' },
  { label: '★★★★ 高级', value: 'advanced' },
  { label: '★★★★★ 大师', value: 'expert' },
]

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<Resource[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 12

  const loadPatterns = useCallback(async () => {
    setLoading(true)
    try {
      // 图解数据存储在 localStorage（garden_resources），客户端过滤
      const localRaw = localStorage.getItem('garden_resources')
      if (localRaw) {
        let all: Resource[] = JSON.parse(localRaw)
        all = all.filter((r) => (r.metadata as any)?.is_pattern)

        if (statusFilter) {
          all = all.filter((r) => (r.metadata as any)?.patternStatus === statusFilter)
        }
        if (difficultyFilter) {
          all = all.filter((r) => (r.metadata as any)?.patternDifficulty === difficultyFilter)
        }
        if (search) {
          const q = search.toLowerCase()
          all = all.filter(
            (r) =>
              r.title.toLowerCase().includes(q) ||
              ((r.metadata as any)?.patternBrand || '').toLowerCase().includes(q),
          )
        }

        all.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
        setCount(all.length)
        setPatterns(all.slice((page - 1) * pageSize, page * pageSize))
      } else {
        setCount(0)
        setPatterns([])
      }
    } catch (e) {
      console.error('加载图解列表失败:', e)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, difficultyFilter, page])

  useEffect(() => {
    loadPatterns()
  }, [loadPatterns])

  // 心愿单切换
  const handleWishlist = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'wishlist' ? 'not-started' : 'wishlist'
    let updated: Resource | null = null
    // 更新本地存储
    const localRaw = localStorage.getItem('garden_resources')
    if (localRaw) {
      const all: Resource[] = JSON.parse(localRaw)
      const idx = all.findIndex((r) => r.id === id)
      if (idx !== -1) {
        const meta = (all[idx].metadata || {}) as any
        meta.patternStatus = newStatus
        meta.patternLastUsedAt = new Date().toISOString()
        all[idx].metadata = meta
        all[idx].updated_at = new Date().toISOString()
        localStorage.setItem('garden_resources', JSON.stringify(all))
        updated = all[idx]
        loadPatterns()
      }
    }
    // 同步完整资源到服务端（避免只发部分 metadata 覆盖掉其它 pattern 字段）
    if (updated) {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'resources',
            action: 'upsert',
            data: updated,
          }),
        })
      } catch {}
    }
  }

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <div
          className="size-10 rounded-xl flex items-center justify-center text-lg"
          style={{ background: 'rgba(59,130,246,0.1)' }}
        >
          🧶
        </div>
        <div>
          <h1 className="text-xl font-black tracking-wider" style={{ color: 'var(--foreground)' }}>
            织集
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {count > 0 ? `${count} 个编织图解` : '你的编织作品集'}
          </p>
        </div>
        {/* 心愿单快捷入口 */}
        <a
          href="/patterns/wishlist"
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
          style={{ background: 'rgba(236,72,153,0.1)', color: '#EC4899' }}
        >
          <Heart className="size-3.5" />
          心愿单
        </a>
      </div>

      {/* 搜索栏 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4" style={{ color: 'var(--muted-foreground)' }} />
        <input
          type="text"
          placeholder="搜索图解名称、品牌..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
          style={{
            background: 'rgba(254,255,255,0.55)',
            border: '1px solid rgba(175,200,218,0.3)',
            color: 'var(--foreground)',
            backdropFilter: 'blur(12px)',
          }}
        />
      </div>

      {/* 筛选行 */}
      <div className="flex flex-wrap gap-2">
        {/* 状态筛选 */}
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1) }}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: statusFilter === f.value ? 'var(--skin-primary)' : 'rgba(254,255,255,0.55)',
                color: statusFilter === f.value ? '#fff' : 'var(--muted-foreground)',
                border: statusFilter === f.value ? 'none' : '1px solid rgba(175,200,218,0.3)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        {/* 难度筛选 */}
        <select
          value={difficultyFilter}
          onChange={(e) => { setDifficultyFilter(e.target.value); setPage(1) }}
          className="px-2.5 py-1 rounded-full text-xs font-medium outline-none"
          style={{
            background: 'rgba(254,255,255,0.55)',
            color: difficultyFilter ? 'var(--foreground)' : 'var(--muted-foreground)',
            border: '1px solid rgba(175,200,218,0.3)',
          }}
        >
          {DIFFICULTY_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* 图解卡片网格 */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl animate-pulse"
              style={{ height: '320px', background: 'rgba(175,200,218,0.1)' }}
            />
          ))}
        </div>
      ) : patterns.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🧶</div>
          <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
            {search || statusFilter || difficultyFilter ? '没有匹配的图解' : '还没有图解，开始上传你的第一个编织图解吧'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {patterns.map((pattern) => (
              <PatternCard
                key={pattern.id}
                pattern={pattern}
                onWishlist={handleWishlist}
              />
            ))}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30"
                style={{ background: 'rgba(254,255,255,0.55)', border: '1px solid rgba(175,200,218,0.3)' }}
              >
                上一页
              </button>
              <span className="px-3 py-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30"
                style={{ background: 'rgba(254,255,255,0.55)', border: '1px solid rgba(175,200,218,0.3)' }}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
