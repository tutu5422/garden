"use client";
import { useState, useRef, useEffect } from "react";
import { Upload, File, Trash2, Download, FileText, Music, Image, Archive, Film, Search, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";

declare global {
  interface WindowEventMap {
    'cloud-sync-done': Event
  }
}

// Max file size: 50 MB
const MAX_SIZE = 50 * 1024 * 1024;

/** Pull file metadata from cloud and merge into localStorage */
async function pullFilesFromCloud(): Promise<void> {
  try {
    const res = await fetch('/api/sync', { method: 'GET' });
    if (!res.ok) return;
    const data = await res.json();
    const cloudFiles = data.files || [];
    if (!cloudFiles.length) return;
    const localStr = localStorage.getItem('minitu_files');
    const local = localStr ? JSON.parse(localStr) : [];
    const merged = new Map();
    for (const f of local) merged.set(f.id, f);
    for (const f of cloudFiles) {
      const existing = merged.get(f.id);
      if (!existing || new Date(f.createdAt) > new Date(existing.createdAt || 0)) {
        merged.set(f.id, f);
      }
    }
    localStorage.setItem('minitu_files', JSON.stringify(Array.from(merged.values())));
  } catch { /* silent */ }
}

interface MyFile {
  id: string; name: string; size: string; sizeBytes: number;
  type: string; category: string; createdAt: string;
  storagePath?: string;
  url?: string; // public URL for audio
}

const STORAGE_KEY = "minitu_files";

const extGroup: Record<string, string> = {
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image",
  pdf: "document", doc: "document", docx: "document", xls: "document", xlsx: "document",
  ppt: "document", pptx: "document", txt: "document", md: "document", csv: "document",
  mp3: "audio", wav: "audio", flac: "audio", aac: "audio", ogg: "audio", wma: "audio", m4a: "audio",
  mp4: "video", mov: "video", avi: "video", mkv: "video", webm: "video",
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive",
};

const extType: Record<string, string> = {
  pdf: "PDF", doc: "Word", docx: "Word", xls: "Excel", xlsx: "Excel", ppt: "PPT", pptx: "PPT",
  zip: "ZIP", rar: "RAR", "7z": "7Z", gz: "GZ",
  png: "PNG", jpg: "JPG", jpeg: "JPEG", gif: "GIF", webp: "WebP", svg: "SVG",
  mp4: "MP4", mov: "MOV", avi: "AVI", mkv: "MKV",
  mp3: "MP3", wav: "WAV", flac: "FLAC", aac: "AAC", ogg: "OGG", m4a: "M4A",
  txt: "TXT", md: "Markdown", csv: "CSV",
};

const CATS_KEY = "minitu_file_categories";

function loadCats(): string[] { try { return JSON.parse(localStorage.getItem(CATS_KEY) || "[]"); } catch { return []; } }
function saveCats(cats: string[]) { localStorage.setItem(CATS_KEY, JSON.stringify(cats)); }

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// Upload a single file via presigned URL (bypasses Vercel 4.5MB body limit)
async function uploadFile(file: File, id: string): Promise<{ storagePath: string; publicUrl: string } | null> {
  try {
    // Step 1: Get presigned URL from server
    const presignRes = await fetch('/api/storage/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType: file.type, id }),
    });
    if (!presignRes.ok) {
      const err = await presignRes.json().catch(() => ({}));
      throw new Error(err.error || '获取上传链接失败');
    }
    const { signedUrl, storagePath, publicUrl } = await presignRes.json();

    // Step 2: Upload directly to Supabase via signed URL
    const uploadRes = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!uploadRes.ok) {
      throw new Error(`上传失败 (${uploadRes.status})`);
    }

    return { storagePath, publicUrl };
  } catch (err: any) {
    console.error('Upload error:', err);
    throw err;
  }
}

