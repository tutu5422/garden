'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus, SlidersHorizontal, CheckSquare, X, Trash2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { getResourcesHybrid, deleteResourcesHybrid } from '@/lib/db/supabase-queries'
import { getLocalCategories, getLocalCollections, getLocalTags, getLocalResourcesFiltered } from '@/lib/db/local-store'
import type { Resource } from '@/lib/types'
import ResourceCard from './ResourceCard'
import ResourceFilters from './ResourceFilters'
import EmptyState from '@/components/shared/EmptyState'

const DEMO: Resource[] = [
  { id: 'demo-1', title: '欢迎来到秘密花园 🌿', description: '在这里记录你的兴趣爱好、学习心得和灵感碎片。点击"写笔记"开始吧！', resource_type: 'article', url: null, cover_image_url: null, author: null, rating: null, status: 'active', category_id: null, metadata: {}, pinned: false, created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z', user_id: 'demo', resource_tags: [{ tag: { id: 'dt1', name: '入门', slug: 'guide', color: null, created_at: '' } }] },
  { id: 'demo-2', title: '如何整理你的笔记', description: '使用分类和标签来组织笔记。每个笔记可以有封面图、正文和标签。试试用不同的皮肤配色来切换视觉效果。', resource_type: 'article', url: null, cover_image_url: null, author: null, rating: null, status: 'active', category_id: null, metadata: {}, pinned: false, created_at: '2025-01-02T00:00:00.000Z', updated_at: '2025-01-02T00:00:00.000Z', user_id: 'demo', resource_tags: [{ tag: { id: 'dt2', name: '教程', slug: 'tutorial', color: null, created_at: '' } }] },
]

export default function ResourcesContent() {
  const searchParams = useSearchParams()
  const [resources, setResources] = useState<Resource[]>(DEMO)
  const [count, setCount] = useState(DEMO.length)
  const [loading, setLoading] = useState(true)
  const [today, setToday] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const deletedIdsRef = useRef(deletedIds)
  deletedIdsRef.current = deletedIds

  useEffect(() => {
    getResourcesHybrid({
      category: searchParams.get('category') || undefined,
      collection: searchParams.get('collection') || undefined,
      tag: searchParams.get('tag') || undefined,
      sort: searchParams.get('sort') || 'newest',
      search: searchParams.get('search') || undefined,
      page: 1, pageSize: 50,
    }).then(result => {
      const filtered = result.data.filter(r => !deletedIds.has(r.id))
      if (filtered.length > 0) { setResources(filtered); setCount(result.count) }
      else { setResources(DEMO); setCount(DEMO.length) }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [searchParams])

  useEffect(() => {
    const refresh = () => {
      const r = getLocalResourcesFiltered({ status: 'active', pageSize: 50 })
      const filtered = r.data.filter(item => !deletedIdsRef.current.has(item.id))
      if (filtered.length > 0) { setResources(filtered); setCount(filtered.length) }
    }
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh) }
  }, [])

  // 日期在客户端初始化，避免 SSR hydration 不一致
  useEffect(() => {
    setToday(new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }))
  }, [])

  const catOptions = getLocalCategories().map(c => ({ name: c.name, slug: c.slug }))
  const colOptions = getLocalCollections().map(c => ({ name: c.title, slug: c.title }))
  const tagOptions = getLocalTags().map(t => ({ name: t.name, slug: t.slug }))

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header: right-aligned count + date, action buttons on left */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button onClick={() => { setSelectMode(!selectMode); setSelected(new Set()) }}
            className={cn(buttonVariants({ variant: selectMode ? 'default' : 'ghost', size: 'sm' }), 'gap-1')}>
            <CheckSquare className="size-4" /><span className="hidden sm:inline">{selectMode ? '取消' : '选择'}</span>
          </button>
          <Link href="/resources/new" className={cn(buttonVariants({ size: 'sm' }), 'gap-1')}>
            <Plus className="size-4" /><span className="hidden sm:inline">写笔记</span>
          </Link>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>共 {count} 篇笔记</p>
          <p className="text-xs text-muted-foreground">{today}</p>
        </div>
      </div>

      <div className="flex lg:hidden mb-4">
        <Sheet>
          <SheetTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}><SlidersHorizontal className="size-4" /> 筛选</SheetTrigger>
          <SheetContent side="right" className="w-64 pt-12">
            <SheetTitle className="sr-only">筛选</SheetTitle>
            <ResourceFilters categories={catOptions} collections={colOptions} tags={tagOptions} />
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex gap-6">
        <aside className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-20"><ResourceFilters categories={catOptions} collections={colOptions} tags={tagOptions} /></div>
        </aside>
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass rounded-2xl overflow-hidden"><div className="h-40 bg-white/10 animate-pulse" /><div className="p-3 space-y-2"><div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" /><div className="h-3 w-1/2 bg-white/10 rounded animate-pulse" /></div></div>
              ))}
            </div>
          ) : resources.length === 0 ? (
            <EmptyState title="还没有笔记" description="写你的第一篇笔记吧" />
          ) : (
            <div>
              {selectMode && <p className="text-xs text-muted-foreground mb-2">已选 {selected.size} 篇，点击卡片选择</p>}
              {selectMode ? (
                <div
                  className="waterfall"
                  style={{
                    columnCount: 2,
                    columnGap: '0.75rem',
                  }}
                >
                  {resources.map(r => (
                    <div key={r.id} style={{ breakInside: 'avoid', marginBottom: '0.75rem' }}>
                      <div onClick={() => { const next = new Set(selected); next.has(r.id) ? next.delete(r.id) : next.add(r.id); setSelected(next) }} className="cursor-pointer relative">
                        <div className="absolute top-2 left-2 z-10 size-5 rounded border-2 flex items-center justify-center"
                          style={{ borderColor: selected.has(r.id) ? 'var(--skin-primary)' : 'rgba(255,255,255,0.6)', background: selected.has(r.id) ? 'var(--skin-primary)' : 'transparent' }}>
                          {selected.has(r.id) && <span className="text-white text-xs">✓</span>}
                        </div>
                        <div className="pointer-events-none opacity-60"><ResourceCard resource={r} coverHeight={getWaterfallHeight(r)} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <WaterfallGrid resources={resources} />
              )}
            </div>
          )}

          {selectMode && selected.size > 0 && (
            <div className="fixed bottom-16 md:bottom-4 left-0 right-0 z-50 flex justify-center">
              <div className="glass-heavy rounded-2xl shadow-3d-lg px-5 py-3 flex items-center gap-3 mx-4">
                <span className="text-sm font-medium">已选 {selected.size} 篇</span>
                <button onClick={async () => {
                  if (!confirm(`确定删除 ${selected.size} 篇笔记？此操作不可恢复。`)) return
                  const ids = Array.from(selected)
                  try { await deleteResourcesHybrid(ids) } catch (e: any) { alert(e.message) }
                  setDeletedIds(new Set([...deletedIds, ...ids]))
                  setResources(resources.filter(r => !selected.has(r.id)))
                  setCount(count - ids.length)
                  setSelected(new Set()); setSelectMode(false)
                }} className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium text-white bg-destructive hover:bg-destructive/90"><Trash2 className="size-4" /> 删除</button>
                <button onClick={() => { setSelectMode(false); setSelected(new Set()) }} className="p-2 rounded-xl hover:bg-white/20"><X className="size-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ====== 瀑布流网格组件 ======

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function getWaterfallHeight(resource: Resource): number {
  const h = hashCode(resource.title)
  const hasCover = !!resource.cover_image_url
  const hasDesc = !!resource.description
  // 封面图：更高，带描述再加高
  if (hasCover && hasDesc) return [180, 200, 220, 240][h % 4]
  if (hasCover) return [160, 180, 200, 220][h % 4]
  if (hasDesc) return [120, 140, 160, 180][h % 4]
  return [90, 100, 110, 120][h % 4]
}

function WaterfallGrid({ resources }: { resources: Resource[] }) {
  return (
    <>
      <style>{`
        @media (min-width: 640px) {
          .waterfall { column-count: 2 !important; }
        }
        @media (min-width: 1024px) {
          .waterfall { column-count: 3 !important; }
        }
      `}</style>
      <div className="waterfall" style={{ columnCount: 1, columnGap: '0.75rem' }}>
        {resources.map((resource) => {
          const coverH = getWaterfallHeight(resource)
          return (
            <div key={resource.id} style={{ breakInside: 'avoid', marginBottom: '0.75rem' }}>
              <ResourceCard resource={resource} coverHeight={coverH} />
            </div>
          )
        })}
      </div>
    </>
  )
}
