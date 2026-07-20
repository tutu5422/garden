"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, Upload, X, Layers, Pencil, BookOpen, Check, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { updateLocalCollection } from '@/lib/db/local-store';

interface Note {
  id: string; title: string; content: string; type: string; tags: string[];
  collectionId?: string; collectionName?: string;
  createdAt: string; updatedAt?: string;
  image?: string; imageThumb?: string;
  images?: string[]; imageThumbs?: string[];
}
interface Collection { id: string; title: string; }

// 墓碑 key：记录已删除的笔记 ID，防止下次从云端合并时复活
const DELETED_NOTES_KEY = 'minitu_notes_deleted';

// 便当盒柔和色板
const bentoPalette = [
  { bg: '#FFF5F0', accent: '#E8836B', text: '#5C2D1E' },
  { bg: '#F5F7FB', accent: '#5B7FBD', text: '#1E345C' },
  { bg: '#F2FAF4', accent: '#5B9E6F', text: '#1E4A2E' },
  { bg: '#FFFAF0', accent: '#D4A03A', text: '#5C3D1E' },
  { bg: '#F8F4FA', accent: '#8B5B9E', text: '#3A1E4A' },
  { bg: '#F0F7FA', accent: '#3A8B9E', text: '#1E3A4A' },
];

// 模块级缓存：按 cacheKey 缓存云端数据，避免重复全量拉取。
let _syncNotesCache: { key: string; promise: Promise<Note[]> } | null = null;

async function syncNotesFromCloud(cacheKey: string): Promise<Note[]> {
  if (_syncNotesCache && _syncNotesCache.key === cacheKey) return _syncNotesCache.promise;
  const promise = (async () => {
    try {
      const res = await fetch('/api/sync?_=' + Date.now(), { method: 'GET' });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.notes || []).map((r: any) => ({
        id: r.id,
        title: r.title || '',
        content: r.content || '',
        type: r.type || 'article',
        tags: r.tags || [],
        collectionId: r.collectionId || undefined,
        collectionName: r.collectionName || undefined,
        createdAt: r.createdAt || new Date().toISOString(),
        updatedAt: r.updatedAt,
        image: r.image || undefined,
        imageThumb: r.imageThumb || undefined,
        images: r.images || undefined,
        imageThumbs: r.imageThumbs || undefined,
      }));
    } catch { return []; }
  })();
  promise.catch(() => { _syncNotesCache = null; });
  _syncNotesCache = { key: cacheKey, promise };
  return promise;
}

