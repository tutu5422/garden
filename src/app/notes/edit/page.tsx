'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Upload, X, Check, Loader2 } from 'lucide-react'

interface Note {
  id: string; title: string; content: string; type: string; tags: string[]
  collectionId?: string; collectionName?: string
  createdAt: string; image?: string; imageThumb?: string
}

interface Collection { id: string; title: string }

function compressImage(file: File, maxW: number, quality: number): Promise<{ full: string; thumb: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
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

function EditForm() {
  const router = useRouter()
  const sp = useSearchParams()
  const noteId = sp.get('id')
  const isNew = !noteId

  const [collections, setCollections] = useState<Collection[]>([])
  const [form, setForm] = useState({ title: '', content: '', tags: '', collectionId: '' })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
          if (note.image || note.imageThumb) setImagePreview(note.imageThumb || note.image || null)
        }
      } catch {}
    }
    setLoaded(true)
  }, [noteId])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !f.type.startsWith('image/')) return
    setImageFile(f); setImagePreview(URL.createObjectURL(f))
  }
  const removeImage = () => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = '' }

  const save = async () => {
    if (!form.title.trim()) return
    setUploading(true)
    try {
      const notes: Note[] = JSON.parse(localStorage.getItem('minitu_notes') || '[]')
      const col = collections.find(c => c.id === form.collectionId)

      let image: string | undefined, imageThumb: string | undefined
      if (imageFile) {
        try { const c = await compressImage(imageFile, 1200, 0.7); image = c.full; imageThumb = c.thumb } catch {}
      }

      if (isNew) {
        const note: Note = {
          id: crypto.randomUUID?.() || 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
          title: form.title, content: form.content,
          type: 'article',
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
          collectionId: form.collectionId || undefined,
          collectionName: col?.title,
          createdAt: new Date().toISOString(), image, imageThumb,
        }
        localStorage.setItem('minitu_notes', JSON.stringify([note, ...notes]))
        // Sync to cloud
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'notes', action: 'upsert', data: note }),
        }).catch(() => {})
      } else {
        let syncedNote: Note | undefined
        const updated = notes.map(n => {
          if (n.id !== noteId) return n
          const note = {
            ...n, title: form.title, content: form.content,
            tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
            collectionId: form.collectionId || undefined,
            collectionName: col?.title,
            ...(image ? { image, imageThumb } : {}),
          }
          syncedNote = note
          return note
        })
        localStorage.setItem('minitu_notes', JSON.stringify(updated))
        // Sync to cloud
        if (syncedNote) {
          fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: 'notes', action: 'upsert', data: syncedNote }),
          }).catch(() => {})
        }
      }
      router.push('/notes')
    } catch {} finally { setUploading(false) }
  }

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

        {/* Image */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold cursor-pointer transition-colors hover:text-[var(--skin-primary)]"
                 style={{ color: 'var(--skin-text-secondary)' }}>
            <Upload className="size-3.5" />图片
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          </label>
          {imagePreview && (
            <div className="relative inline-flex">
              <img src={imagePreview} alt="" className="h-16 rounded object-cover border-2 border-[var(--skin-border)]" />
              <button onClick={removeImage} className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-red-500 text-white flex items-center justify-center"><X className="size-2.5" /></button>
            </div>
          )}
        </div>

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
