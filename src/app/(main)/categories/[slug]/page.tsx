'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getLocalCategories, getLocalResourcesFiltered } from '@/lib/db/local-store'
import type { Category, Resource } from '@/lib/types'
import ResourceCard from '@/components/resources/ResourceCard'
import EmptyState from '@/components/shared/EmptyState'

export default function CategoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [category, setCategory] = useState<Category | null>(null)
  const [resources, setResources] = useState<Resource[]>([])

  useEffect(() => {
    const all = getLocalCategories()
    // 多重匹配：slug、名称、slug作为名称
    let cat = all.find(c => c.slug === slug) || all.find(c => c.name === slug) || all.find(c => c.slug === decodeURIComponent(slug)) || null
    setCategory(cat)
    if (cat) {
      const result = getLocalResourcesFiltered({ category: cat.slug, status: 'active', pageSize: 50 })
      setResources(result.data)
    }
  }, [slug])

  if (!category) {
    return <div className="text-center py-20 text-muted-foreground">分类未找到</div>
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link href="/categories" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="size-4" /> 全部分类
      </Link>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">{category.icon || '📂'}</span>
        <div>
          <h1 className="text-xl font-bold">{category.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{resources.length} 篇笔记</p>
        </div>
      </div>
      {resources.length === 0 ? (
        <EmptyState title="暂无笔记" description={`"${category.name}" 分类下还没有笔记`} />
      ) : (
        <div className="columns-2 lg:columns-3 gap-3" style={{ columnFill: 'balance' as any }}>
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
