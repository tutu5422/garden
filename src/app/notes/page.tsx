"use client";
import { useState, useEffect } from "react";
import { Plus, Search, Trash2, ExternalLink, BookOpen, Image, Film, Wrench, FileText } from "lucide-react";
import Link from "next/link";

interface Note { id: string; title: string; content: string; type: string; tags: string[]; createdAt: string; }

const typeIcons: Record<string, any> = { link: ExternalLink, image: Image, book: BookOpen, movie: Film, tool: Wrench, article: FileText };
const typeLabels: Record<string, string> = { link: "链接", image: "图片", book: "书籍", movie: "影视", tool: "工具", article: "文章" };
const gradients = [
  "from-amber-400 to-orange-400", "from-rose-400 to-pink-400", "from-purple-400 to-violet-400",
  "from-emerald-400 to-teal-400", "from-cyan-400 to-blue-400", "from-blue-400 to-indigo-400",
  "from-fuchsia-400 to-rose-400", "from-lime-400 to-green-400",
];

function hashGradient(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return gradients[Math.abs(h) % gradients.length];
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newNote, setNewNote] = useState({ title: "", content: "", type: "article", tags: "" });

  useEffect(() => {
    try { setNotes(JSON.parse(localStorage.getItem("minitu_notes") || "[]")); } catch {}
  }, []);

  const save = (n: Note[]) => { setNotes(n); localStorage.setItem("minitu_notes", JSON.stringify(n)); };
  const add = () => {
    if (!newNote.title.trim()) return;
    const note: Note = { id: Date.now().toString(36), title: newNote.title, content: newNote.content, type: newNote.type, tags: newNote.tags.split(",").map(t => t.trim()).filter(Boolean), createdAt: new Date().toLocaleDateString("zh-CN") };
    save([note, ...notes]);
    setNewNote({ title: "", content: "", type: "article", tags: "" });
    setShowAdd(false);
  };
  const del = (id: string) => save(notes.filter(n => n.id !== id));

  const filtered = notes.filter(n => !search || n.title.includes(search) || n.content.includes(search) || n.tags.some(t => t.includes(search)));
  const today = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric" });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 animate-in fade-in duration-500">
      {/* Header: actions left, count+date right */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-sm hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors">
            <Plus className="w-4 h-4" />新建
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input className="pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 text-sm outline-none focus:ring-2 ring-amber-500 w-40 sm:w-56" placeholder="搜索..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-zinc-800 dark:text-white">{filtered.length} 篇笔记</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">{today}</p>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 space-y-3 animate-in slide-in-from-top-2 duration-200 shadow-sm">
          <input className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm outline-none focus:ring-2 ring-amber-500" placeholder="标题" value={newNote.title} onChange={e => setNewNote({ ...newNote, title: e.target.value })} />
          <textarea className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm outline-none focus:ring-2 ring-amber-500 min-h-[80px]" placeholder="内容（支持 Markdown）" value={newNote.content} onChange={e => setNewNote({ ...newNote, content: e.target.value })} />
          <div className="flex gap-2">
            <select className="px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm" value={newNote.type} onChange={e => setNewNote({ ...newNote, type: e.target.value })}>
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="flex-1 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm outline-none" placeholder="标签，逗号分隔" value={newNote.tags} onChange={e => setNewNote({ ...newNote, tags: e.target.value })} />
          </div>
          <button onClick={add} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:scale-[1.01] transition-all">发布</button>
        </div>
      )}

      {/* Waterfall grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-400 dark:text-zinc-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{search ? "没有找到匹配的笔记" : "还没有笔记，点击新建开始记录"}</p>
        </div>
      ) : (
        <div className="waterfall-notes" style={{ columnCount: 1, columnGap: "0.75rem" }}>
          <style>{`
            @media (min-width: 640px) { .waterfall-notes { column-count: 2 !important; } }
            @media (min-width: 1024px) { .waterfall-notes { column-count: 3 !important; } }
          `}</style>
          {filtered.map(n => {
            const Icon = typeIcons[n.type] || FileText;
            const g = hashGradient(n.title);
            // Vary card height slightly for waterfall effect
            const h = 80 + (n.content.length % 5) * 20;
            return (
              <div key={n.id} className="group relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5" style={{ breakInside: "avoid", marginBottom: "0.75rem" }}>
                {/* Gradient header */}
                <div className={`h-${h < 100 ? "24" : "32"} bg-gradient-to-br ${g} opacity-20 dark:opacity-15`} style={{ height: `${h}px` }}>
                  <div className="h-full flex items-center justify-center">
                    <Icon className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
                  </div>
                </div>
                {/* Content */}
                <div className="p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500 dark:text-zinc-400 font-medium">{typeLabels[n.type]}</span>
                    {n.tags.slice(0, 3).map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">#{t}</span>
                    ))}
                  </div>
                  <h3 className="font-semibold text-sm text-zinc-800 dark:text-white line-clamp-2 leading-snug group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{n.title}</h3>
                  {n.content && <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-3 leading-relaxed">{n.content}</p>}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-700/50">
                    <span className="text-[10px] text-zinc-400">{n.createdAt}</span>
                    <button onClick={(e) => { e.preventDefault(); del(n.id); }} className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
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
