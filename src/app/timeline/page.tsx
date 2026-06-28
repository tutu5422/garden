"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Calendar, Plus, Trash2, Sparkles, Send, Clock, FileText, Pencil } from "lucide-react";

// ===== 类型 =====

interface NoteItem {
  id: string; title: string; content: string; type: string; tags: string[];
  collectionName?: string;
  createdAt: string; image?: string; source: "notes";
}

interface TimelineMemo {
  id: string; content: string; createdAt: string; source: "timeline";
}

// ===== 编辑狂想色板 =====
const C = { plum: '#5B2D8E', teal: '#0D7B6B', gold: '#D4971A', primary: 'var(--skin-primary)' };

// ===== 混合排序区间 =====

interface TimeSlot {
  time: string;        // HH:MM
  fullTime: string;    // ISO
  memos: TimelineMemo[];
  notes: NoteItem[];
}

function buildSlots(entries: (NoteItem | TimelineMemo)[]): TimeSlot[] {
  // 按时间排序（新→旧）
  const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // 按 30 分钟粒度聚合
  const slots: TimeSlot[] = [];
  sorted.forEach(e => {
    const d = new Date(e.createdAt);
    // 30分钟粒度
    d.setMinutes(Math.floor(d.getMinutes() / 30) * 30, 0, 0);
    const timeKey = d.toISOString();

    let slot = slots.find(s => s.fullTime === timeKey);
    if (!slot) {
      const now = new Date();
      const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
      let dateLabel: string;
      if (diff === 0) dateLabel = "今天";
      else if (diff === 1) dateLabel = "昨天";
      else dateLabel = d.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });

      slot = {
        time: `${dateLabel} ${d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
        fullTime: timeKey,
        memos: [],
        notes: [],
      };
      slots.push(slot);
    }

    if (e.source === "timeline") {
      slot.memos.push(e as TimelineMemo);
    } else {
      slot.notes.push(e as NoteItem);
    }
  });

  return slots;
}

// === 交错合并 memo/note（按精确时间排序） ===
type MergedItem =
  | { kind: 'memo'; time: string; memo: TimelineMemo }
  | { kind: 'note'; time: string; note: NoteItem };

function mergeSlotItems(slot: TimeSlot): MergedItem[] {
  const items: MergedItem[] = [
    ...slot.memos.map(m => ({ kind: 'memo' as const, time: m.createdAt, memo: m })),
    ...slot.notes.map(n => ({ kind: 'note' as const, time: n.createdAt, note: n })),
  ];
  return items.sort((a, b) => b.time.localeCompare(a.time));
}

// 墓碑 key：记录已删除的备忘 ID，防止下次从云端合并时复活
const DELETED_MEMOS_KEY = 'minitu_timeline_deleted';

// 模块级去重：同一个页面生命周期内只发起一次 /api/sync GET，
// 避免组件重挂载或 StrictMode 双调用导致重复全量拉取。
let _syncTimelineMemosPromise: Promise<TimelineMemo[]> | null = null;

// 从云端拉取 timeline 备忘（/api/sync GET 返回 timelineMemos 字段）
async function syncTimelineMemosFromCloud(): Promise<TimelineMemo[]> {
  if (_syncTimelineMemosPromise) return _syncTimelineMemosPromise;
  _syncTimelineMemosPromise = (async () => {
    try {
      const res = await fetch('/api/sync', { method: 'GET' });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.timelineMemos || []).map((r: any) => ({
        id: r.id,
        content: r.metadata?.content || r.content || r.title || '',
        createdAt: r.createdAt || r.created_at || new Date().toISOString(),
        source: 'timeline' as const,
      }));
    } catch { return []; }
  })();
  _syncTimelineMemosPromise.catch(() => { _syncTimelineMemosPromise = null; });
  return _syncTimelineMemosPromise;
}

export default function TimelinePage() {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMemo, setNewMemo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; content: string } | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const load = async () => {
      const all: (NoteItem | TimelineMemo)[] = [];
      let localMemos: TimelineMemo[] = [];
      try {
        const notes: NoteItem[] = JSON.parse(localStorage.getItem("minitu_notes") || "[]");
        notes.forEach(n => all.push({ ...n, source: "notes" as const }));
        localMemos = JSON.parse(localStorage.getItem("minitu_timeline") || "[]");
      } catch {}

      // 从云端拉取 timeline 备忘并合并（带墓碑过滤，防止已删备忘复活）
      const cloudMemos = await syncTimelineMemosFromCloud();
      if (cloudMemos.length > 0) {
        const deletedIds: string[] = (() => {
          try { return JSON.parse(localStorage.getItem(DELETED_MEMOS_KEY) || "[]"); } catch { return []; }
        })();
        const deletedSet = new Set(deletedIds);
        const merged = new Map<string, TimelineMemo>();
        for (const m of localMemos) merged.set(m.id, { ...m, source: "timeline" });
        for (const m of cloudMemos) {
          if (deletedSet.has(m.id)) continue; // 跳过已删除的备忘
          const existing = merged.get(m.id);
          if (!existing || new Date(m.createdAt) > new Date(existing.createdAt)) {
            merged.set(m.id, { ...m, source: "timeline" });
          }
        }
        const mergedList = Array.from(merged.values());
        // 本地与云端有差异时回写 localStorage
        if (mergedList.length !== localMemos.length || cloudMemos.some(c => !localMemos.find(l => l.id === c.id))) {
          localStorage.setItem("minitu_timeline", JSON.stringify(mergedList));
          localMemos = mergedList;
        }
      }

      localMemos.forEach(m => all.push({ ...m, source: "timeline" as const }));
      setSlots(buildSlots(all));
      setLoading(false);
    };
    load();
  }, []);

  const refresh = () => {
    const all: (NoteItem | TimelineMemo)[] = [];
    try {
      const notes: NoteItem[] = JSON.parse(localStorage.getItem("minitu_notes") || "[]");
      notes.forEach(n => all.push({ ...n, source: "notes" as const }));
      const memos: TimelineMemo[] = JSON.parse(localStorage.getItem("minitu_timeline") || "[]");
      memos.forEach(m => all.push({ ...m, source: "timeline" as const }));
    } catch {}
    setSlots(buildSlots(all));
  };

  // 同步单条备忘到云端（fire-and-forget）
  const syncTimelineMemo = (memo: TimelineMemo) => {
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'timeline_memo', action: 'upsert', data: memo }),
    }).catch((e) => console.warn('[sync] timeline memo sync failed:', e));
  };
  const syncTimelineMemoDelete = (id: string) => {
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'timeline_memo', action: 'delete', data: { id } }),
    }).catch((e) => console.warn('[sync] timeline memo delete failed:', e));
  };

  const addMemo = () => {
    if (!newMemo.trim()) return;
    const memos: TimelineMemo[] = JSON.parse(localStorage.getItem("minitu_timeline") || "[]");
    const memo: TimelineMemo = {
      id: crypto.randomUUID?.() || 'tl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      content: newMemo.trim(),
      createdAt: new Date().toISOString(),
      source: "timeline",
    };
    memos.unshift(memo);
    localStorage.setItem("minitu_timeline", JSON.stringify(memos));
    syncTimelineMemo(memo);
    setNewMemo("");
    setShowForm(false);
    refresh();
  };

  const delMemo = (id: string) => {
    const memos: TimelineMemo[] = JSON.parse(localStorage.getItem("minitu_timeline") || "[]");
    localStorage.setItem("minitu_timeline", JSON.stringify(memos.filter(m => m.id !== id)));
    syncTimelineMemoDelete(id);
    // 记录墓碑，防止云端合并时复活
    try {
      const deleted = JSON.parse(localStorage.getItem(DELETED_MEMOS_KEY) || "[]");
      if (!deleted.includes(id)) deleted.push(id);
      localStorage.setItem(DELETED_MEMOS_KEY, JSON.stringify(deleted));
    } catch {}
    refresh();
  };

  const handleDeleteMemo = () => {
    if (!confirmDelete) return;
    delMemo(confirmDelete.id);
    setConfirmDelete(null);
  };

  const totalCount = slots.reduce((sum, s) => sum + s.memos.length + s.notes.length, 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 page-enter">
      {/* Header — Editorial */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="section-number">TL</span>
            <div className="rule-thin w-8" style={{ background: 'var(--skin-border)' }} />
          </div>
          <h1 className="editorial-section-title" style={{ color: 'var(--skin-text)' }}>
            时间线
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-4xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: 'var(--skin-primary)' }}>{totalCount}</span>
            <span className="text-xs tracking-[0.15em] uppercase text-[var(--skin-text-secondary)] font-bold">条记录</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setShowForm(!showForm); setTimeout(() => inputRef.current?.focus(), 100); }}
                  className="btn">
            <Plus className="size-4" />备忘
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-8 text-[10px] font-bold tracking-wider uppercase">
        <div className="flex items-center gap-2">
          <div className="size-2.5 rounded-sm" style={{ background: C.plum }} />
          <span className="text-[var(--skin-text-secondary)]">备忘</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2.5 rounded-sm" style={{ background: C.teal }} />
          <span className="text-[var(--skin-text-secondary)]">笔记</span>
        </div>
      </div>

      {/* New Memo Form */}
      {showForm && (
        <div className="card card-rounded-tr p-5 mb-8 animate-fade-in-scale">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="size-4" style={{ color: C.plum }} />
            <span className="text-xs font-extrabold tracking-wider uppercase" style={{ color: C.plum }}>新建备忘</span>
          </div>
          <textarea ref={inputRef} value={newMemo} onChange={e => setNewMemo(e.target.value)}
                    className="input min-h-[60px] text-sm resize-none"
                    placeholder="记录此刻的想法..."
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addMemo(); } }} />
          <div className="flex justify-end gap-3 mt-3">
            <button onClick={() => { setShowForm(false); setNewMemo(""); }}
                    className="btn btn-ghost btn-sm">取消</button>
            <button onClick={addMemo} disabled={!newMemo.trim()}
                    className="btn btn-sm">
              <Send className="size-3" />发布
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="grid grid-cols-2 gap-6 animate-pulse">
              <div className="h-16 rounded-xl" style={{ background: 'var(--skin-muted)' }} />
              <div className="h-16 rounded-xl" style={{ background: 'var(--skin-muted)' }} />
            </div>
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-24">
          <Calendar className="size-12 mx-auto mb-4 opacity-15" style={{ color: 'var(--skin-text-secondary)' }} />
          <p className="text-sm font-medium text-[var(--skin-text-secondary)]">还没有任何记录</p>
          <Link href="/notes" className="inline-block mt-4 text-xs font-bold tracking-wider uppercase hover:underline" style={{ color: 'var(--skin-primary)' }}>
            去写笔记 →
          </Link>
        </div>
      ) : (
        /* === 双轨时间线 === */
        <div className="relative">
          {/* Center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-px"
               style={{ background: `linear-gradient(to bottom, var(--skin-primary), var(--skin-accent), transparent 95%)` }} />

          <div className="space-y-4">
            {slots.map((slot, idx) => {
              const items = mergeSlotItems(slot);
              return (
              <div key={slot.fullTime + idx} className="relative">
                {/* Time label */}
                <div className="flex items-center justify-center mb-3">
                  <div className="hidden md:flex items-center gap-3">
                    <div className="rule-thin w-12" style={{ background: 'var(--skin-border)' }} />
                    <div className="size-2 rounded-full z-10 shrink-0" style={{ backgroundColor: 'var(--skin-primary)', boxShadow: 'var(--shadow-colored)' }} />
                    <span className="text-[10px] font-mono text-[var(--skin-text-secondary)] tracking-wider uppercase font-bold">
                      {slot.time}
                    </span>
                    <div className="rule-thin w-12" style={{ background: 'var(--skin-border)' }} />
                  </div>
                  <span className="md:hidden text-[10px] font-mono text-[var(--skin-text-secondary)] tracking-wider uppercase font-bold">
                    {slot.time}
                  </span>
                </div>

                {/* 交错双轨：每行只占一侧，对侧留空 */}
                {items.length === 0 ? (
                  <div className="hidden md:grid grid-cols-2 gap-8">
                    <div style={{ minHeight: '60px' }} />
                    <div style={{ minHeight: '60px' }} />
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {items.map((item) => (
                      <div key={item.kind === 'memo' ? item.memo.id : item.note.id}
                           className="grid grid-cols-2 gap-1.5 md:gap-8">
                        {item.kind === 'memo' ? (
                          <>
                            {/* 备忘 — 左侧 */}
                            <div className="md:pr-6 md:text-right">
                              <div className="relative">
                              <div className="card rounded-xl p-2.5 sm:p-5 group"
                                   style={{ borderLeft: `3px solid ${C.plum}` }}>
                                <div className="hidden md:block absolute -right-[calc(1rem+4px)] top-5 size-2 rounded-full"
                                     style={{ background: C.plum, boxShadow: `0 0 8px ${C.plum}66` }} />
                                <p className="text-xs sm:text-sm leading-relaxed font-medium" style={{ color: 'var(--skin-text)' }}>
                                  {item.memo.content}
                                </p>
                                <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-3 border-t-2 border-[var(--skin-border)] md:flex-row-reverse">
                                  <span className="text-[10px] font-mono text-[var(--skin-text-secondary)]">
                                    {new Date(item.memo.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                  {/* Desktop: hover 删除或确认/取消 */}
                                  {confirmDelete?.id === item.memo.id ? (
                                    <span className="hidden sm:flex gap-1.5">
                                      <button onClick={handleDeleteMemo}
                                              className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-bold whitespace-nowrap shadow-sm">
                                        确认
                                      </button>
                                      <button onClick={() => setConfirmDelete(null)}
                                              className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold whitespace-nowrap shadow-sm">
                                        取消
                                      </button>
                                    </span>
                                  ) : (
                                    <button onClick={() => setConfirmDelete({ id: item.memo.id, content: item.memo.content })}
                                            className="hidden sm:block p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Mobile: ⋮ — 放在 card 外面避免 overflow:hidden 裁剪 */}
                              <div className="sm:hidden absolute top-3 right-3 z-10">
                                <button onClick={() => { setMenuOpenId(menuOpenId === item.memo.id ? null : item.memo.id); setConfirmDelete(null); }}
                                        className="p-1 text-[var(--skin-text-secondary)] opacity-40 hover:opacity-100 transition-opacity">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                                  </svg>
                                </button>
                                {(menuOpenId === item.memo.id || confirmDelete?.id === item.memo.id) && (
                                  <>
                                    <div className="fixed inset-0 z-20" onClick={() => { setMenuOpenId(null); setConfirmDelete(null); }} />
                                    <div className="absolute right-0 top-full mt-1 flex gap-1.5 z-30">
                                      {confirmDelete?.id === item.memo.id ? (
                                        <>
                                          <button onClick={handleDeleteMemo}
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
                                          onClick={() => { setMenuOpenId(null); setConfirmDelete({ id: item.memo.id, content: item.memo.content }); }}
                                          className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-bold whitespace-nowrap shadow-sm">
                                          删除
                                        </button>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            </div>
                            {/* 右侧留空 */}
                            <div style={{ minHeight: '40px' }} />
                          </>
                        ) : (
                          <>
                            {/* 左侧留空 */}
                            <div style={{ minHeight: '40px' }} />
                            {/* 笔记 — 右侧 */}
                            <div className="md:pl-6">
                              <Link href={`/notes/edit?id=${item.note.id}`}
                                 className="card rounded-xl p-2.5 sm:p-5 group relative block hover:shadow-md transition-all duration-300"
                                 style={{ borderLeft: `3px solid ${C.teal}` }}>
                                <div className="hidden md:block absolute -left-[calc(1rem+4px)] top-5 size-2 rounded-full"
                                     style={{ background: C.teal, boxShadow: `0 0 8px ${C.teal}66` }} />
                                <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                                  <Clock className="size-2.5 sm:size-3" style={{ color: C.teal }} />
                                  <span className="text-[9px] sm:text-[10px] font-bold tracking-wider uppercase" style={{ color: C.teal }}>
                                    笔记
                                  </span>
                                  {item.note.collectionName && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                                          style={{ background: `${C.teal}15`, color: C.teal }}>
                                      {item.note.collectionName}
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xs sm:text-sm font-extrabold line-clamp-1 mb-0.5 sm:mb-1"
                                    style={{ color: 'var(--skin-text)', fontFamily: 'var(--font-display)' }}>
                                  {item.note.title}
                                </h4>
                                {item.note.content && (
                                  <p className="text-[10px] sm:text-xs text-[var(--skin-text-secondary)] line-clamp-2 leading-relaxed">
                                    {item.note.content.slice(0, 50)}
                                  </p>
                                )}
                                {item.note.tags?.length > 0 && (
                                  <div className="flex gap-1 flex-wrap mt-1.5 sm:mt-2">
                                    {item.note.tags.slice(0, 2).map(t => (
                                      <span key={t} className="text-[9px] sm:text-[10px] text-[var(--skin-text-secondary)] font-bold">#{t}</span>
                                    ))}
                                  </div>
                                )}
                                <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-3 border-t-2 border-[var(--skin-border)]">
                                  <span className="text-[10px] font-mono text-[var(--skin-text-secondary)]">
                                    {new Date(item.note.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                  <Pencil className="size-3 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" style={{ color: C.teal }} />
                                </div>
                              </Link>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )})}
          </div>
        </div>
      )}
    </div>
  );
}
