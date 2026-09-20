'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getLocalTags, getLocalResourcesFiltered } from '@/lib/db/local-store'
import type { Tag, Resource } from '@/lib/types'
import ResourceCard from '@/components/resources/ResourceCard'
import EmptyState from '@/components/shared/EmptyState'

export default function TagDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [tag, setTag] = useState<Tag | null>(null)
  const [resources, setResources] = useState<Resource[]>([])

  useEffect(() => {
    // 标签/资源都来自浏览器本地库，只能在挂载后读取（渲染期读取会与 SSR 输出不一致）；
    // 放到微任务里更新 state，避免在 effect 提交阶段同步 setState 触发级联渲染
    void Promise.resolve().then(() => {
      const all = getLocalTags()
      const t = all.find(t => t.slug === slug) || all.find(t => t.name === slug) || all.find(t => t.slug === decodeURIComponent(slug)) || null
      setTag(t)
      if (t) {
        const result = getLocalResourcesFiltered({ tag: t.slug, status: 'active', pageSize: 50 })
        setResources(result.data)
      }
    })
  }, [slug])

  if (!tag) {
    return <div className="text-center py-20 text-muted-foreground">标签未找到</div>
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link href="/tags" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="size-4" /> 全部标签
      </Link>
      <h1 className="text-xl font-bold mb-4">🏷️ {tag.name}</h1>
      <p className="text-sm text-muted-foreground mb-6">{resources.length} 篇笔记</p>
      {resources.length === 0 ? (
        <EmptyState title="暂无笔记" description={`标签 "${tag.name}" 下还没有笔记`} />
      ) : (
        <div className="columns-2 lg:columns-3 gap-3" style={{ columnFill: 'balance' }}>
          {resources.map(r => (
            <div key={r.id} className="mb-3" style={{ breakInside: 'avoid' }}>
              <ResourceCard resource={r} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
