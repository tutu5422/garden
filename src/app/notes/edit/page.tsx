'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Upload, X, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import PatternSearch from '@/components/patterns/PatternSearch'
import {
  linkPatternNote,
  unlinkPatternNote,
  getPatternsForNote,
} from '@/lib/api/patterns-api'

interface Note {
  id: string; title: string; content: string; type: string; tags: string[]
  collectionId?: string; collectionName?: string
  createdAt: string; updatedAt?: string
  image?: string; imageThumb?: string
  images?: string[]; imageThumbs?: string[]
}

interface Collection { id: string; title: string }

function compressImage(file: File, maxW: number, quality: number): Promise<{ full: string; thumb: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取图片文件失败'))
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = () => reject(new Error('图片解码失败'))
      img.onload = () => {
        const scale = Math.min(1, maxW / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, w, h)
        const full = canvas.toDataURL('image/jpeg', quality)
        const ts = Math.min(1, 400 / Math.max(img.width, img.height))
        canvas.width = Math.round(img.width * ts); canvas.height = Math.round(img.height * ts)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const thumb = canvas.toDataURL('image/jpeg', 0.75)
        resolve({ full, thumb })
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

/** 批量压缩多张图片 */
async function compressImages(files: File[]): Promise<{ images: string[]; imageThumbs: string[] }> {
  const results = await Promise.all(
    files.map(f => compressImage(f, 1200, 0.7).catch(() => null))
  )
  const valid = results.filter((r): r is { full: string; thumb: string } => r !== null)
  return {
    images: valid.map(r => r.full),
    imageThumbs: valid.map(r => r.thumb),
  }
}

/** Helper: 从 note 中获取所有可用图片（兼容旧单图格式） */
function getNoteImages(note: Note): { full: string; thumb: string }[] {
  const result: { full: string; thumb: string }[] = []
  // 新版多图优先
  if (note.images?.length) {
    const thumbs = note.imageThumbs?.length === note.images.length ? note.imageThumbs : []
    for (let i = 0; i < note.images.length; i++) {
      result.push({ full: note.images[i], thumb: thumbs[i] || note.images[i] })
    }
  } else if (note.image || note.imageThumb) {
    result.push({ full: note.image!, thumb: note.imageThumb || note.image! })
  }
  return result
}

function EditForm() {
  const router = useRouter()
  const sp = useSearchParams()
  const noteId = sp.get('id')
  const isNew = !noteId
  const patternIdParam = sp.get('patternId')
  console.log('[notes/edit] noteId:', noteId, 'isNew:', isNew, 'patternId:', patternIdParam)

  const [collections, setCollections] = useState<Collection[]>([])
  const [form, setForm] = useState({ title: '', content: '', tags: '', collectionId: '' })
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [existingImages, setExistingImages] = useState<{ full: string; thumb: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // 关联图解
  const [selectedPatternIds, setSelectedPatternIds] = useState<string[]>([])
  const [initialPatternIds, setInitialPatternIds] = useState<string[]>([])

  useEffect(() => {
    try { setCollections(JSON.parse(localStorage.getItem('garden_collections') || '[]')) } catch {}
    if (noteId) {
      try {
        const notes: Note[] = JSON.parse(localStorage.getItem('minitu_notes') || '[]')
        const note = notes.find(n => n.id === noteId)
        if (note) {
          setForm({
            title: note.title,
            content: note.content,
            tags: note.tags.join(', '),
            collectionId: note.collectionId || '',
          })
          setExistingImages(getNoteImages(note))
        }
        // 加载已关联的图解（异步走 API）
        void (async () => {
          try {
            const linked = await getPatternsForNote(noteId)
            const pIds = linked.map((p) => p.id)
            setSelectedPatternIds(pIds)
            setInitialPatternIds(pIds)
          } catch (e) {
            console.error('加载关联图解失败:', e)
          }
        })()
      } catch {}
    } else if (patternIdParam) {
      // 从图解详情页跳转来新建笔记，预选该图解
      setSelectedPatternIds([patternIdParam])
      setInitialPatternIds([])
    }
    setLoaded(true)
  }, [noteId, patternIdParam])

  const handleImagesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const images = files.filter(f => f.type.startsWith('image/'))
    if (images.length === 0) return
    const total = imageFiles.length + existingImages.length + images.length
    if (total > 9) {
      toast.error(`最多 9 张图片（已有 ${total - images.length} 张）`)
      return
    }
    setImageFiles(prev => [...prev, ...images])
    setImagePreviews(prev => [...prev, ...images.map(f => URL.createObjectURL(f))])
  }

  const removeNewImage = (idx: number) => {
    URL.revokeObjectURL(imagePreviews[idx])
    setImageFiles(prev => prev.filter((_, i) => i !== idx))
    setImagePreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const removeExistingImage = (idx: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== idx))
  }

  const save = async () => {
    if (!form.title.trim()) return
    setUploading(true)
    let cloudSyncFailed = false
    try {
      let notes: Note[]
      try {
        notes = JSON.parse(localStorage.getItem('minitu_notes') || '[]')
      } catch {
        notes = []
      }
      const col = collections.find(c => c.id === form.collectionId)

      // 压缩新加的图片
      let images: string[] = [], imageThumbs: string[] = []
      if (imageFiles.length > 0) {
        try {
          const compressed = await compressImages(imageFiles)
          images = compressed.images
          imageThumbs = compressed.imageThumbs
        } catch (e) {
          console.warn('[save] 图片压缩失败:', e)
          toast.error('部分图片处理失败')
        }
      }
      // 合并已有图片（旧图 + 新图）
      const allImages = [...existingImages.map(e => e.full), ...images]
      const allThumbs = [...existingImages.map(e => e.thumb), ...imageThumbs]

      let savedNoteId = noteId

      if (isNew) {
        const note: Note = {
          id: crypto.randomUUID?.() || 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
          title: form.title, content: form.content,
          type: 'article',
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
          collectionId: form.collectionId || undefined,
          collectionName: col?.title,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          images: allImages.length > 0 ? allImages : undefined,
          imageThumbs: allThumbs.length > 0 ? allThumbs : undefined,
          // 兼容旧字段：用第一张图
          image: allImages[0],
          imageThumb: allThumbs[0],
        }
        savedNoteId = note.id
        localStorage.setItem('minitu_notes', JSON.stringify([note, ...notes]))
        try {
          const syncRes = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: 'notes', action: 'upsert', data: note }),
          })
          if (!syncRes.ok) cloudSyncFailed = true
        } catch (e) {
          cloudSyncFailed = true
        }
      } else {
        const existing = notes.find(n => n.id === noteId)
        if (!existing) {
          toast.error('未找到该笔记，可能已被删除')
          return
        }
        let syncedNote: Note | undefined
        const updated = notes.map(n => {
          if (n.id !== noteId) return n
          const note = {
            ...n,
            title: form.title, content: form.content,
            tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
            collectionId: form.collectionId || undefined,
            collectionName: col?.title,
            updatedAt: new Date().toISOString(),
            images: allImages.length > 0 ? allImages : undefined,
            imageThumbs: allThumbs.length > 0 ? allThumbs : undefined,
            image: allImages[0],
            imageThumb: allThumbs[0],
          }
          syncedNote = note
          return note
        })
        localStorage.setItem('minitu_notes', JSON.stringify(updated))
        if (syncedNote) {
          try {
            const syncRes = await fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ table: 'notes', action: 'upsert', data: syncedNote }),
            })
            if (!syncRes.ok) cloudSyncFailed = true
          } catch (e) {
            cloudSyncFailed = true
          }
        }
      }

      // 同步图解关联
      if (savedNoteId) {
        const initial = new Set(initialPatternIds)
        const current = new Set(selectedPatternIds)
        await Promise.all(
          selectedPatternIds
            .filter((pid) => !initial.has(pid))
            .map((pid) =>
              linkPatternNote(pid, savedNoteId).then(() => ({ ok: true, pid })).catch((e) => {
                console.error('[linkPatternNote] 关联失败 patternId=', pid, 'noteId=', savedNoteId, '错误:', e?.message || e)
                return { ok: false, pid }
              }),
            ),
        )
        await Promise.all(
          initialPatternIds
            .filter((pid) => !current.has(pid))
            .map((pid) => unlinkPatternNote(pid, savedNoteId).catch((e) => console.error('取消关联失败:', e))),
        )
      }

      if (cloudSyncFailed) {
        toast.warning('已保存到本地，但云端同步失败，下次打开页面会自动重试')
      } else {
        toast.success(isNew ? '笔记已发布' : '笔记已保存')
      }
      router.push('/notes')
    } catch (e: any) {
      console.error('[save] 保存失败:', e)
      toast.error('保存失败：' + (e?.message || '未知错误，请重试'))
    } finally { setUploading(false) }
  }

  const handleTogglePattern = (patternId: string) => {
    setSelectedPatternIds(prev =>
      prev.includes(patternId)
        ? prev.filter(id => id !== patternId)
        : [...prev, patternId]
    )
  }

  const totalImages = existingImages.length + imageFiles.length

  if (!loaded) return null

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 page-enter">
      <Link href="/notes" className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--skin-text-secondary)] hover:text-[var(--skin-primary)] mb-8 transition-colors tracking-wider">
        <ChevronLeft className="size-4" /> 返回笔记
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <span className="section-number">NT</span>
        <div className="rule-thin w-8" style={{ background: 'var(--skin-border)' }} />
        <h1 className="editorial-section-title text-[1.75rem]" style={{ color: 'var(--skin-text)' }}>
          {isNew ? '新建笔记' : '编辑笔记'}
        </h1>
      </div>

      <div className="card card-rounded-tr p-6 space-y-5 animate-fade-in-scale">
        {/* Title */}
        <input
          className="input text-lg font-extrabold"
          style={{ fontFamily: 'var(--font-display)' }}
          placeholder="标题"
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
          autoFocus
        />

        {/* Content */}
        <textarea
          className="input min-h-[200px] text-sm resize-none"
          placeholder="内容（支持 Markdown）"
          value={form.content}
          onChange={e => setForm({ ...form, content: e.target.value })}
        />

        {/* Collection + Tags row */}
        <div className="flex gap-3">
          <select
            className="input-filled text-sm w-auto shrink-0"
            value={form.collectionId}
            onChange={e => setForm({ ...form, collectionId: e.target.value })}
          >
            <option value="">未分类</option>
            {collections.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <input
            className="input-filled flex-1 text-sm"
            placeholder="标签，逗号分隔"
            value={form.tags}
            onChange={e => setForm({ ...form, tags: e.target.value })}
          />
        </div>

        {/* Images — 多图上传 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold cursor-pointer transition-colors hover:text-[var(--skin-primary)]"
                   style={{ color: 'var(--skin-text-secondary)' }}>
              <Upload className="size-3.5" />图片 ({totalImages}/9)
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImagesSelect} />
            </label>
          </div>

          {totalImages > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {/* 已有图片（编辑模式） */}
              {existingImages.map((img, i) => (
                <div key={`e-${i}`} className="relative group rounded-lg overflow-hidden border-2 border-[var(--skin-border)] aspect-square">
                  <img src={img.thumb} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeExistingImage(i)}
                    className="absolute top-1 right-1 size-5 rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {/* 新增图片预览 */}
              {imagePreviews.map((preview, i) => (
                <div key={`n-${i}`} className="relative group rounded-lg overflow-hidden border-2 border-[var(--skin-primary)] aspect-square">
                  <img src={preview} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeNewImage(i)}
                    className="absolute top-1 right-1 size-5 rounded-full bg-red-500 text-white flex items-center justify-center">
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 关联图解 */}
        {(() => {
          const col = collections.find(c => c.id === form.collectionId)
          const isKnitting = !!(col && col.title && col.title.includes('编织'))
          return isKnitting ? (
            <PatternSearch
              selectedIds={selectedPatternIds}
              onToggle={handleTogglePattern}
            />
          ) : null
        })()}

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <Link href="/notes" className="btn btn-ghost btn-sm">取消</Link>
          <button onClick={save} disabled={uploading || !form.title.trim()} className="btn btn-sm">
            {uploading ? <><Loader2 className="size-3.5 animate-spin" />保存中...</> : <><Check className="size-3.5" />{isNew ? '发布' : '保存'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NotesEditPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-6 py-20 text-center"><Loader2 className="size-8 mx-auto animate-spin opacity-30" /></div>}>
      <EditForm />
    </Suspense>
  )
}
