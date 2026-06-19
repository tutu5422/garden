'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, X, Layers, FileText, ExternalLink, BookOpen, ImageIcon, Film, Wrench, Pencil, Check } from 'lucide-react'
import { getLocalCollections, updateLocalCollection, type LocalCollection } from '@/lib/db/local-store'
import { toast } from 'sonner'

interface GardenNote {
  id: string; title: string; content: string; type: string; tags: string[]
  collectionId?: string; collectionName?: string
  createdAt: string; image?: string; imageThumb?: string
}

const typeIcons: Record<string, any> = { link: ExternalLink, image: ImageIcon, book: BookOpen, movie: Film, tool: Wrench, article: FileText }
const typeLabels: Record<string, string> = { link: "链接", image: "图片", book: "书籍", movie: "影视", tool: "工具", article: "文章" }

export default function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [collection, setCollection] = useState<LocalCollection | null>(null)
  const [collectionNotes, setCollectionNotes] = useState<GardenNote[]>([])
  const [allNotes, setAllNotes] = useState<GardenNote[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const loadData = () => {
    const cols = getLocalCollections()
    const col = cols.find(c => c.id === id) || null
    setCollection(col)

    let notes: GardenNote[] = []
    try { notes = JSON.parse(localStorage.getItem('minitu_notes') || '[]') } catch {}

    const mine = notes.filter(n => n.collectionId === id)
    setCollectionNotes(mine)
    setAllNotes(notes.filter(n => n.collectionId !== id))
  }

  useEffect(() => { loadData() }, [id])

  const startEdit = () => {
    setEditTitle(collection?.title || '')
    setEditDesc(collection?.description || '')
    setEditing(true)
  }

  const saveEdit = () => {
    if (!editTitle.trim()) { toast.error('合集名称不能为空'); return }
    updateLocalCollection(id, { title: editTitle.trim(), description: editDesc.trim() })
    // 同步更新所有相关笔记的 collectionName
    try {
      let notes: GardenNote[] = JSON.parse(localStorage.getItem('minitu_notes') || '[]')
      notes = notes.map(n =>
        n.collectionId === id ? { ...n, collectionName: editTitle.trim() } : n
      )
      localStorage.setItem('minitu_notes', JSON.stringify(notes))
      // 同步 garden_collections
      const cols = JSON.parse(localStorage.getItem('garden_collections') || '[]')
      const updated = cols.map((c: any) =>
        c.id === id ? { ...c, title: editTitle.trim() } : c
      )
      localStorage.setItem('garden_collections', JSON.stringify(updated))
    } catch {}
    toast.success('合集已更新')
    setEditing(false)
    loadData()
  }

  const cancelEdit = () => setEditing(false)

  const addToCollection = (noteId: string, title: string) => {
    let notes: GardenNote[] = []
    try { notes = JSON.parse(localStorage.getItem('minitu_notes') || '[]') } catch {}
    const col = getLocalCollections().find(c => c.id === id)
    const updated = notes.map(n =>
      n.id === noteId ? { ...n, collectionId: id, collectionName: col?.title } : n
    )
    localStorage.setItem('minitu_notes', JSON.stringify(updated))
    toast.success(`已添加: ${title}`)
    loadData()
  }

  const removeFromCollection = (noteId: string, title: string) => {
    let notes: GardenNote[] = []
    try { notes = JSON.parse(localStorage.getItem('minitu_notes') || '[]') } catch {}
    const updated = notes.map(n =>
      n.id === noteId ? { ...n, collectionId: undefined, collectionName: undefined } : n
    )
    localStorage.setItem('minitu_notes', JSON.stringify(updated))
    toast.success(`已移出: ${title}`)
    loadData()
  }

  if (!collection) {
    return (
      <div className="text-center py-24">
        <span className="text-6xl block mb-4">📚</span>
        <h1 className="text-2xl font-extrabold mb-2" style={{ fontFamily: "var(--font-display)" }}>合集未找到</h1>
        <Link href="/collections" className="text-sm text-[var(--skin-primary)] hover:underline font-bold tracking-wider">返回合集列表</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 page-enter">
      <Link href="/collections" className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--skin-text-secondary)] hover:text-[var(--skin-primary)] mb-8 transition-colors tracking-wider">
        <ChevronLeft className="size-4" /> 合集列表
      </Link>

      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="section-number">CD</span>
            <div className="rule-thin w-8" style={{ background: 'var(--skin-border)' }} />
          </div>
          {editing ? (
            <div className="space-y-3 max-w-md animate-fade-in-scale">
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                className="input text-2xl font-extrabold"
                style={{ fontFamily: 'var(--font-display)' }}
                placeholder="合集名称"
                autoFocus
              />
              <input
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                className="input text-sm"
                placeholder="简短描述（可选）"
              />
              <div className="flex gap-2">
                <button onClick={saveEdit} className="btn btn-sm"><Check className="size-3.5" />保存</button>
                <button onClick={cancelEdit} className="btn btn-ghost btn-sm">取消</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <h1 className="editorial-section-title" style={{ fontFamily: 'var(--font-display)', color: 'var(--skin-text)' }}>{collection.title}</h1>
                <button onClick={startEdit} className="p-1.5 hover:text-[var(--skin-primary)] hover:bg-[var(--skin-muted)] rounded transition-all" title="编辑合集">
                  <Pencil className="size-4" style={{ color: 'var(--skin-text-secondary)' }} />
                </button>
              </div>
              {collection.description && (
                <p className="text-sm text-[var(--skin-text-secondary)] mt-2">{collection.description}</p>
              )}
            </>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-4xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--skin-primary)' }}>{collectionNotes.length}</span>
            <span className="text-xs tracking-[0.15em] uppercase text-[var(--skin-text-secondary)] font-bold">篇笔记</span>
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn">
          <Plus className="size-4" /> 添加笔记
        </button>
      </div>

      {/* Add Notes Panel */}
      {showAdd && (
        <div className="card card-rounded-tr p-5 mb-8 animate-fade-in-scale">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-extrabold tracking-wider uppercase" style={{ color: 'var(--skin-text)' }}>
              点击笔记添加到「{collection.title}」
            </span>
            <button onClick={() => setShowAdd(false)} className="text-[var(--skin-text-secondary)] hover:text-[var(--skin-text)]"><X className="size-4" /></button>
          </div>
          {allNotes.length === 0 ? (
            <p className="text-xs text-[var(--skin-text-secondary)] text-center py-6">所有笔记都已在此合集中</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {allNotes.map(n => (
                <button key={n.id} onClick={() => addToCollection(n.id, n.title)}
                  className="w-full text-left px-4 py-3 hover:bg-[var(--skin-muted)] transition-colors text-sm flex items-center gap-3 border-b-2 border-[var(--skin-border)] last:border-b-0">
                  <Plus className="size-4 text-[var(--skin-primary)] shrink-0" />
                  <span className="truncate font-medium">{n.title || '无标题'}</span>
                  <span className="tag shrink-0 ml-auto">{typeLabels[n.type]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notes in Collection */}
      {collectionNotes.length === 0 ? (
        <div className="text-center py-24">
          <Layers className="size-16 mx-auto mb-4 opacity-15" style={{ color: 'var(--skin-text-secondary)' }} />
          <p className="text-sm text-[var(--skin-text-secondary)] font-bold tracking-wider mb-4">合集中还没有笔记</p>
          <button onClick={() => setShowAdd(true)} className="btn">添加笔记</button>
        </div>
      ) : (
        <div className="space-y-3">
          {collectionNotes.map(n => {
            const Icon = typeIcons[n.type] || FileText
            return (
              <div key={n.id} className="card rounded-lg flex items-center gap-4 px-5 py-4 group">
                <div className="size-10 rounded flex items-center justify-center shrink-0" style={{ background: 'var(--skin-muted)' }}>
                  <Icon className="size-5" style={{ color: 'var(--skin-primary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--skin-text)' }}>{n.title || '无标题'}</p>
                  <p className="text-[11px] text-[var(--skin-text-secondary)] mt-1 flex items-center gap-2">
                    <span className="tag">{typeLabels[n.type]}</span>
                    <span className="font-mono">{n.createdAt ? new Date(n.createdAt).toLocaleDateString('zh-CN') : '—'}</span>
                    {n.content && <span className="opacity-60 truncate">— {n.content.slice(0, 40)}</span>}
                  </p>
                </div>
                <button onClick={() => removeFromCollection(n.id, n.title)}
                  className="p-2 sm:opacity-0 sm:group-hover:opacity-100 hover:text-red-500 transition-all shrink-0">
                  <X className="size-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
