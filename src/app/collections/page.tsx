"use client";
import { useState, useEffect } from "react";
import { Folder, Plus, Trash2, Layers } from "lucide-react";
import Link from "next/link";

interface Collection { id: string; name: string; notes: string[]; }
const KEY = "minitu_collections";

const gradients = [
  "from-purple-500 to-violet-500", "from-fuchsia-500 to-pink-500", "from-rose-500 to-red-500",
  "from-amber-500 to-orange-500", "from-emerald-500 to-teal-500", "from-cyan-500 to-blue-500",
];

function hashGradient(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return gradients[Math.abs(h) % gradients.length];
}

export default function Collections() {
  const [cols, setCols] = useState<Collection[]>([]);
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => { try { setCols(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch {} }, []);
  const save = (c: Collection[]) => { setCols(c); localStorage.setItem(KEY, JSON.stringify(c)); };
  const add = () => { if (!name.trim()) return; save([...cols, { id: Date.now().toString(36), name, notes: [] }]); setName(""); setDesc(""); setShow(false); };
  const del = (id: string) => save(cols.filter(c => c.id !== id));
  const today = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric" });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 shadow-sm">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-zinc-400">{today}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{cols.length} 个合集</p>
          </div>
        </div>
        <button onClick={() => setShow(!show)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors">
          <Plus className="w-4 h-4" />新建
        </button>
      </div>

      {/* Add form */}
      {show && (
        <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 space-y-3 animate-in slide-in-from-top-2 duration-200 shadow-sm">
          <input className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm outline-none focus:ring-2 ring-purple-500" placeholder="合集名称" value={name} onChange={e => setName(e.target.value)} autoFocus onKeyDown={e => e.key === "Enter" && add()} />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShow(false); setName(""); }} className="px-4 py-2 rounded-xl text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">取消</button>
            <button onClick={add} className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 text-white text-sm font-medium hover:scale-[1.02] transition-all">创建</button>
          </div>
        </div>
      )}

      {/* Collection cards */}
      {cols.length === 0 ? (
        <div className="text-center py-20 text-zinc-400 dark:text-zinc-500">
          <Folder className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">还没有合集，创建合集来归类你的笔记</p>
        </div>
      ) : (
        <div className="waterfall-cols" style={{ columnCount: 1, columnGap: "0.75rem" }}>
          <style>{`
            @media (min-width: 640px) { .waterfall-cols { column-count: 2 !important; } }
            @media (min-width: 1024px) { .waterfall-cols { column-count: 3 !important; } }
          `}</style>
          {cols.map(c => {
            const g = hashGradient(c.name);
            return (
              <Link key={c.id} href={`/notes?collection=${c.id}`} className="group block" style={{ breakInside: "avoid", marginBottom: "0.75rem" }}>
                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                  {/* Gradient header */}
                  <div className={`h-28 bg-gradient-to-br ${g} relative overflow-hidden`}>
                    <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/15 group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute -bottom-3 -left-3 w-14 h-14 rounded-full bg-white/10 group-hover:scale-125 transition-transform duration-500" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Folder className="w-9 h-9 text-white/70 drop-shadow-sm group-hover:scale-110 transition-transform duration-500" />
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-4 space-y-1.5">
                    <h3 className="font-semibold text-sm text-zinc-800 dark:text-white line-clamp-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{c.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 font-medium">{c.notes.length} 篇笔记</span>
                    </div>
                  </div>
                  {/* Delete */}
                  <button onClick={(e) => { e.preventDefault(); del(c.id); }} className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/30 dark:bg-black/20 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-red-500/80 hover:text-white transition-all text-xs text-white/80">🗑️</button>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
