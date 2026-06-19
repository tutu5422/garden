'use client'

import { useState, useEffect } from 'react'
import { Plus, Layers, Sparkles, Pencil, Trash2 } from 'lucide-react'
import { getLocalCollections, createLocalCollection, deleteLocalCollection, updateLocalCollection, type LocalCollection } from '@/lib/db/local-store'
import CollectionCard from '@/components/collections/CollectionCard'
import { toast } from 'sonner'

/** Pull collections from cloud via /api/sync and merge into localStorage */
async function pullCollectionsFromCloud() {
  try {
    const res = await fetch('/api/sync', { method: 'GET' })
    if (!res.ok) return
    const data = await res.json()
    const cloudCols = data.collections || []
    if (!cloudCols.length) return
    const localStr = localStorage.getItem('garden_collections')
    const local = localStr ? JSON.parse(localStr) : []
    const merged = new Map()
    for (const c of local) merged.set(c.id, c)
    for (const c of cloudCols) {
      const existing = merged.get(c.id)
      if (!existing || !existing.updatedAt || new Date(c.updatedAt) > new Date(existing.updatedAt || 0)) {
        merged.set(c.id, c)
      }
    }
    localStorage.setItem('garden_collections', JSON.stringify(Array.from(merged.values())))
  } catch { /* silent */ }
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<LocalCollection[]>([])
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({})
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  useEffect(() => {
    // Show localStorage data immediately, then sync from cloud in background
    refresh()
    pullCollectionsFromCloud().then(() => refresh())
    // Also re-read if CloudSyncProvider finishes later
    const handler = () => refresh()
    window.addEventListener('cloud-sync-done', handler)
    return () => window.removeEventListener('cloud-sync-done', handler)
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

  const handleDelete = () => {
    if (!confirmDelete) return
    deleteLocalCollection(confirmDelete.id)
    toast.success(`"${confirmDelete.name}" 已删除`)
    setConfirmDelete(null)
    refresh()
  }

  const startEdit = (col: LocalCollection) => {
    setEditingId(col.id)
    setEditTitle(col.title)
    setEditDesc(col.description || '')
  }

  const saveEdit = () => {
    if (!editingId || !editTitle.trim()) {
      toast.error('合集名称不能为空')
      return
    }
    updateLocalCollection(editingId, { title: editTitle.trim(), description: editDesc.trim() })
    try {
      const notes: any[] = JSON.parse(localStorage.getItem('minitu_notes') || '[]')
      const updated = notes.map((n: any) => n.collectionId === editingId ? { ...n, collectionName: editTitle.trim() } : n)
      localStorage.setItem('minitu_notes', JSON.stringify(updated))
    } catch {}
    toast.success('合集已更新')
    setEditingId(null)
    refresh()
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
    setEditDesc('')
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
              {editingId === col.id ? (
                /* Edit Form */
                <div className="card card-rounded-tr p-6 min-h-[200px] space-y-4 animate-fade-in-scale flex flex-col justify-center">
                  <input
                    value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="合集名称" className="input text-sm" autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                  />
                  <input
                    value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="简短描述（可选）" className="input text-sm"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelEdit} className="btn btn-ghost btn-sm">取消</button>
                    <button onClick={saveEdit} className="btn btn-sm">保存</button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Desktop: hover 显示编辑/删除或确认/取消 */}
                  <div className="absolute top-3 right-3 hidden sm:flex gap-1.5 z-10">
                    {confirmDelete?.id === col.id ? (
                      <>
                        <button onClick={handleDelete}
                          className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-bold whitespace-nowrap shadow-sm">
                          确认
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          className="px-2.5 py-1 rounded-lg bg-white/20 text-white text-xs font-bold whitespace-nowrap shadow-sm">
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => { e.preventDefault(); startEdit(col) }}
                          className="p-2 rounded-lg opacity-0 group-hover/col:opacity-100 bg-white/20 hover:bg-white/35 text-white backdrop-blur-sm transition-all"
                          title="编辑合集"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); setConfirmDelete({ id: col.id, name: col.title }) }}
                          className="p-2 rounded-lg opacity-0 group-hover/col:opacity-100 bg-red-500/80 hover:bg-red-500 text-white backdrop-blur-sm transition-all"
                          title="删除合集"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Mobile: ⋮ 菜单 */}
                  <div className="absolute top-3 right-3 z-10 sm:hidden">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpenId(menuOpenId === col.id ? null : col.id); setConfirmDelete(null); }}
                      className="p-1.5 text-white/60 hover:text-white transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                      </svg>
                    </button>
                    {(menuOpenId === col.id || confirmDelete?.id === col.id) && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => { setMenuOpenId(null); setConfirmDelete(null); }} />
                        <div className="absolute right-0 top-full mt-1.5 flex gap-1.5 z-30">
                          {confirmDelete?.id === col.id ? (
                            <>
                              <button onClick={handleDelete}
                                className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-bold whitespace-nowrap shadow-sm">
                                确认
                              </button>
                              <button onClick={() => setConfirmDelete(null)}
                                className="px-2.5 py-1 rounded-lg bg-white/20 text-white text-xs font-bold whitespace-nowrap shadow-sm">
                                取消
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpenId(null); startEdit(col) }}
                                className="px-2.5 py-1 rounded-lg bg-white/25 text-white text-xs font-bold whitespace-nowrap shadow-sm hover:bg-white/35 transition-colors">
                                编辑
                              </button>
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpenId(null); setConfirmDelete({ id: col.id, name: col.title }) }}
                                className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-bold whitespace-nowrap shadow-sm">
                                删除
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <CollectionCard collection={col} noteCount={noteCounts[col.id] || 0} />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
