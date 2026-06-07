'use client'

import { useState, useEffect } from 'react'
import { Plus, Layers, Sparkles } from 'lucide-react'
import { getLocalCollections, createLocalCollection, deleteLocalCollection, type LocalCollection } from '@/lib/db/local-store'
import CollectionCard from '@/components/collections/CollectionCard'
import { toast } from 'sonner'

export default function CollectionsPage() {
  const [collections, setCollections] = useState<LocalCollection[]>([])
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({})
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')

  useEffect(() => {
    const cols = getLocalCollections()
    setCollections(cols)
    try {
      const notes: any[] = JSON.parse(localStorage.getItem('minitu_notes') || '[]')
      const counts: Record<string, number> = {}
      cols.forEach(c => {
        counts[c.id] = notes.filter((n: any) => n.collectionId === c.id).length
      })
      setNoteCounts(counts)
    } catch {}
  }, [])

  const refresh = () => {
    const cols = getLocalCollections()
    setCollections(cols)
    try {
      const notes: any[] = JSON.parse(localStorage.getItem('minitu_notes') || '[]')
      const counts: Record<string, number> = {}
      cols.forEach(c => {
        counts[c.id] = notes.filter((n: any) => n.collectionId === c.id).length
      })
      setNoteCounts(counts)
    } catch {}
  }

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

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 page-enter">
      {/* Header — Editorial */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="section-number">CL</span>
            <div className="rule-thin w-8" style={{ background: 'var(--skin-border)' }} />
          </div>
          <h1 className="editorial-section-title" style={{ color: 'var(--skin-text)' }}>
            合集
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-4xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: 'var(--skin-primary)' }}>{collections.length}</span>
            <span className="text-xs tracking-[0.15em] uppercase text-[var(--skin-text-secondary)] font-bold">
              {collections.length === 0 ? '创建合集来归类你的笔记' : '个合集'}
            </span>
          </div>
        </div>
        <button onClick={() => setAdding(!adding)} className="btn">
          <Plus className="size-4" /> 新建
        </button>
      </div>

      {/* Create Form */}
      {adding && (
        <div className="card card-rounded-tr p-6 mb-8 space-y-4 animate-fade-in-scale">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="size-4" style={{ color: 'var(--skin-primary)' }} />
            <span className="text-xs font-extrabold tracking-wider uppercase" style={{ color: 'var(--skin-primary)' }}>新建合集</span>
          </div>
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="合集名称" className="input text-sm" autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <input
            value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="简短描述（可选）" className="input text-sm"
          />
          <div className="flex gap-3 justify-end">
            <button onClick={() => { setAdding(false); setTitle(''); setDesc('') }}
              className="btn btn-ghost btn-sm">取消</button>
            <button onClick={handleCreate} className="btn btn-sm">创建合集</button>
          </div>
        </div>
      )}

      {collections.length === 0 ? (
        <div className="text-center py-24">
          <Layers className="size-12 mx-auto mb-4 opacity-15" style={{ color: 'var(--skin-text-secondary)' }} />
          <p className="text-sm font-medium text-[var(--skin-text-secondary)] mb-4">还没有合集</p>
          <button onClick={() => setAdding(true)} className="btn">新建合集</button>
        </div>
      ) : (
        <div className="magazine-grid-3uneven">
          {collections.map(col => (
            <div key={col.id} className="relative group/col">
              <button
                onClick={() => handleDelete(col.id, col.title)}
                className="absolute top-3 right-3 p-2 rounded-lg opacity-0 group-hover/col:opacity-100 bg-red-500/80 hover:bg-red-500 text-white transition-all text-xs z-10 backdrop-blur-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
              </button>
              <CollectionCard collection={col} noteCount={noteCounts[col.id] || 0} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
