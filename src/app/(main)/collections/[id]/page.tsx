'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, X, Layers } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getLocalCollections, getResourcesForCollection, addResourceToCollection, removeResourceFromCollection, getLocalResources, type LocalCollection } from '@/lib/db/local-store'
import type { Resource } from '@/lib/types'
import ResourceGrid from '@/components/resources/ResourceGrid'
import EmptyState from '@/components/shared/EmptyState'
import { toast } from 'sonner'

export default function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [collection, setCollection] = useState<LocalCollection | null>(null)
  const [notes, setNotes] = useState<Resource[]>([])
  const [allResources, setAllResources] = useState<Resource[]>([])
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    const cols = getLocalCollections()
    const col = cols.find(c => c.id === id) || null
    setCollection(col)
    if (col) {
      setNotes(getResourcesForCollection(id))
      // 不在当前合集里的笔记
      setAllResources(getLocalResources().filter(r => !col.resourceIds.includes(r.id)))
    }
  }, [id])

  const refresh = () => {
    const col = getLocalCollections().find(c => c.id === id) || null
    setCollection(col)
    if (col) {
      setNotes(getResourcesForCollection(id))
      setAllResources(getLocalResources().filter(r => !col.resourceIds.includes(r.id)))
    }
  }

  if (!collection) {
    return (
      <div className="text-center py-20">
        <span className="text-5xl block mb-4">📚</span>
        <h1 className="text-xl font-bold mb-2">合集未找到</h1>
        <Link href="/collections" className="text-sm text-[var(--skin-primary)] hover:underline">返回合集列表</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link href="/collections" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="size-4" /> 合集列表
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{collection.title}</h1>
          {collection.description && (
            <p className="text-sm text-muted-foreground mt-1">{collection.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{notes.length} 篇笔记</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className={cn(buttonVariants({ size: 'sm' }), 'gap-1')}
        >
          <Plus className="size-4" /> 添加笔记
        </button>
      </div>

      {/* 添加笔记面板 */}
      {showAdd && allResources.length > 0 && (
        <div className="glass rounded-xl p-4 mb-6 animate-fade-in space-y-2 max-h-64 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-2">点击笔记添加到合集</p>
          {allResources.map(r => (
            <button
              key={r.id}
              onClick={() => {
                addResourceToCollection(id, r.id)
                toast.success(`已添加: ${r.title}`)
                refresh()
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/30 transition-colors text-sm flex items-center gap-2"
            >
              <Plus className="size-3.5 text-[var(--skin-primary)] shrink-0" />
              <span className="truncate">{r.title || '无标题'}</span>
            </button>
          ))}
        </div>
      )}
      {showAdd && allResources.length === 0 && (
        <div className="glass rounded-xl p-4 mb-6 text-center text-sm text-muted-foreground">
          所有笔记都已在此合集中
        </div>
      )}

      {/* 合集内的笔记 */}
      {notes.length === 0 ? (
        <EmptyState
          title="合集中还没有笔记"
          description="点击上方按钮添加笔记"
          icon={<Layers className="size-16" />}
          actionLabel=""
          actionHref=""
        />
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className="glass rounded-xl p-4 flex items-center gap-3 group">
              <Link href={`/resources/${note.id}`} className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate hover:text-[var(--skin-primary)] transition-colors">
                  {note.title || '无标题'}
                </p>
                {note.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{note.description}</p>
                )}
              </Link>
              <button
                onClick={() => {
                  removeResourceFromCollection(id, note.id)
                  toast.success('已移出合集')
                  refresh()
                }}
                className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
