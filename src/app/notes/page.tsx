"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, Upload, X, Layers, Pencil, BookOpen } from "lucide-react";

interface Note {
  id: string; title: string; content: string; type: string; tags: string[];
  collectionId?: string; collectionName?: string;
  createdAt: string; image?: string; imageThumb?: string;
}

interface Collection { id: string; title: string; }

// 便当盒柔和色板
const bentoPalette = [
  { bg: '#FFF5F0', accent: '#E8836B', text: '#5C2D1E' },
  { bg: '#F5F7FB', accent: '#5B7FBD', text: '#1E345C' },
  { bg: '#F2FAF4', accent: '#5B9E6F', text: '#1E4A2E' },
  { bg: '#FFFAF0', accent: '#D4A03A', text: '#5C3D1E' },
  { bg: '#F8F4FA', accent: '#8B5B9E', text: '#3A1E4A' },
  { bg: '#F0F7FA', accent: '#3A8B9E', text: '#1E3A4A' },
];

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

/* 便当盒网格尺寸分配 — 自适应项数 */
function getBentoClass(i: number, hasImage: boolean, total: number) {
  // 仅 1 篇：撑满整行，居中限宽
  if (total === 1) return 'bento-solo';
  // 2 篇：全部 1x1
  if (total === 2) return 'bento-1x1';
  // 3 篇：全 1x1，保持视觉一致
  if (total === 3) return 'bento-1x1';
  // 4 篇：第一张有图时 2x2，其余全 1x1
  if (total === 4) {
    if (hasImage && i === 0) return 'bento-2x2';
    return 'bento-1x1';
  }
  // ≥5 篇：节奏化布局
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
    setForm({ title: "", content: "", tags: "", collectionId: "" });
    removeImage(); setShowAdd(false);
  };

  const quickAdd = async () => {
    if (!form.title.trim()) return;
    setUploading(true);
    let image: string | undefined, imageThumb: string | undefined;
    if (imageFile) {
      try { const c = await compressImage(imageFile, 1200, 0.7); image = c.full; imageThumb = c.thumb; } catch {}
    }
    const col = collections.find(c => c.id === form.collectionId);
    const note: Note = {
      id: Date.now().toString(36),
      title: form.title, content: form.content, type: "article",
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      collectionId: form.collectionId || undefined,
      collectionName: col?.title,
      createdAt: new Date().toISOString(), image, imageThumb,
    };
    save([note, ...notes]);
    resetForm(); setUploading(false);
  };

  const del = (id: string) => save(notes.filter(n => n.id !== id));

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
            <input className="input-filled w-44 sm:w-64 text-sm" style={{ paddingLeft: '2.75rem' }} placeholder="搜索..." value={search} onChange={e => setSearch(e.target.value)} />
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
          if (count === 0) return null;
          return (
            <button key={col.id} onClick={() => setActiveCollection(col.id)}
              className={activeCollection === col.id ? "tag tag-active" : "tag"}>
              {col.title} <span className="ml-1 opacity-70">{count}</span>
            </button>
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
        /* ===== 便当盒网格 ===== */
        <div className="bento-grid">
          {filtered.map((n, i) => {
            const pal = bentoPalette[i % bentoPalette.length];
            const hasImage = !!(n.imageThumb || n.image);
            const bentoClass = getBentoClass(i, hasImage, filtered.length);
            const isLarge = bentoClass === 'bento-2x2';

            return (
              <div
                key={n.id}
                className={`${bentoClass} group cursor-pointer`}
                onClick={() => router.push(`/notes/${n.id}`)}
              >
                <div className="card-bento flex-1 min-h-0 flex flex-col">
                  {/* 图片区 — 大卡片全宽顶图，普通卡片可选 */}
                  {hasImage && (
                    <div className={`overflow-hidden shrink-0 ${isLarge ? 'h-52 sm:h-64' : 'h-32 sm:h-40'}`}>
                      <img src={n.imageThumb || n.image} alt={n.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy" />
                    </div>
                  )}

                  {/* 正文 */}
                  <div className="p-4 sm:p-5 flex flex-col flex-1">
                    {/* Collection badge */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: pal.accent }} />
                      <span className="text-[10px] font-bold tracking-wider uppercase"
                            style={{ color: n.collectionName ? pal.accent : 'var(--skin-text-secondary)' }}>
                        {n.collectionName || '未分类'}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className={`font-extrabold leading-snug line-clamp-2 group-hover:opacity-70 transition-opacity mb-auto ${isLarge ? 'text-base sm:text-xl' : 'text-sm sm:text-base'}`}
                        style={{ color: 'var(--skin-text)', fontFamily: 'var(--font-display)' }}>
                      {n.title}
                    </h3>

                    {/* Preview — large cards show more */}
                    {n.content && (
                      <p className={`text-xs leading-relaxed text-[var(--skin-text-secondary)] mt-2 ${isLarge ? 'line-clamp-3' : 'line-clamp-2'}`}>
                        {n.content.slice(0, isLarge ? 160 : 80)}
                      </p>
                    )}

                    {/* Tags */}
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

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t-2 border-[var(--skin-border)]">
                      <span className="text-[10px] font-mono text-[var(--skin-text-secondary)]">
                        {new Date(n.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); router.push(`/notes/edit?id=${n.id}`); }}
                          className="p-1.5 rounded-lg hover:bg-[var(--skin-muted)] transition-colors text-[var(--skin-text-secondary)] hover:text-[var(--skin-primary)]">
                          <Pencil className="size-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); del(n.id); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-[var(--skin-text-secondary)] hover:text-red-500">
                          <Trash2 className="size-3.5" />
                        </button>
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
