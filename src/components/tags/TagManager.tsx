'use client'

import { useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLocalTags, deleteLocalTag, renameLocalTag, getOrCreateTag } from '@/lib/db/local-store'
import type { Tag } from '@/lib/types'
import { toast } from 'sonner'

interface Props {
  initialTags: Tag[]
  onRefresh?: () => void
}

export default function TagManager({ initialTags, onRefresh }: Props) {
  const [tags, setTags] = useState(initialTags)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const refresh = () => { setTags(getLocalTags()); onRefresh?.() }

  const handleAdd = () => {
    if (!newName.trim()) { toast.error('请输入标签名称'); return }
    const localTags = getLocalTags()
    const existing = localTags.find(t => t.name === newName.trim())
    if (existing) { toast.error('标签已存在'); return }
    getOrCreateTag(newName.trim())
    toast.success('标签已添加')
    setNewName(''); setAdding(false)
    refresh()
  }

  const handleEdit = (id: string) => {
    if (!editName.trim()) return
    renameLocalTag(id, editName.trim())
    toast.success('标签已更新')
    setEditingId(null)
    refresh()
  }

  const handleDelete = (id: string, name: string) => {
    deleteLocalTag(id)
    toast.success(`"${name}" 已删除`)
    refresh()
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <div key={tag.id} className="inline-flex items-center gap-1 glass rounded-full px-3 py-1.5 group">
            {editingId === tag.id ? (
              <span className="inline-flex items-center gap-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-6 w-20 text-xs border-0 px-1"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleEdit(tag.id)}
                />
                <button onClick={() => handleEdit(tag.id)} className="text-emerald-500">
                  <Check className="size-3" />
                </button>
                <button onClick={() => setEditingId(null)} className="text-muted-foreground">
                  <X className="size-3" />
                </button>
              </span>
            ) : (
              <>
                <span className="text-sm">{tag.name}</span>
                <button
                  onClick={() => { setEditingId(tag.id); setEditName(tag.name) }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground transition-all"
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  onClick={() => handleDelete(tag.id, tag.name)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-red-500 transition-all"
                >
                  <Trash2 className="size-3" />
                </button>
              </>
            )}
          </div>
        ))}

        {/* 新增标签 */}
        {adding ? (
          <span className="inline-flex items-center gap-1 glass rounded-full px-3 py-1.5">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="新标签"
              className="h-6 w-20 text-xs border-0 px-1"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button onClick={handleAdd} className="text-emerald-500"><Check className="size-3" /></button>
            <button onClick={() => { setAdding(false); setNewName('') }} className="text-muted-foreground"><X className="size-3" /></button>
          </span>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-full h-auto py-1 px-3 text-xs gap-1 glass')}
          >
            <Plus className="size-3" /> 添加
          </button>
        )}
      </div>
    </div>
  )
}
