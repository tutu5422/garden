'use client'

import { useState, useCallback, useRef } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import SmartImage from '@/components/shared/SmartImage'
import type { Resource } from '@/lib/types'
import { getPatterns } from '@/lib/api/patterns-api'

interface PatternSearchProps {
  selectedIds: string[]
  onToggle: (patternId: string) => void
}

/**
 * 笔记编辑器中的「关联图解」搜索组件
 * 支持实时搜索、展示已选图解、最近使用提示
 */
export default function PatternSearch({ selectedIds, onToggle }: PatternSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Resource[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  // 缓存全量图解，避免每次按键都打 API
  const allPatternsRef = useRef<Resource[]>([])
  const loadedRef = useRef(false)

  const loadAll = useCallback(async () => {
    if (loadedRef.current) return
    setLoading(true)
    try {
      const all = await getPatterns()
      allPatternsRef.current = all
      loadedRef.current = true
    } catch {
      allPatternsRef.current = []
    } finally {
      setLoading(false)
    }
  }, [])

  const search = useCallback(async (q: string) => {
    setQuery(q)
    await loadAll()
    const all = allPatternsRef.current
    if (!q.trim()) {
      // 空查询时返回全部，确保已选图解 chip 始终可见
      setResults(all)
      return
    }
    const ql = q.toLowerCase()
    setResults(
      all.filter(
        (r) =>
          r.title.toLowerCase().includes(ql) ||
          ((r.metadata as Record<string, unknown>)?.patternBrand as string || '').toLowerCase().includes(ql),
      ),
    )
  }, [loadAll])

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(175,200,218,0.4)' }}>
      {/* 折叠标题 */}
      <button
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next && results.length === 0) void search('')
        }}
        className="w-full flex items-center justify-between p-3 text-sm font-semibold transition-colors"
        style={{ color: 'var(--foreground)', background: 'rgba(254,255,255,0.55)' }}
      >
        <span>🧶 关联图解 {selectedIds.length > 0 && `(${selectedIds.length})`}</span>
        <span className="text-xs opacity-60">{open ? '收起' : '展开'}</span>
      </button>

      {open && (
        <div className="p-3 space-y-3" style={{ background: 'rgba(254,255,255,0.3)' }}>
          {/* 已选图解 */}
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {results
                .filter((r) => selectedIds.includes(r.id))
                .map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--skin-primary)' }}
                  >
                    🧶 {p.title}
                    <button onClick={() => onToggle(p.id)} className="ml-0.5 hover:opacity-70">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
            </div>
          )}

          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5" style={{ color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              placeholder="搜索图解名称或品牌..."
              value={query}
              onChange={(e) => search(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(175,200,218,0.3)',
                color: 'var(--foreground)',
              }}
            />
            {loading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin" style={{ color: 'var(--skin-primary)' }} />}
          </div>

          {/* 搜索结果 */}
          {results.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {results.map((p) => {
                const meta = (p.metadata || {}) as Record<string, unknown>
                const isSelected = selectedIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => onToggle(p.id)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg transition-all text-left"
                    style={{
                      background: isSelected ? 'rgba(59,130,246,0.08)' : 'transparent',
                      border: isSelected ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
                    }}
                  >
                    {/* 封面小图 */}
                    <div className="size-10 rounded-lg overflow-hidden shrink-0" style={{ background: 'rgba(0,0,0,0.05)' }}>
                      {p.cover_image_url ? (
                        <SmartImage src={p.cover_image_url} alt="" width={40} height={40} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">🧶</div>
                      )}
                    </div>
                    {/* 信息 */}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>
                        {p.title}
                      </div>
                      <div className="text-[10px] truncate" style={{ color: 'var(--muted-foreground)' }}>
                        {(meta.patternBrand as string) || ''} · {(meta.patternDifficulty as string) || ''}
                      </div>
                    </div>
                    {/* 勾选标记 */}
                    <div
                      className="size-4 rounded border flex items-center justify-center shrink-0 transition-all"
                      style={{
                        borderColor: isSelected ? 'var(--skin-primary)' : 'rgba(175,200,218,0.5)',
                        background: isSelected ? 'var(--skin-primary)' : 'transparent',
                      }}
                    >
                      {isSelected && <span className="text-white text-[8px]">✓</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {query && !loading && results.length === 0 && (
            <p className="text-xs text-center py-2" style={{ color: 'var(--muted-foreground)' }}>
              未找到匹配的图解
            </p>
          )}
        </div>
      )}
    </div>
  )
}