export default function Files() {
  const [files, setFiles] = useState<MyFile[]>([]);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [customCats, setCustomCats] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [confirmDelete, setConfirmDelete] = useState<MyFile | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    // Show localStorage data immediately
    try { setFiles(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); } catch {}
    setCustomCats(loadCats());
    setLoaded(true);
    // Then sync from cloud in background
    pullFilesFromCloud().then(() => {
      try { setFiles(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); } catch {}
    });
    const handler = () => {
      try { setFiles(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); } catch {}
    };
    window.addEventListener('cloud-sync-done', handler);
    return () => window.removeEventListener('cloud-sync-done', handler);
  }, []);
  const [newCatName, setNewCatName] = useState("");
  const [showCatManager, setShowCatManager] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = (f: MyFile[]) => { setFiles(f); localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files; if (!fl) return;
    
    // Validate sizes first
    const oversized: string[] = [];
    for (const f of Array.from(fl)) {
      if (f.size > MAX_SIZE) oversized.push(f.name);
    }
    if (oversized.length > 0) {
      toast.error(`以下文件超过 50MB 限制: ${oversized.join(', ')}`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: fl.length });
    const newFiles: MyFile[] = [];
    let errored = 0;

    for (const f of Array.from(fl)) {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      const id = crypto.randomUUID();

      try {
        const result = await uploadFile(f, id);
        
        const myFile: MyFile = {
          id, name: f.name, size: formatBytes(f.size), sizeBytes: f.size,
          type: extType[ext] || ext.toUpperCase(), category: "",
          createdAt: new Date().toISOString(),
          storagePath: result?.storagePath || undefined,
          url: result?.publicUrl || undefined,
        };
        newFiles.push(myFile);

        // Fire-and-forget: sync file metadata to cloud
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'files', action: 'upsert', data: myFile }),
        }).catch(() => {});
      } catch (err: any) {
        errored++;
        toast.error(`${f.name}: ${err.message}`);
      }
      setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }

    if (newFiles.length > 0) {
      save([...newFiles, ...files]);
      const audioFiles = newFiles.filter(f => f.url && extGroup[f.name.split(".").pop()?.toLowerCase() || ""] === "audio");
      if (audioFiles.length > 0) {
        toast.success(`已上传 ${newFiles.length} 个文件 (含 ${audioFiles.length} 个音频，可在音乐播放器中导入)`);
      } else {
        toast.success(`已上传 ${newFiles.length} 个文件`);
      }
    }
    if (errored > 0) toast.error(`${errored} 个文件上传失败`);

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDownload = async (f: MyFile) => {
    const url = f.url || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/minitu-garden/${f.storagePath}`;
    if (url) {
      const a = document.createElement("a");
      a.href = url; a.download = f.name; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      return;
    }
    // Legacy IndexedDB file
    const { getBlob } = await import("@/lib/db/idb-store");
    const dataUrl = await getBlob(f.id);
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl; a.download = f.name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const f = confirmDelete;
    setConfirmDelete(null);
    if (f.storagePath) {
      try {
        await fetch("/api/files/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath: f.storagePath }),
        });
      } catch (err) {
        console.error("Delete from Supabase failed:", err);
      }
    } else {
      const { deleteBlob } = await import("@/lib/db/idb-store");
      await deleteBlob(f.id);
    }
    save(files.filter(x => x.id !== f.id));
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'files', action: 'delete', data: { id: f.id } }),
    }).catch(() => {});
  };

  const changeCategory = (id: string, newCat: string) => {
    const updated = files.map(f => f.id === id ? { ...f, category: newCat } : f);
    save(updated);
    setEditingCat(null);
  };

  const addCategory = () => {
    const name = newCatName.trim();
    if (!name || customCats.includes(name)) return;
    const updated = [...customCats, name];
    setCustomCats(updated); saveCats(updated);
    setNewCatName("");
  };
  const removeCategory = (cat: string) => {
    const updated = customCats.filter(c => c !== cat);
    setCustomCats(updated); saveCats(updated);
    const fixed = files.map(f => f.category === cat ? { ...f, category: "" } : f);
    save(fixed);
  };

  const filtered = files.filter(f => {
    if (activeCat === "uncategorized" && f.category !== "") return false;
    if (activeCat !== "all" && activeCat !== "uncategorized" && f.category !== activeCat) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const uncategorizedCount = files.filter(f => !f.category).length;
  const catCounts = [
    { key: "all", label: "全部", count: files.length },
    { key: "uncategorized", label: "未分类", count: uncategorizedCount },
    ...customCats.map(cat => ({ key: cat, label: cat, count: files.filter(f => f.category === cat).length })),
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="section-number">FL</span>
            <div className="rule-thin w-8" style={{ background: 'var(--skin-border)' }} />
          </div>
          <h1 className="editorial-section-title" style={{ color: 'var(--skin-text)' }}>
            文件
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-4xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: 'var(--skin-primary)' }}>{files.length}</span>
            <span className="text-xs tracking-[0.15em] uppercase text-[var(--skin-text-secondary)] font-bold">个文件</span>
          </div>
        </div>
        <label className={`btn cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload className="size-4" />{uploading ? `上传中 ${uploadProgress.current}/${uploadProgress.total}...` : '上传'}
          <input ref={fileRef} type="file" multiple className="hidden" onChange={upload} disabled={uploading} />
        </label>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--skin-text-secondary)] pointer-events-none" />
        <input className="input-filled w-full text-sm" style={{ paddingLeft: '2.75rem' }} placeholder="搜索文件..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--skin-text-secondary)]">
              <X className="size-3.5" />
            </button>
          )}
      </div>

      {/* Category Filter */}
      <div className="mb-8 p-4 rounded-xl" style={{ background: 'var(--skin-muted)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] tracking-[0.2em] uppercase font-bold text-[var(--skin-text-secondary)] font-mono">分类筛选</span>
          <div className="rule-thin flex-1" style={{ background: 'var(--skin-border)' }} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {catCounts.filter(c => c.count > 0 || c.key === "all").map(c => (
            <button key={c.key} onClick={() => setActiveCat(c.key)}
              className={activeCat === c.key ? "tag tag-active" : "tag"}>
              {c.label} {c.count > 0 && <span className="ml-1 opacity-70">{c.count}</span>}
            </button>
          ))}
          <button onClick={() => setShowCatManager(!showCatManager)} className="tag" style={{ borderStyle: 'dashed' }}>
            + 管理分类
          </button>
        </div>
      </div>

      {/* Category Manager */}
      {showCatManager && (
        <div className="card card-rounded-tr p-5 mb-8 animate-fade-in-scale">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-extrabold tracking-wider uppercase" style={{ color: 'var(--skin-text)' }}>管理文件分类</span>
            <button onClick={() => setShowCatManager(false)} className="text-[var(--skin-text-secondary)] hover:text-[var(--skin-text)]"><X className="size-3.5" /></button>
          </div>
          <div className="flex gap-3 mb-4">
            <input className="input-filled flex-1 text-sm" placeholder="新分类名称" value={newCatName}
                   onChange={e => setNewCatName(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && addCategory()} />
            <button onClick={addCategory} className="btn btn-sm">添加</button>
          </div>
          {customCats.length === 0 ? (
            <p className="text-xs text-[var(--skin-text-secondary)]">还没有自定义分类</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {customCats.map(cat => (
                <span key={cat} className="tag">
                  {cat}
                  <button onClick={() => removeCategory(cat)}
                          className="ml-1 text-[var(--skin-text-secondary)] hover:text-red-500 transition-colors"><X className="size-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!loaded ? (
        <div className="text-center py-24">
          <div className="size-10 mx-auto mb-4 rounded-full border-[3px] border-[var(--skin-border)] border-t-[var(--skin-primary)] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <File className="size-16 mx-auto mb-4 opacity-15" style={{ color: 'var(--skin-text-secondary)' }} />
          <p className="text-sm text-[var(--skin-text-secondary)] font-bold tracking-wider">{search ? "没有匹配" : "还没有文件"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(f => {
            const ext = f.name.split(".").pop()?.toLowerCase() || "";
            const extGroupKey = extGroup[ext] || "other";
            return (
            <div className="relative">
            <div key={f.id} className="card rounded-lg flex items-center gap-4 px-5 py-4 group">
              <div className="size-10 rounded flex items-center justify-center shrink-0" style={{ background: 'var(--skin-muted)' }}>
                {extGroupKey === "audio" ? <Music className="size-5" style={{ color: 'var(--skin-primary)' }} />
                 : extGroupKey === "video" ? <Film className="size-5" style={{ color: 'var(--skin-accent)' }} />
                 : extGroupKey === "image" ? <Image className="size-5" style={{ color: 'var(--skin-accent)' }} />
                 : extGroupKey === "archive" ? <Archive className="size-5" style={{ color: 'var(--skin-text-secondary)' }} />
                 : <FileText className="size-5" style={{ color: 'var(--skin-text-secondary)' }} />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--skin-text)' }}>{f.name}</p>
                <p className="text-[11px] text-[var(--skin-text-secondary)] mt-1 flex items-center gap-2">
                  <span className="tag">{f.type}</span>
                  <span className="font-mono">{f.size}</span>
                  <span className="font-mono">{f.createdAt ? new Date(f.createdAt).toLocaleDateString("zh-CN") : "—"}</span>
                </p>
              </div>

              {/* Category Edit */}
              <div className="relative">
                {editingCat === f.id ? (
                  <select value={f.category} onChange={(e) => changeCategory(f.id, e.target.value)}
                          onBlur={() => setEditingCat(null)}
                          className="input-filled text-xs py-1.5 px-2"
                          autoFocus>
                    <option value="">未分类</option>
                    {customCats.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                ) : (
                  <button onClick={() => setEditingCat(f.id)}
                          className="hidden sm:flex items-center gap-1 px-2 py-1 text-[10px] font-bold tracking-wider uppercase text-[var(--skin-text-secondary)] hover:text-[var(--skin-primary)] opacity-0 group-hover:opacity-100 transition-all">
                    {f.category || "未分类"} <ChevronDown className="size-2.5" />
                  </button>
                )}
              </div>

              {/* Desktop: hover 下载/删除或确认/取消 */}
              <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {confirmDelete?.id === f.id ? (
                  <>
                    <button onClick={handleDelete}
                      className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-bold whitespace-nowrap shadow-sm">
                      确认
                    </button>
                    <button onClick={() => setConfirmDelete(null)}
                      className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold whitespace-nowrap shadow-sm">
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleDownload(f)}
                            className="p-2 hover:text-[var(--skin-primary)] transition-colors">
                      <Download className="size-4" />
                    </button>
                    <button onClick={() => setConfirmDelete(f)}
                            className="p-2 hover:text-red-500 transition-colors">
                      <Trash2 className="size-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Mobile: 下载 + ⋮ — 放在 card 外面避免 overflow:hidden 裁剪 */}
            <div className="flex sm:hidden absolute right-4 top-4 items-center gap-1 z-10">
              <button onClick={() => handleDownload(f)}
                      className="p-2 hover:text-[var(--skin-primary)] transition-colors">
                <Download className="size-4" />
              </button>
              <button onClick={() => { setMenuOpenId(menuOpenId === f.id ? null : f.id); setConfirmDelete(null); }}
                      className="p-1.5 text-[var(--skin-text-secondary)] opacity-40 hover:opacity-100 transition-opacity">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                </svg>
              </button>
              {(menuOpenId === f.id || confirmDelete?.id === f.id) && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => { setMenuOpenId(null); setConfirmDelete(null); }} />
                  <div className="absolute right-0 top-full mt-1 flex gap-1.5 z-30">
                    {confirmDelete?.id === f.id ? (
                      <>
                        <button onClick={handleDelete}
                          className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-bold whitespace-nowrap shadow-sm">
                          确认
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold whitespace-nowrap shadow-sm">
                          取消
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setMenuOpenId(null); setConfirmDelete(f); }}
                        className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-bold whitespace-nowrap shadow-sm">
                        删除
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          );
          })}
        </div>
      )}
    </div>
  );
}
