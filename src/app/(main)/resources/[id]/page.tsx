'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ChevronLeft, Pencil, ExternalLink, Calendar } from 'lucide-react'
import { getResourceHybrid, getResourceCached } from '@/lib/db/cache-queries'
import { getLocalCategories } from '@/lib/db/local-store'
import type { Resource } from '@/lib/types'
import SmartImage from '@/components/shared/SmartImage'

export default function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  // 秒开：先用本地缓存
  const [resource, setResource] = useState<Resource | null>(() => getResourceCached(id))

  useEffect(() => {
    // 后台从 VPS 拉最新数据
    getResourceHybrid(id).then(r => { if (r) setResource(r) })
  }, [id])

  if (!resource) {
    return (
      <div className="text-center py-20">
        <span className="text-5xl block mb-4">🌿</span>
        <p className="text-muted-foreground">笔记未找到</p>
        <Link href="/resources" className="text-sm mt-4 inline-block" style={{ color: 'var(--skin-primary)' }}>返回首页</Link>
      </div>
    )
  }

  const tags = resource.resource_tags?.map(rt => rt.tag) || []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      {/* 返回 */}
      <Link href="/resources" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ChevronLeft className="size-4" /> 返回
      </Link>

      {/* 封面图 */}
      {resource.cover_image_url && (
        <div className="rounded-2xl overflow-hidden glass shadow-3d mb-6 relative h-72">
          <SmartImage
            src={resource.cover_image_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 800px"
            className="object-cover"
          />
        </div>
      )}

      {/* 标题 */}
      <h1 className="text-xl font-bold mb-3 text-foreground">{resource.title || '无标题'}</h1>

      {/* 元信息 */}
      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Calendar className="size-3" />
          {new Date(resource.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
        {resource.category_id && (() => {
          const cat = getLocalCategories().find(c => c.id === resource.category_id)
          return cat ? <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{cat.icon} {cat.name}</span> : null
        })()}
      </div>

      {/* 正文 */}
      {resource.description && (
        <div className="glass rounded-2xl p-5 shadow-3d mb-6">
          <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{resource.description}</p>
        </div>
      )}

      {/* 标签 */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {tags.map(tag => (
            <span key={tag.id} className="px-3 py-1 rounded-full text-xs bg-primary/10 text-primary">{tag.name}</span>
          ))}
        </div>
      )}

      {/* 按钮 */}
      <div className="flex gap-3 pt-4">
        <Link href={`/resources/${resource.id}/edit`}
          className="flex-1 py-3 rounded-xl text-center text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2">
          <Pencil className="size-4" /> 编辑
        </Link>
        {resource.url && (
          <a href={resource.url} target="_blank" rel="noopener"
            className="flex-1 py-3 rounded-xl text-center text-sm font-medium text-white hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg"
            style={{ background: 'var(--skin-primary)' }}>
            <ExternalLink className="size-4" /> 访问链接
          </a>
        )}
      </div>
    </div>
  )
}
