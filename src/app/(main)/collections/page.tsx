'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Layers, Sparkles } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getLocalCollections, createLocalCollection, deleteLocalCollection, getLocalResources, type LocalCollection } from '@/lib/db/local-store'
import CollectionCard from '@/components/collections/CollectionCard'
import EmptyState from '@/components/shared/EmptyState'
import { toast } from 'sonner'

export default function CollectionsPage() {
  const [collections, setCollections] = useState<LocalCollection[]>([])
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')

  useEffect(() => { setCollections(getLocalCollections()) }, [])

  const refresh = () => setCollections(getLocalCollections())

  const handleCreate = () => {
    if (!title.trim()) { toast.error('请输入合集名称'); return }
    if (getLocalCollections().some(c => c.title === title.trim())) { toast.error('合集已存在'); return }
    createLocalCollection(title.trim(), desc.trim())
    toast.success('合集已创建')
    setTitle(''); setDesc(''); setAdding(false)
    refresh()
  }

  const handleDelete = (id: string, name: string) => {
    deleteLocalCollection(id)
    toast.success(`"${name}" 已删除`)
    refresh()
  }

  const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
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
            <Layers className="size-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{today}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {collections.length === 0 ? '创建合集来归类你的笔记' : `${collections.length} 个合集`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5 rounded-full')}
        >
          <Plus className="size-4" /> 新建
        </button>
      </div>

      {/* 新建表单 */}
      {adding && (
        <div
          className="rounded-2xl p-5 mb-6 space-y-3 animate-fade-in"
          style={{
            background: 'rgba(254, 255, 255, 0.5)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(175, 200, 218, 0.35)',
            boxShadow: '0 2px 12px rgba(71, 112, 155, 0.06)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="size-4" style={{ color: 'var(--skin-primary)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>新建合集</span>
          </div>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="合集名称"
            className="h-10 text-sm"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            style={{
              background: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(175, 200, 218, 0.3)',
            }}
          />
          <Input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="简短描述（可选）"
            className="h-10 text-sm"
            style={{
              background: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(175, 200, 218, 0.3)',
            }}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setTitle(''); setDesc('') }}
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
              取消
            </button>
            <button onClick={handleCreate}
              className={cn(buttonVariants({ size: 'sm' }), 'rounded-full')}>
              创建合集
            </button>
          </div>
        </div>
      )}

      {collections.length === 0 ? (
        <EmptyState
          title="还没有合集"
          description="将笔记按主题整理成合集，构建你的知识花园"
          actionLabel="新建合集"
          onAction={() => setAdding(true)}
          icon={<Layers className="size-16" />}
        />
      ) : (
        <div
          className="waterfall-collections"
          style={{
            columnCount: 1,
            columnGap: '0.75rem',
          }}
        >
          <style>{`
            @media (min-width: 640px) {
              .waterfall-collections { column-count: 2 !important; }
            }
            @media (min-width: 1024px) {
              .waterfall-collections { column-count: 3 !important; }
            }
          `}</style>
          {collections.map(col => (
            <div key={col.id} className="relative group/col" style={{ breakInside: 'avoid', marginBottom: '0.75rem' }}>
              <CollectionCard collection={col} noteCount={col.resourceIds.length} />
              <button
                onClick={() => handleDelete(col.id, col.title)}
                className="absolute top-2 right-2 p-1.5 rounded-full opacity-0 group-hover/col:opacity-100 hover:text-red-500 transition-all text-xs z-10"
                style={{
                  background: 'rgba(255,255,255,0.7)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(175,200,218,0.3)',
                }}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
