'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Settings2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getLocalTags } from '@/lib/db/local-store'
import TagManager from '@/components/tags/TagManager'
import type { Tag } from '@/lib/types'

function isSupabaseReady() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return url && !url.includes('placeholder')
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [showManager, setShowManager] = useState(false)
  const maxCount = 1

  useEffect(() => { loadTags() }, [])

  const loadTags = async () => {
    const local = getLocalTags()
    if (isSupabaseReady()) {
      try {
        const supabase = createClient()
        const { data } = await supabase.from('tags').select('*').order('name')
        const cloud = (data || []) as unknown as Tag[]
        const cloudNames = new Set(cloud.map(t => t.name))
        const localOnly = local.filter(t => !cloudNames.has(t.name))
        setTags([...cloud, ...localOnly])
        return
      } catch {}
    }
    setTags(local)
  }

  const refresh = () => loadTags()

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--skin-primary)' }}>
          标签
        </h1>
        <button
          onClick={() => setShowManager(!showManager)}
          className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors flex items-center gap-1"
        >
          <Settings2 className="size-3" />
          管理
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">通过标签发现笔记</p>

      {/* 折叠管理区 */}
      {showManager && (
        <div className="mb-6 animate-fade-in">
          <TagManager initialTags={tags} onRefresh={refresh} />
        </div>
      )}

      {/* 标签云 */}
      {tags.length > 0 && (
        <div className="glass rounded-2xl shadow-3d p-8">
          <div className="flex flex-wrap gap-3 justify-center">
            {tags.map((tag, i) => (
              <Link
                key={tag.id}
                href={`/tags/${tag.slug}`}
                style={{ animationDelay: `${i * 50}ms` }}
                className="animate-fade-in-up"
              >
                <Badge
                  variant="secondary"
                  className="cursor-pointer glass shadow-sm hover:shadow-3d transition-all duration-300 hover:scale-110 px-3 py-1.5"
                >
                  {tag.name}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
