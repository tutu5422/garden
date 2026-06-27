'use client'

import { useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createLocalCategory, updateLocalCategory, deleteLocalCategory, getLocalCategories } from '@/lib/db/local-store'
import type { Category } from '@/lib/types'
import { toast } from 'sonner'

const EMOJI_OPTIONS = ['🧶', '💻', '📚', '🎬', '🎵', '🎨', '📷', '✈️', '🍳', '⚽', '🎮', '📝', '🧘', '🌱', '🐶', '💡', '🧵', '🪡']

interface Props {
  initialCategories: Category[]
  onRefresh?: () => void
}

export default function CategoryManager({ initialCategories, onRefresh }: Props) {
  const [categories, setCategories] = useState(initialCategories)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📂')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')

  const refresh = () => { setCategories(getLocalCategories()); onRefresh?.() }

  const handleAdd = () => {
    if (!newName.trim()) { toast.error('请输入分类名称'); return }
    if (getLocalCategories().some(c => c.name === newName.trim())) { toast.error('分类已存在'); return }
    createLocalCategory(newName.trim(), newIcon)
    toast.success('分类已添加')
    setNewName(''); setNewIcon('📂'); setAdding(false)
    refresh()
  }

  const handleEdit = (id: string) => {
    updateLocalCategory(id, { name: editName.trim(), icon: editIcon })
    toast.success('分类已更新')
    setEditingId(null)
    refresh()
  }

  const handleDelete = (id: string, name: string) => {
    deleteLocalCategory(id)
    toast.success(`"${name}" 已删除`)
    refresh()
  }

  const startEdit = (cat: Category) => {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditIcon(cat.icon || '📂')
  }

  return (
    <div className="space-y-3">
      {/* 已有分类列表 */}
      {categories.map((cat) => (
        <div key={cat.id} className="flex items-center gap-2 glass rounded-lg px-3 py-2">
          {editingId === cat.id ? (
            <>
              <select
                value={editIcon}
                onChange={(e) => setEditIcon(e.target.value)}
                className="text-xl bg-transparent border rounded px-1 py-0.5"
              >
                {EMOJI_OPTIONS.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 flex-1"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleEdit(cat.id)}
              />
              <button onClick={() => handleEdit(cat.id)} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded">
                <Check className="size-4" />
              </button>
              <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:bg-muted rounded">
                <X className="size-4" />
              </button>
            </>
          ) : (
            <>
              <span className="text-xl">{cat.icon || '📂'}</span>
              <span className="flex-1 text-sm font-medium">{cat.name}</span>
              <button
                onClick={() => startEdit(cat)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/40 rounded transition-colors"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                onClick={() => handleDelete(cat.id, cat.name)}
                className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
        </div>
      ))}

      {/* 新增分类 */}
      {adding ? (
        <div className="flex items-center gap-2 glass rounded-lg px-3 py-2">
          <select
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            className="text-xl bg-transparent border rounded px-1 py-0.5"
          >
            {EMOJI_OPTIONS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新分类名称"
            className="h-8 flex-1"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button onClick={handleAdd} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded">
            <Check className="size-4" />
          </button>
          <button onClick={() => { setAdding(false); setNewName('') }} className="p-1 text-muted-foreground hover:bg-muted rounded">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full gap-1 glass')}
        >
          <Plus className="size-3.5" /> 新增分类
        </button>
      )}
    </div>
  )
}
