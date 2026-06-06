'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, Eye, EyeOff, FileText, Image, BookOpen, Film, Wrench, Link as LinkIcon, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getResourcesHybrid } from '@/lib/db/supabase-queries'
import { getLocalResources, getLocalResourcesFiltered } from '@/lib/db/local-store'
import type { Resource } from '@/lib/types'
import { RESOURCE_TYPE_LABELS } from '@/lib/constants/navigation'

function isSupabaseReady() { const url = process.env.NEXT_PUBLIC_SUPABASE_URL; return url && !url.includes('placeholder') }

const typeIcons: Record<string, React.ReactNode> = {
  link: <LinkIcon className="size-3.5" />,
  image: <Image className="size-3.5" />,
  book: <BookOpen className="size-3.5" />,
  movie: <Film className="size-3.5" />,
  tool: <Wrench className="size-3.5" />,
  article: <FileText className="size-3.5" />,
  other: <Package className="size-3.5" />,
}

// 按日期分组
interface DayGroup {
  date: string
  label: string
  resources: Resource[]
}

function groupByDate(resources: Resource[]): DayGroup[] {
  const map = new Map<string, Resource[]>()
  resources.forEach(r => {
    const d = new Date(r.created_at).toISOString().slice(0, 10)
    if (!map.has(d)) map.set(d, [])
    map.get(d)!.push(r)
  })
  const groups: DayGroup[] = []
  map.forEach((items, date) => {
    const d = new Date(date)
    const today = new Date()
    const diff = Math.floor((today.getTime() - d.getTime()) / 86400000)
    let label: string
    if (diff === 0) label = '今天'
    else if (diff === 1) label = '昨天'
    else if (diff < 7) label = `${diff}天前`
    else label = d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
    groups.push({ date, label, resources: items })
  })
  groups.sort((a, b) => b.date.localeCompare(a.date))
  return groups
}

export default function TimelinePage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [hideNotes, setHideNotes] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isSupabaseReady()) {
          const result = await getResourcesHybrid({ sort: 'newest', pageSize: 200 })
          setResources(result.data || [])
        } else {
          const local = getLocalResources()
          setResources(local)
        }
      } catch {
        // fallback
        const local = getLocalResources()
        setResources(local)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const filtered = hideNotes
    ? resources.filter(r => r.resource_type !== 'article')
    : resources
  const groups = groupByDate(filtered)

  const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center size-10 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, var(--skin-primary), color-mix(in srgb, var(--skin-primary) 50%, var(--skin-background)))',
              boxShadow: '0 2px 12px rgba(71,112,155,0.15)',
            }}
          >
            <Calendar className="size-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{today}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filtered.length} 条记录
            </p>
          </div>
        </div>
        {/* 隐藏笔记开关 */}
        <button
          onClick={() => setHideNotes(!hideNotes)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300',
            hideNotes
              ? 'bg-primary/10 text-primary'
              : 'bg-white/40 text-muted-foreground hover:bg-white/60'
          )}
          style={{
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(175,200,218,0.3)',
          }}
        >
          {hideNotes ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {hideNotes ? '已隐藏笔记' : '隐藏笔记'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 animate-pulse">
              <div className="h-5 w-24 bg-white/10 rounded" />
              <div className="h-24 bg-white/5 rounded-2xl" />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="size-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">还没有任何记录</p>
          <Link
            href="/resources/new"
            className="inline-block mt-4 text-sm font-medium hover:underline"
            style={{ color: 'var(--skin-primary)' }}
          >
            写第一篇笔记 →
          </Link>
        </div>
      ) : (
        <div className="relative">
          {/* 时间线竖线 */}
          <div
            className="absolute left-5 top-2 bottom-2 w-px"
            style={{ background: 'linear-gradient(to bottom, var(--skin-primary), transparent)' }}
          />

          <div className="space-y-8">
            {groups.map(group => (
              <div key={group.date}>
                {/* 日期标签 */}
                <div className="flex items-center gap-3 mb-3 pl-5">
                  <div className="relative flex items-center justify-center">
                    <div
                      className="size-2.5 rounded-full ring-2 ring-white/60 z-10"
                      style={{ backgroundColor: 'var(--skin-primary)' }}
                    />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {group.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {group.resources.length} 条
                  </span>
                </div>

                {/* 当天条目 */}
                <div className="space-y-2 pl-11">
                  {group.resources.map(resource => (
                    <Link
                      key={resource.id}
                      href={`/resources/${resource.id}`}
                      className="group block"
                    >
                      <article
                        className="flex gap-3 p-3 rounded-2xl transition-all duration-300 hover:scale-[1.01]"
                        style={{
                          background: 'rgba(254, 255, 255, 0.4)',
                          backdropFilter: 'blur(16px) saturate(160%)',
                          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
                          border: '1px solid rgba(175, 200, 218, 0.25)',
                          boxShadow: '0 2px 8px rgba(71, 112, 155, 0.04)',
                        }}
                      >
                        {/* 缩略图 */}
                        <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden">
                          {resource.cover_image_url ? (
                            <img
                              src={resource.cover_image_url}
                              alt={resource.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              loading="lazy"
                              onError={(e) => {
                                // 图片加载失败时显示彩色占位
                                (e.target as HTMLImageElement).style.display = 'none'
                                const parent = (e.target as HTMLImageElement).parentElement
                                if (parent) {
                                  parent.style.background = `linear-gradient(135deg, var(--skin-primary), color-mix(in srgb, var(--skin-primary) 40%, var(--skin-background)))`
                                  parent.innerHTML = `<div class="flex items-center justify-center w-full h-full"><span style="color:white;opacity:0.5;font-size:1.2rem">${'📄'}</span></div>`
                                }
                              }}
                            />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center"
                              style={{
                                background: `linear-gradient(135deg, var(--skin-primary), color-mix(in srgb, var(--skin-primary) 40%, var(--skin-background)))`,
                              }}
                            >
                              <span className="text-lg text-white/40">
                                {typeIcons[resource.resource_type]}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 内容 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white/90"
                              style={{
                                background: `color-mix(in srgb, var(--skin-primary) 70%, transparent)`,
                              }}
                            >
                              {typeIcons[resource.resource_type]}
                              {RESOURCE_TYPE_LABELS[resource.resource_type]}
                            </span>
                            {resource.category && (
                              <span className="text-[10px] text-muted-foreground">
                                {resource.category.name}
                              </span>
                            )}
                          </div>
                          <h4
                            className="text-sm font-medium line-clamp-1 group-hover:opacity-70 transition-opacity"
                            style={{ color: 'var(--foreground)' }}
                          >
                            {resource.title}
                          </h4>
                          {resource.description && (
                            <p className="text-xs line-clamp-1 mt-0.5 text-muted-foreground">
                              {resource.description}
                            </p>
                          )}
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