function compressImage(file: File, maxW: number, quality: number): Promise<{ full: string; thumb: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d")!; ctx.drawImage(img, 0, 0, w, h);
        const full = canvas.toDataURL("image/jpeg", quality);
        const ts = Math.min(1, 400 / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * ts); canvas.height = Math.round(img.height * ts);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const thumb = canvas.toDataURL("image/jpeg", 0.75);
        resolve({ full, thumb });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** 批量压缩多张图片 */
async function compressImages(files: File[]): Promise<{ images: string[]; imageThumbs: string[] }> {
  const results = await Promise.all(
    files.map(f => compressImage(f, 1200, 0.7).catch(() => null))
  );
  const valid = results.filter((r): r is { full: string; thumb: string } => r !== null);
  return {
    images: valid.map(r => r.full),
    imageThumbs: valid.map(r => r.thumb),
  };
}

/** Helper: 获取笔记第一张图（兼容新旧格式） */
function getFirstImage(note: Note): { full: string; thumb: string } | null {
  if (note.images?.length) {
    const thumb = note.imageThumbs?.[0] || note.images[0];
    return { full: note.images[0], thumb };
  }
  if (note.image || note.imageThumb) {
    return { full: note.image!, thumb: note.imageThumb || note.image! };
  }
  return null;
}

/* 便当盒网格尺寸分配 — 自适应项数 */
function getBentoClass(i: number, hasImage: boolean, total: number) {
  if (total === 1) return 'bento-solo';
  if (total === 2) return 'bento-1x1';
  if (total === 3) return 'bento-1x1';
  if (total === 4) {
    if (hasImage && i === 0) return 'bento-2x2';
    return 'bento-1x1';
  }
  if (hasImage && i === 0) return 'bento-2x2';
  const m = i % 5;
  if (m === 1 && hasImage) return 'bento-2x1';
  if (m === 3 && hasImage) return 'bento-2x1';
  return 'bento-1x1';
}

export default function Notes() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollection, setActiveCollection] = useState("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", tags: "", collectionId: "" });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editCollectionName, setEditCollectionName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // UUID pattern: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

  // Load notes
  useEffect(() => {
    const cacheKey = 'notes-' + Date.now()
    const loadNotes = async () => {
      try {
        let local: Note[] = JSON.parse(localStorage.getItem('minitu_notes') || '[]');
        let migrated = false;
        const idMap = new Map<string, string>();
        for (const n of local) {
          if (!isUUID(n.id)) {
            const newId = crypto.randomUUID?.() || 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
            idMap.set(n.id, newId);
            n.id = newId;
            migrated = true;
          }
        }
        if (migrated) {
          for (const n of local) {
            if (n.collectionId && idMap.has(n.collectionId)) {
              n.collectionId = idMap.get(n.collectionId)!;
            }
          }
          localStorage.setItem('minitu_notes', JSON.stringify(local));
          setNotes(local);
          local.forEach(n => {
            fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ table: 'notes', action: 'upsert', data: n }),
            }).catch(() => {});
          });
        } else {
          setNotes(local);
        }
        setCollections(JSON.parse(localStorage.getItem('garden_collections') || '[]'));

        const cloud = await syncNotesFromCloud(cacheKey);
        if (cloud.length > 0) {
          const deletedIds: string[] = (() => {
            try { return JSON.parse(localStorage.getItem(DELETED_NOTES_KEY) || '[]'); } catch { return []; }
          })();
          const deletedSet = new Set(deletedIds);
          const mergedMap = new Map<string, Note>();
          for (const n of cloud) {
            if (deletedSet.has(n.id)) continue;
            mergedMap.set(n.id, n);
          }
          for (const n of local) {
            if (!mergedMap.has(n.id)) mergedMap.set(n.id, n);
          }
          const mergedList = Array.from(mergedMap.values());
          setNotes(mergedList);
          localStorage.setItem('minitu_notes', JSON.stringify(mergedList));
        }
      } catch {}
    };
    loadNotes();
  }, []);

  const syncNote = (note: Note) => {
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'notes', action: 'upsert', data: note }),
    }).catch(() => {});
  };
  const syncNoteDelete = (id: string) => {
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'notes', action: 'delete', data: { id } }),
    }).catch(() => {});
  };

  const save = (n: Note[]) => { setNotes(n); localStorage.setItem("minitu_notes", JSON.stringify(n)); };

  const startRename = (col: Collection) => {
    setEditingCollectionId(col.id);
    setEditCollectionName(col.title);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };
  const saveRename = () => {
    if (!editingCollectionId || !editCollectionName.trim()) { setEditingCollectionId(null); return; }
    updateLocalCollection(editingCollectionId, { title: editCollectionName.trim() });
    const updatedCols = JSON.parse(localStorage.getItem('garden_collections') || '[]');
    setCollections(updatedCols);
    const updatedNotes = notes.map(n =>
      n.collectionId === editingCollectionId ? { ...n, collectionName: editCollectionName.trim() } : n
    );
    save(updatedNotes);
    updatedNotes.filter(n => n.collectionId === editingCollectionId).forEach(syncNote);
    setEditingCollectionId(null);
  };
  const cancelRename = () => { setEditingCollectionId(null); };

  const filtered = notes.filter(n => {
    if (activeCollection === "uncategorized" && n.collectionId) return false;
    if (activeCollection !== "all" && activeCollection !== "uncategorized" && n.collectionId !== activeCollection) return false;
    if (search && !n.title.includes(search) && !n.content.includes(search) && !n.tags.some(t => t.includes(search))) return false;
    return true;
  });

  const uncategorizedCount = notes.filter(n => !n.collectionId).length;

  const handleImagesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const images = files.filter(f => f.type.startsWith('image/'));
    if (images.length === 0) return;
    const total = imageFiles.length + images.length;
    if (total > 9) { toast.error(`最多 9 张图片（已有 ${imageFiles.length} 张）`); return; }
    setImageFiles(prev => [...prev, ...images]);
    setImagePreviews(prev => [...prev, ...images.map(f => URL.createObjectURL(f))]);
  };

  const removeNewImage = (idx: number) => {
    URL.revokeObjectURL(imagePreviews[idx]);
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    setForm({ title: "", content: "", tags: "", collectionId: "" });
    imagePreviews.forEach(p => URL.revokeObjectURL(p));
    setImageFiles([]);
    setImagePreviews([]);
    setShowAdd(false);
  };

  const quickAdd = async () => {
    if (!form.title.trim()) return;
    setUploading(true);
    let images: string[] = [], imageThumbs: string[] = [];
    if (imageFiles.length > 0) {
      try {
        const compressed = await compressImages(imageFiles);
        images = compressed.images;
        imageThumbs = compressed.imageThumbs;
      } catch (e) { console.warn('[quickAdd] 图片压缩失败:', e); }
    }
    const col = collections.find(c => c.id === form.collectionId);
    const note: Note = {
      id: crypto.randomUUID?.() || 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      title: form.title, content: form.content, type: "article",
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      collectionId: form.collectionId || undefined,
      collectionName: col?.title,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      images: images.length > 0 ? images : undefined,
      imageThumbs: imageThumbs.length > 0 ? imageThumbs : undefined,
      image: images[0],
      imageThumb: imageThumbs[0],
    };
    save([note, ...notes]);
    syncNote(note);
    resetForm(); setUploading(false);
  };

  const del = (id: string) => {
    save(notes.filter(n => n.id !== id));
    syncNoteDelete(id);
    try {
      const deleted = JSON.parse(localStorage.getItem(DELETED_NOTES_KEY) || '[]');
      if (!deleted.includes(id)) deleted.push(id);
      localStorage.setItem(DELETED_NOTES_KEY, JSON.stringify(deleted));
    } catch {}
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 page-enter relative z-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="section-number">NT</span>
            <div className="rule-thin w-8" style={{ background: 'var(--skin-border)' }} />
          </div>
          <h1 className="editorial-section-title" style={{ color: 'var(--skin-text)' }}>
            笔记
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-4xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: 'var(--skin-primary)' }}>{notes.length}</span>
            <span className="text-xs tracking-[0.15em] uppercase text-[var(--skin-text-secondary)] font-bold">篇</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--skin-text-secondary)] pointer-events-none" />
            <input className="input-filled w-32 sm:w-44 md:w-64 text-sm" style={{ paddingLeft: '2.75rem' }} placeholder="搜索..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => router.push('/notes/edit')} className="btn">
            <Plus className="size-4" />新建
          </button>
        </div>
      </div>

      {/* Collection Filter Pills */}
      <div className="flex gap-2 flex-wrap mb-8">
        <button onClick={() => setActiveCollection("all")}
          className={activeCollection === "all" ? "tag tag-active" : "tag"}>
          全部 {notes.length > 0 && <span className="ml-1 opacity-70">{notes.length}</span>}
        </button>
        <button onClick={() => setActiveCollection("uncategorized")}
          className={activeCollection === "uncategorized" ? "tag tag-active" : "tag"}>
          未分类 {uncategorizedCount > 0 && <span className="ml-1 opacity-70">{uncategorizedCount}</span>}
        </button>
        {collections.map(col => {
          const count = notes.filter(n => n.collectionId === col.id).length;
          if (count === 0 && editingCollectionId !== col.id) return null;
          const isEditing = editingCollectionId === col.id;
          return isEditing ? (
            <span key={col.id} className="inline-flex items-center gap-1">
              <input
                ref={renameInputRef}
                value={editCollectionName}
                onChange={e => setEditCollectionName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") cancelRename(); }}
                onBlur={saveRename}
                className="text-[11px] font-bold px-2 py-1 rounded-full border-2 border-[var(--skin-primary)] bg-[var(--skin-surface)] outline-none"
                style={{ color: 'var(--skin-text)', width: `${Math.max(60, editCollectionName.length * 14)}px`, minWidth: '60px' }}
              />
              <button onClick={saveRename} className="p-0.5 hover:text-green-500 transition-colors"><Check className="size-3" /></button>
              <button onClick={cancelRename} className="p-0.5 hover:text-red-500 transition-colors"><X className="size-3" /></button>
            </span>
          ) : (
            <span key={col.id} className="inline-flex items-center gap-0.5 group/rename">
              <button onClick={() => setActiveCollection(col.id)}
                className={activeCollection === col.id ? "tag tag-active" : "tag"}>
                {col.title} <span className="ml-1 opacity-70">{count}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); startRename(col); }}
                className="p-0.5 opacity-0 group-hover/rename:opacity-100 hover:text-[var(--skin-primary)] transition-all cursor-pointer shrink-0"
                title="重命名合集"
              >
                <Edit3 className="size-3" />
              </button>
            </span>
          );
        })}
      </div>

      {/* Quick Create Form */}
      {showAdd && (
        <div className="card card-rounded-tr p-6 mb-8 space-y-4 animate-fade-in-scale">
          <div className="flex items-center gap-2 mb-1">
            <Plus className="size-4" style={{ color: 'var(--skin-primary)' }} />
            <span className="text-xs font-extrabold tracking-wider uppercase" style={{ color: 'var(--skin-primary)' }}>快速笔记</span>
          </div>
          <input className="input text-sm" placeholder="标题" value={form.title}
                 onChange={e => setForm({ ...form, title: e.target.value })} autoFocus />
          <textarea className="input min-h-[80px] text-sm resize-none" placeholder="内容（Markdown）"
                    value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />

          <div className="flex gap-3">
            <select className="input-filled text-sm w-auto shrink-0" value={form.collectionId}
                    onChange={e => setForm({ ...form, collectionId: e.target.value })}>
              <option value="">未分类</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <input className="input-filled flex-1 text-sm" placeholder="标签，逗号分隔" value={form.tags}
                   onChange={e => setForm({ ...form, tags: e.target.value })} />
          </div>

          {/* 多图上传 */}
          <div className="space-y-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold cursor-pointer transition-colors hover:text-[var(--skin-primary)]"
                   style={{ color: 'var(--skin-text-secondary)' }}>
              <Upload className="size-3.5" />图片 ({imageFiles.length}/9)
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImagesSelect} />
            </label>
            {imagePreviews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {imagePreviews.map((preview, i) => (
                  <div key={i} className="relative inline-flex">
                    <img src={preview} alt="" className="h-14 w-14 rounded object-cover border-2 border-[var(--skin-primary)]" />
                    <button onClick={() => removeNewImage(i)}
                      className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-red-500 text-white flex items-center justify-center">
                      <X className="size-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={resetForm} className="btn btn-ghost btn-sm">取消</button>
            <button onClick={quickAdd} disabled={uploading} className="btn btn-sm">
              {uploading ? "处理中..." : "发布"}
            </button>
          </div>
        </div>
      )}

      {/* Empty */}
      {filtered.length === 0 ? (
        <div className="text-center py-24">
          <BookOpen className="size-16 mx-auto mb-4 opacity-15" style={{ color: 'var(--skin-text-secondary)' }} />
          <p className="text-sm text-[var(--skin-text-secondary)] font-bold tracking-wider">{search ? "没有找到" : "还没有笔记"}</p>
          {!search && (
            <button onClick={() => router.push('/notes/edit')} className="mt-4 btn">
              <Plus className="size-4" />写第一篇
            </button>
          )}
        </div>
      ) : (
        <div className="bento-grid">
          {filtered.map((n, i) => {
            const pal = bentoPalette[i % bentoPalette.length];
            const firstImg = getFirstImage(n);
            const hasImage = firstImg !== null;
            const bentoClass = getBentoClass(i, hasImage, filtered.length);
            const isLarge = bentoClass === 'bento-2x2';

            return (
              <div
                key={n.id}
                className={`${bentoClass} group cursor-pointer relative`}
                onClick={() => router.push(`/notes/${n.id}`)}
              >
                {/* Mobile: ⋮ menu */}
                <div className="sm:hidden absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === n.id ? null : n.id); setConfirmDelete(null); }}
                    className="p-1.5 text-[var(--skin-text-secondary)] opacity-40 hover:opacity-100 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                    </svg>
                  </button>
                  {(menuOpenId === n.id || confirmDelete?.id === n.id) && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => { setMenuOpenId(null); setConfirmDelete(null); }} />
                      <div className="absolute right-0 top-full mt-1 flex gap-1.5 z-30">
                        {confirmDelete?.id === n.id ? (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); del(n.id); setConfirmDelete(null); }}
                              className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-bold whitespace-nowrap shadow-sm">确认</button>
                            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                              className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold whitespace-nowrap shadow-sm">取消</button>
                          </>
                        ) : (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); router.push(`/notes/edit?id=${n.id}`); }}
                              className="px-2.5 py-1 rounded-lg bg-gray-800 text-white text-xs font-bold whitespace-nowrap shadow-sm">编辑</button>
                            <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); setConfirmDelete({ id: n.id, title: n.title }); }}
                              className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-bold whitespace-nowrap shadow-sm">删除</button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="card-bento flex-1 min-h-0 flex flex-col">
                  {/* 图片区 */}
                  {hasImage && (
                    <div className={`overflow-hidden shrink-0 ${isLarge ? 'h-52 sm:h-64' : 'h-32 sm:h-40'}`}>
                      <img src={firstImg!.thumb} alt={n.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy" />
                    </div>
                  )}

                  {/* 正文 */}
                  <div className="p-4 sm:p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: pal.accent }} />
                      <span className="text-[10px] font-bold tracking-wider uppercase"
                            style={{ color: n.collectionName ? pal.accent : 'var(--skin-text-secondary)' }}>
                        {n.collectionName || '未分类'}
                      </span>
                    </div>

                    <h3 className={`font-extrabold leading-snug line-clamp-2 group-hover:opacity-70 transition-opacity mb-auto ${isLarge ? 'text-base sm:text-xl' : 'text-sm sm:text-base'}`}
                        style={{ color: 'var(--skin-text)', fontFamily: 'var(--font-display)' }}>
                      {n.title}
                    </h3>

                    {n.content && (
                      <p className={`text-xs leading-relaxed text-[var(--skin-text-secondary)] mt-2 ${isLarge ? 'line-clamp-3' : 'line-clamp-2'}`}>
                        {n.content.slice(0, isLarge ? 160 : 80)}
                      </p>
                    )}

                    {n.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-3">
                        {n.tags.slice(0, isLarge ? 4 : 2).map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md font-bold transition-colors"
                                style={{ background: `${pal.accent}15`, color: pal.accent }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 mt-3 border-t-2 border-[var(--skin-border)]">
                      <span className="text-[10px] font-mono text-[var(--skin-text-secondary)]">
                        {new Date(n.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                      <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {confirmDelete?.id === n.id ? (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); del(n.id); setConfirmDelete(null); }}
                              className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-bold whitespace-nowrap shadow-sm">确认</button>
                            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                              className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold whitespace-nowrap shadow-sm">取消</button>
                          </>
                        ) : (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); router.push(`/notes/edit?id=${n.id}`); }}
                              className="p-1.5 rounded-lg hover:bg-[var(--skin-muted)] transition-colors text-[var(--skin-text-secondary)] hover:text-[var(--skin-primary)]">
                              <Pencil className="size-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: n.id, title: n.title }); }}
                              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-[var(--skin-text-secondary)] hover:text-red-500">
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
