'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getLocalCategories, getLocalTags, getOrCreateTag } from '@/lib/db/local-store'
import { createResource, updateResource } from '@/lib/db/resources-client'
import { writeCache } from '@/lib/db/cache-queries'
import { compressImage } from '@/lib/utils/image'
import type { Tag, Resource, Category } from '@/lib/types'
import { Plus, X, Upload, ImageIcon } from 'lucide-react'
import SmartImage from '@/components/shared/SmartImage'

const inputClass = 'w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all'
const glassInput = `${inputClass} bg-white/40 dark:bg-white/5 border-white/30 dark:border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:ring-[var(--skin-primary)]/30`

export default function SimpleForm({ resource }: { resource?: Resource }) {
  const router = useRouter()
  const isEdit = !!resource
  const [categories, setCategories] = useState<Category[]>(getLocalCategories())
  const allTags = getLocalTags()

  const [title, setTitle] = useState(resource?.title || '')
  const [body, setBody] = useState(resource?.description || '')
  const [categoryId, setCategoryId] = useState(resource?.category_id || '')
  const [cover, setCover] = useState(resource?.cover_image_url || '')
  const [selectedTags, setSelectedTags] = useState<Tag[]>(
    resource?.resource_tags?.map(rt => rt.tag) || []
  )
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addTag = (tag: Tag) => {
    if (!selectedTags.find(t => t.id === tag.id)) setSelectedTags([...selectedTags, tag])
  }
  const removeTag = (id: string) => setSelectedTags(selectedTags.filter(t => t.id !== id))
  const createAndAdd = () => {
    const name = tagInput.trim()
    if (!name) return
    const tag = getOrCreateTag(name)
    addTag(tag)
    setTagInput('')
  }

  const handleSave = async () => {
    if (!title.trim() && !body.trim() && !cover.trim()) {
      setError('请至少填写标题、正文或上传封面图')
      return
    }
    setError('')
    setSaving(true)
    try {
      const finalCategoryId = categoryId || undefined

      const payload = {
        title: title.trim(), description: body.trim(),
        resource_type: 'article' as const, cover_image_url: cover,
        category_id: finalCategoryId,
        tag_ids: selectedTags.map(t => t.id), status: 'active' as const,
      }
      if (isEdit && resource) {
        await updateResource(resource.id, payload)
        // 用新的 category_id 查找分类对象
        const updatedCategory = finalCategoryId
          ? categories.find(c => c.id === finalCategoryId) || null
          : null
        writeCache({ ...resource, ...payload, category: updatedCategory } as Resource)
        router.push(`/resources/${resource.id}`)
      } else {
        const created = await createResource(payload)
        // 写入缓存时补上分类对象
        const newCat = finalCategoryId
          ? categories.find(c => c.id === finalCategoryId) || null
          : null
        writeCache({ ...created, category: newCat } as Resource)
        router.push(`/resources/${created.id}`)
      }
    } catch (e: any) {
      setError(e.message || '保存失败')
    } finally { setSaving(false) }
  }

  const handleImagePick = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const compressed = await compressImage(file, 1200, 0.7)
        setCover(compressed)
      } catch {
        // 压缩失败则原图上传
        const reader = new FileReader()
        reader.onload = () => setCover(reader.result as string)
        reader.readAsDataURL(file)
      }
    }
    input.click()
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      <h1 className="text-lg font-semibold mb-6" style={{ color: 'var(--skin-primary)' }}>
        {isEdit ? '编辑笔记' : '📝 写笔记'}
      </h1>

      <div className="space-y-4">
        {/* 标题 */}
        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground">标题</label>
          <input className={glassInput} value={title} onChange={e => setTitle(e.target.value)} placeholder="给笔记起个名字" />
        </div>

        {/* 分类 */}
        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground">分类</label>
          <select className={glassInput} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">未分类</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>

        {/* 正文 */}
        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground">正文</label>
          <textarea className={`${glassInput} min-h-[180px] resize-y`}
            value={body} onChange={e => setBody(e.target.value)} placeholder="记录你的想法..." />
        </div>

        {/* 标签 */}
        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground">标签</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedTags.map(tag => (
              <span key={tag.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary">
                {tag.name}
                <button onClick={() => removeTag(tag.id)} className="hover:text-destructive"><X className="size-3" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className={`${glassInput} flex-1 h-9 text-sm`} value={tagInput} onChange={e => setTagInput(e.target.value)}
              placeholder="输入标签名" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), createAndAdd())} />
            <button onClick={createAndAdd} className="px-3 py-1.5 rounded-xl text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              <Plus className="size-3.5" />
            </button>
          </div>
          {allTags.filter(t => !selectedTags.find(s => s.id === t.id)).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {allTags.filter(t => !selectedTags.find(s => s.id === t.id)).slice(0, 8).map(tag => (
                <button key={tag.id} onClick={() => addTag(tag)}
                  className="px-2 py-0.5 rounded-full text-[11px] border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 封面图 */}
        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground">封面图</label>
          {cover ? (
            <div className="relative mb-3 rounded-xl overflow-hidden glass shadow-3d h-52">
              <SmartImage src={cover} alt="" fill sizes="600px" className="object-cover" />
              <button onClick={() => setCover('')}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-medium bg-black/40 text-white backdrop-blur hover:bg-black/60 transition-colors">
                移除封面
              </button>
            </div>
          ) : (
            <button onClick={handleImagePick}
              className="w-full py-10 rounded-xl border-2 border-dashed border-white/30 dark:border-white/10 flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground hover:border-[var(--skin-primary)]/40 transition-all bg-white/20 dark:bg-white/3">
              <ImageIcon className="size-8 opacity-30" />
              <span className="text-sm">点击上传封面图</span>
            </button>
          )}
        </div>

        {/* 错误 */}
        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm text-center">{error}</div>
        )}

        {/* 按钮 */}
        <div className="flex gap-3 pt-2">
          <button onClick={() => router.back()}
            className="flex-1 py-3 rounded-xl text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
            取消
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-all disabled:opacity-50 shadow-lg"
            style={{ background: 'var(--skin-primary)' }}>
            {saving ? '保存中...' : isEdit ? '保存修改' : '发布笔记'}
          </button>
        </div>
      </div>
    </div>
  )
}
