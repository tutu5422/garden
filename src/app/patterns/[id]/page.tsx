'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
} from 'lucide-react'
import Link from 'next/link'
import SmartImage from '@/components/shared/SmartImage'
import PatternTimeline from '@/components/patterns/PatternTimeline'
import BgmSelector from '@/components/patterns/BgmSelector'
import type { Resource } from '@/lib/types'

export default function PatternDetailPage() {
  const params = useParams()
  const router = useRouter()
  const patternId = params.id as string

  const [pattern, setPattern] = useState<Resource | null>(null)
  const [notes, setNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 本地模式
      const localRaw = localStorage.getItem('garden_resources')
      if (localRaw) {
        const all: Resource[] = JSON.parse(localRaw)
        const p = all.find((r) => r.id === patternId && (r.metadata as any)?.is_pattern)
        if (p) setPattern(p)
      }

      // 尝试从服务端获取关联笔记
      const localNotes = localStorage.getItem('garden_notes')
      if (localNotes) {
        const allNotes: any[] = JSON.parse(localNotes)
        const pnRaw = localStorage.getItem('garden_pattern_notes')
        const links = pnRaw ? JSON.parse(pnRaw) : []
        const noteIds = links
          .filter((l: any) => l.pattern_id === patternId)
          .map((l: any) => l.note_id)
        const matched = allNotes
          .filter((n: any) => noteIds.includes(n.id))
          .sort(
            (a: any, b: any) =>
              new Date(b.created_at || b.createdAt).getTime() -
              new Date(a.created_at || a.createdAt).getTime(),
          )
        setNotes(matched)
      }
    } catch (e) {
      console.error('加载图解详情失败:', e)
    } finally {
      setLoading(false)
    }
  }, [patternId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const meta = (pattern?.metadata || {}) as Record<string, unknown>

  // 状态标签
  const status = (meta.patternStatus as string) || 'not-started'
  const progress = (meta.patternProgress as number) || 0
  const brand = (meta.patternBrand as string) || ''
  const yarn = (meta.patternYarn as string) || ''
  const difficulty = (meta.patternDifficulty as string) || ''
  const patternType = (meta.patternType as string[]) || []
  const craftType = (meta.patternCraftType as string) || ''
  const pages = (meta.patternPages as number) || 0
  const bgmTrackId = meta.patternBgmTrackId as string | undefined
  const bgmTrackTitle = meta.patternBgmTrackTitle as string | undefined
  const bgmTrackArtist = meta.patternBgmTrackArtist as string | undefined

  const difficultyStars: Record<string, string> = {
    beginner: '★☆☆☆☆',
    easy: '★★☆☆☆',
    intermediate: '★★★☆☆',
    advanced: '★★★★☆',
    expert: '★★★★★',
  }
  const difficultyLabels: Record<string, string> = {
    beginner: '初学',
    easy: '简单',
    intermediate: '中级',
    advanced: '高级',
    expert: '大师',
  }

  const statusLabel: Record<string, string> = {
    'not-started': '未开始',
    'in-progress': '进行中',
    completed: '已完成',
    paused: '暂停',
    abandoned: '放弃',
    wishlist: '❤️ 心愿单',
  }

  const handleNewNote = () => {
    router.push(`/notes/new?patternId=${patternId}`)
  }

  const handleBgmSelect = (trackId: string, title: string, artist?: string) => {
    // 更新本地存储
    const localRaw = localStorage.getItem('garden_resources')
    if (localRaw && pattern) {
      const all: Resource[] = JSON.parse(localRaw)
      const idx = all.findIndex((r) => r.id === patternId)
      if (idx !== -1) {
        const m = (all[idx].metadata || {}) as any
        m.patternBgmTrackId = trackId
        m.patternBgmTrackTitle = title
        m.patternBgmTrackArtist = artist || ''
        all[idx].metadata = m
        all[idx].updated_at = new Date().toISOString()
        localStorage.setItem('garden_resources', JSON.stringify(all))
        setPattern(all[idx])
        // 同步完整资源到服务端
        void fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'resources', action: 'upsert', data: all[idx] }),
        }).catch(() => {})
      }
    }
  }

  const handleBgmRemove = () => {
    const localRaw = localStorage.getItem('garden_resources')
    if (localRaw && pattern) {
      const all: Resource[] = JSON.parse(localRaw)
      const idx = all.findIndex((r) => r.id === patternId)
      if (idx !== -1) {
        const m = (all[idx].metadata || {}) as any
        delete m.patternBgmTrackId
        delete m.patternBgmTrackTitle
        delete m.patternBgmTrackArtist
        all[idx].metadata = m
        all[idx].updated_at = new Date().toISOString()
        localStorage.setItem('garden_resources', JSON.stringify(all))
        setPattern(all[idx])
        // 同步完整资源到服务端
        void fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'resources', action: 'upsert', data: all[idx] }),
        }).catch(() => {})
      }
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="rounded-2xl" style={{ height: '300px', background: 'rgba(175,200,218,0.1)' }} />
          <div className="h-6 w-1/2 rounded" style={{ background: 'rgba(175,200,218,0.1)' }} />
          <div className="h-4 w-3/4 rounded" style={{ background: 'rgba(175,200,218,0.1)' }} />
        </div>
      </div>
    )
  }

  if (!pattern) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
          图解不存在或已被删除
        </p>
        <Link
          href="/patterns"
          className="text-sm font-medium"
          style={{ color: 'var(--skin-primary)' }}
        >
          ← 返回织集
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      {/* 返回 */}
      <Link
        href="/patterns"
        className="inline-flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ArrowLeft className="size-3.5" />
        返回织集
      </Link>

      {/* 封面大图 */}
      <div className="relative rounded-2xl overflow-hidden" style={{ height: '40vh', minHeight: '300px' }}>
        {pattern.cover_image_url ? (
          <SmartImage
            src={pattern.cover_image_url}
            alt={pattern.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 800px"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, var(--skin-primary), color-mix(in srgb, var(--skin-primary) 60%, var(--skin-background)))`,
            }}
          >
            <span className="text-8xl opacity-30" style={{ color: '#fff' }}>🧶</span>
          </div>
        )}
        {/* 底部渐变遮罩 + 标题 */}
        <div
          className="absolute inset-x-0 bottom-0 p-6"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
          }}
        >
          <h1
            className="text-2xl md:text-3xl font-black tracking-wider"
            style={{ color: '#fff', textShadow: '0 2px 20px rgba(0,0,0,0.3)' }}
          >
            {pattern.title}
          </h1>
        </div>
      </div>

      {/* 操作按钮行 */}
      <div className="flex flex-wrap gap-2">
        {/* 预览PDF */}
        {pattern.url && (
          <a
            href={pattern.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
            style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--skin-primary)' }}
          >
            <ExternalLink className="size-3.5" />
            预览 PDF
          </a>
        )}
        {/* 下载 */}
        {pattern.url && (
          <a
            href={pattern.url}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
            style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}
          >
            <Download className="size-3.5" />
            下载
          </a>
        )}
        {/* 记录笔记 */}
        <button
          onClick={handleNewNote}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
          style={{ background: 'var(--skin-primary)', color: '#fff' }}
        >
          <FileText className="size-3.5" />
          记录笔记
        </button>
      </div>

      {/* 元数据卡片 */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{
          background: 'rgba(254,255,255,0.55)',
          border: '1px solid rgba(175,200,218,0.4)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* 状态 + 进度 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
              {statusLabel[status] || status}
            </span>
            {status === 'in-progress' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}>
                {progress}%
              </span>
            )}
          </div>
        </div>
        {/* 进度条 */}
        {status === 'in-progress' && (
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.05)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--skin-primary), var(--skin-accent))',
              }}
            />
          </div>
        )}

        {/* 元数据网格 */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {brand && (
            <div>
              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>品牌</span>
              <p className="font-medium" style={{ color: 'var(--foreground)' }}>{brand}</p>
            </div>
          )}
          {difficulty && (
            <div>
              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>难度</span>
              <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                {difficultyStars[difficulty] || ''} {difficultyLabels[difficulty] || ''}
              </p>
            </div>
          )}
          {yarn && (
            <div>
              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>线材</span>
              <p className="font-medium" style={{ color: 'var(--foreground)' }}>{yarn}</p>
            </div>
          )}
          {craftType && (
            <div>
              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>编织方式</span>
              <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                {craftType === 'knit' ? '棒针' : craftType === 'crochet' ? '钩针' : '棒针/钩针'}
              </p>
            </div>
          )}
          {pages > 0 && (
            <div>
              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>页数</span>
              <p className="font-medium" style={{ color: 'var(--foreground)' }}>{pages} 页</p>
            </div>
          )}
          {patternType.length > 0 && (
            <div className="col-span-2">
              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>类型</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {patternType.map((t: string) => (
                  <span
                    key={t}
                    className="px-1.5 py-0.5 rounded text-[10px]"
                    style={{ background: 'rgba(59,130,246,0.08)', color: 'var(--muted-foreground)' }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BGM 区域（可选功能） */}
      <div className="space-y-2">
        <BgmSelector
          currentTrackId={bgmTrackId}
          currentTrackTitle={bgmTrackTitle}
          currentTrackArtist={bgmTrackArtist}
          onSelect={handleBgmSelect}
          onRemove={handleBgmRemove}
        />
      </div>

      {/* 关联笔记时间线 */}
      <div>
        <h2 className="text-base font-black tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          <span>📝 编织笔记</span>
          <span className="text-xs font-normal" style={{ color: 'var(--muted-foreground)' }}>
            ({notes.length} 篇)
          </span>
        </h2>
        <PatternTimeline notes={notes} onNewNote={handleNewNote} />
      </div>
    </div>
  )
}
