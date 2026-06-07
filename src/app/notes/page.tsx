"use client";
import { useState, useEffect, useRef } from "react";
import { Plus, Search, Trash2, ExternalLink, BookOpen, ImageIcon, Film, Wrench, FileText, Upload, X, Layers, Pencil, Check } from "lucide-react";

interface Note {
  id: string; title: string; content: string; type: string; tags: string[];
  collectionId?: string; collectionName?: string;
  createdAt: string; image?: string; imageThumb?: string;
}

interface Collection { id: string; title: string; }

const typeIcons: Record<string, any> = { link: ExternalLink, image: ImageIcon, book: BookOpen, movie: Film, tool: Wrench, article: FileText };
const typeLabels: Record<string, string> = { link: "链接", image: "图片", book: "书籍", movie: "影视", tool: "工具", article: "文章" };

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
        const ts = Math.min(1, 150 / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * ts); canvas.height = Math.round(img.height * ts);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const thumb = canvas.toDataURL("image/jpeg", 0.5);
        resolve({ full, thumb });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollection, setActiveCollection] = useState("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", content: "", type: "article", tags: "", collectionId: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { setNotes(JSON.parse(localStorage.getItem("minitu_notes") || "[]")); } catch {}
    try { setCollections(JSON.parse(localStorage.getItem("garden_collections") || "[]")); } catch {}
  }, []);

  const save = (n: Note[]) => { setNotes(n); localStorage.setItem("minitu_notes", JSON.stringify(n)); };

  const filtered = notes.filter(n => {
    if (activeCollection === "uncategorized" && n.collectionId) return false;
    if (activeCollection !== "all" && activeCollection !== "uncategorized" && n.collectionId !== activeCollection) return false;
    if (search && !n.title.includes(search) && !n.content.includes(search) && !n.tags.some(t => t.includes(search))) return false;
    return true;
  });

  const uncategorizedCount = notes.filter(n => !n.collectionId).length;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !f.type.startsWith("image/")) return;
    setImageFile(f); setImagePreview(URL.createObjectURL(f));
  };
  const removeImage = () => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = ""; };

  const resetForm = () => {
    setForm({ title: "", content: "", type: "article", tags: "", collectionId: "" });
    removeImage(); setShowAdd(false); setEditingId(null);
  };

  const add = async () => {
    if (!form.title.trim()) return;
    setUploading(true);
    let image: string | undefined, imageThumb: string | undefined;
    if (imageFile) {
      try { const c = await compressImage(imageFile, 1200, 0.7); image = c.full; imageThumb = c.thumb; } catch {}
    }

    const col = collections.find(c => c.id === form.collectionId);
    const note: Note = {
      id: Date.now().toString(36),
      title: form.title, content: form.content, type: form.type,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      collectionId: form.collectionId || undefined,
      collectionName: col?.title,
      createdAt: new Date().toISOString(), image, imageThumb,
    };
    save([note, ...notes]);
    resetForm(); setUploading(false);
  };

  const startEdit = (n: Note) => {
    setEditingId(n.id);
    setForm({ title: n.title, content: n.content, type: n.type, tags: n.tags.join(", "), collectionId: n.collectionId || "" });
    setImagePreview(n.image || null);
    setImageFile(null);
  };
  const saveEdit = async () => {
    if (!form.title.trim()) return;
    setUploading(true);
    const updated = notes.map(n => {
      if (n.id !== editingId) return n;
      const col = collections.find(c => c.id === form.collectionId);
      return { ...n, title: form.title, content: form.content, type: form.type,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        collectionId: form.collectionId || undefined, collectionName: col?.title };
    });
    if (imageFile) {
      try { const c = await compressImage(imageFile, 1200, 0.7);
        const idx = updated.findIndex(n => n.id === editingId);
        if (idx >= 0) { updated[idx].image = c.full; updated[idx].imageThumb = c.thumb; }
      } catch {}
    }
    save(updated);
    resetForm(); setUploading(false);
  };

  const del = (id: string) => save(notes.filter(n => n.id !== id));

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: 'var(--skin-text)' }}>
            笔记
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="stat-number text-2xl" style={{ color: 'var(--skin-primary)' }}>{notes.length}</span>
            <span className="text-xs tracking-widest uppercase text-[var(--skin-text-secondary)] font-bold">篇</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[var(--skin-text-secondary)]" />
            <input className="input-filled pl-9 w-40 sm:w-56 text-sm" placeholder="搜索..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => { resetForm(); setShowAdd(!showAdd); }} className="btn">
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
          if (count === 0) return null;
          return (
            <button key={col.id} onClick={() => setActiveCollection(col.id)}
              className={activeCollection === col.id ? "tag tag-active" : "tag"}>
              {col.title} <span className="ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Create/Edit Form */}
      {(showAdd || editingId) && (
        <div className="card card-rounded-tr p-6 mb-8 space-y-4 animate-fade-in-scale">
          <div className="flex items-center gap-2 mb-1">
            {editingId ? <Pencil className="size-4" style={{ color: 'var(--skin-primary)' }} /> : <Plus className="size-4" style={{ color: 'var(--skin-primary)' }} />}
            <span className="text-xs font-extrabold tracking-wider uppercase" style={{ color: 'var(--skin-primary)' }}>{editingId ? "编辑笔记" : "新建笔记"}</span>
          </div>
          <input className="input text-sm" placeholder="标题" value={form.title}
                 onChange={e => setForm({ ...form, title: e.target.value })} autoFocus />
          <textarea className="input min-h-[80px] text-sm resize-none" placeholder="内容（Markdown）"
                    value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />

          <div className="flex flex-wrap items-center gap-3">
            <select className="input-filled text-sm w-auto" value={form.collectionId}
                    onChange={e => setForm({ ...form, collectionId: e.target.value })}>
              <option value="">分类：未分类</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <span className="text-[10px] text-[var(--skin-text-secondary)] font-bold tracking-wider uppercase">← 来自合集</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold cursor-pointer transition-colors hover:text-[var(--skin-primary)]"
                   style={{ color: 'var(--skin-text-secondary)' }}>
              <Upload className="size-3.5" />图片
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            </label>
            {imagePreview && (
              <div className="relative inline-flex">
                <img src={imagePreview} alt="" className="h-10 rounded object-cover border-2 border-[var(--skin-border)]" />
                <button onClick={removeImage} className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-red-500 text-white flex items-center justify-center"><X className="size-2.5" /></button>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <select className="input-filled text-sm w-auto" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="input-filled flex-1 text-sm" placeholder="标签，逗号分隔" value={form.tags}
                   onChange={e => setForm({ ...form, tags: e.target.value })} />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={resetForm} className="btn btn-ghost btn-sm">取消</button>
            <button onClick={editingId ? saveEdit : add} disabled={uploading} className="btn btn-sm">
              {editingId ? <><Check className="size-3.5" />保存</> : uploading ? "处理中..." : "发布"}
            </button>
          </div>
        </div>
      )}

      {/* Waterfall */}
      {filtered.length === 0 ? (
        <div className="text-center py-24">
          <FileText className="size-16 mx-auto mb-4 opacity-15" style={{ color: 'var(--skin-text-secondary)' }} />
          <p className="text-sm text-[var(--skin-text-secondary)] font-bold tracking-wider">{search ? "没有找到" : "还没有笔记"}</p>
        </div>
      ) : (
        <div className="waterfall-notes" style={{ columnCount: 1, columnGap: "1rem" }}>
          <style>{`@media(min-width:640px){.waterfall-notes{column-count:2!important}}@media(min-width:1024px){.waterfall-notes{column-count:3!important}}`}</style>
          {filtered.map(n => {
            const Icon = typeIcons[n.type] || FileText;
            return (
              <div key={n.id} className="card card-hover card-rounded-tl group relative" style={{ breakInside: "avoid", marginBottom: "1rem" }}>
                {n.imageThumb ? (
                  <div className="w-full overflow-hidden" style={{ maxHeight: "200px" }}>
                    <img src={n.imageThumb} alt={n.title} className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
                         style={{ maxHeight: "200px" }} loading="lazy" />
                  </div>
                ) : (
                  <div className="w-full flex items-center justify-center py-10" style={{ background: 'var(--skin-muted)' }}>
                    <Icon className="size-10" style={{ color: 'var(--skin-text-secondary)', opacity: 0.3 }} />
                  </div>
                )}
                <div className="p-4 space-y-3">
                  {/* Collection badge — always visible */}
                  <div className="flex items-center gap-1.5">
                    <Layers className="size-3.5" style={{ color: 'var(--skin-primary)' }} />
                    <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: n.collectionName ? 'var(--skin-primary)' : 'var(--skin-text-secondary)' }}>
                      {n.collectionName || "未分类"}
                    </span>
                  </div>
                  {/* Type badge */}
                  <span className="tag">{typeLabels[n.type]}</span>
                  {/* Tags */}
                  {n.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {n.tags.slice(0, 3).map(t => (
                        <span key={t} className="tag">#{t}</span>
                      ))}
                    </div>
                  )}
                  <h3 className="font-extrabold text-base leading-snug line-clamp-2 group-hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--skin-text)', fontFamily: "var(--font-display)" }}>{n.title}</h3>
                  {n.content && <p className="text-xs line-clamp-3 leading-relaxed text-[var(--skin-text-secondary)]">{n.content}</p>}
                  <div className="flex items-center justify-between pt-3 border-t-2 border-[var(--skin-border)]">
                    <span className="text-[10px] font-mono text-[var(--skin-text-secondary)]">{new Date(n.createdAt).toLocaleDateString("zh-CN")}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.preventDefault(); startEdit(n); }}
                              className="p-1.5 hover:text-[var(--skin-primary)] transition-colors"><Pencil className="size-3.5" /></button>
                      <button onClick={(e) => { e.preventDefault(); del(n.id); }}
                              className="p-1.5 hover:text-red-500 transition-colors"><Trash2 className="size-3.5" /></button>
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
