"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Calendar, Plus, Trash2, FileText, Image, BookOpen, Film, Wrench, ExternalLink, Sparkles, Send } from "lucide-react";

// ===== 类型 =====

interface NoteItem {
  id: string; title: string; content: string; type: string; tags: string[];
  createdAt: string; image?: string; source: "notes";
}

interface TimelineMemo {
  id: string; content: string; createdAt: string; source: "timeline";
}

type TimelineEntry = NoteItem | TimelineMemo;

// ===== 常量 =====

const typeIcons: Record<string, any> = { link: ExternalLink, image: Image, book: BookOpen, movie: Film, tool: Wrench, article: FileText };
const typeLabels: Record<string, string> = { link: "链接", image: "图片", book: "书籍", movie: "影视", tool: "工具", article: "文章" };

// ===== 日期分组 =====

interface DayGroup { date: string; label: string; entries: TimelineEntry[] }

function groupByDate(entries: TimelineEntry[]): DayGroup[] {
  const map = new Map<string, TimelineEntry[]>();
  entries.forEach(e => {
    const d = e.createdAt.slice(0, 10);
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(e);
  });
  const groups: DayGroup[] = [];
  map.forEach((items, date) => {
    const d = new Date(date);
    const today = new Date();
    const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
    let label: string;
    if (diff === 0) label = "今天";
    else if (diff === 1) label = "昨天";
    else if (diff < 7) label = `${diff}天前`;
    else label = d.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });
    groups.push({ date, label, entries: items });
  });
  groups.sort((a, b) => b.date.localeCompare(a.date));
  return groups;
}

export default function TimelinePage() {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMemo, setNewMemo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const all: TimelineEntry[] = [];
    try {
      const notes: NoteItem[] = JSON.parse(localStorage.getItem("minitu_notes") || "[]");
      notes.forEach(n => all.push({ ...n, source: "notes" as const }));
      const memos: TimelineMemo[] = JSON.parse(localStorage.getItem("minitu_timeline") || "[]");
      memos.forEach(m => all.push({ ...m, source: "timeline" as const }));
    } catch {}
    setEntries(all);
    setLoading(false);
  }, []);

  const refresh = () => {
    const all: TimelineEntry[] = [];
    try {
      const notes: NoteItem[] = JSON.parse(localStorage.getItem("minitu_notes") || "[]");
      notes.forEach(n => all.push({ ...n, source: "notes" as const }));
      const memos: TimelineMemo[] = JSON.parse(localStorage.getItem("minitu_timeline") || "[]");
      memos.forEach(m => all.push({ ...m, source: "timeline" as const }));
    } catch {}
    setEntries(all);
  };

  const addMemo = () => {
    if (!newMemo.trim()) return;
    const memos: TimelineMemo[] = JSON.parse(localStorage.getItem("minitu_timeline") || "[]");
    const memo: TimelineMemo = {
      id: "tl-" + Date.now().toString(36),
      content: newMemo.trim(),
      createdAt: new Date().toISOString(),
      source: "timeline",
    };
    memos.unshift(memo);
    localStorage.setItem("minitu_timeline", JSON.stringify(memos));
    setNewMemo("");
    setShowForm(false);
    refresh();
  };

  const delMemo = (id: string) => {
    const memos: TimelineMemo[] = JSON.parse(localStorage.getItem("minitu_timeline") || "[]");
    localStorage.setItem("minitu_timeline", JSON.stringify(memos.filter(m => m.id !== id)));
    refresh();
  };

  const groups = groupByDate(entries);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 page-enter">
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
            <span className="text-4xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: 'var(--skin-primary)' }}>{entries.length}</span>
            <span className="text-xs tracking-[0.15em] uppercase text-[var(--skin-text-secondary)] font-bold">条记录</span>
          </div>
        </div>
        <button onClick={() => { setShowForm(!showForm); setTimeout(() => inputRef.current?.focus(), 100); }}
                className="btn">
          <Plus className="size-4" />备忘
        </button>
      </div>

      {/* New Memo Form */}
      {showForm && (
        <div className="card card-rounded-tr p-5 mb-8 animate-fade-in-scale">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="size-4" style={{ color: 'var(--skin-primary)' }} />
            <span className="text-xs font-extrabold tracking-wider uppercase" style={{ color: 'var(--skin-primary)' }}>新建时间线备忘</span>
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
        <div className="space-y-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-4 animate-pulse">
              <div className="h-5 w-16 rounded" style={{ background: 'var(--skin-muted)' }} />
              <div className="h-20 rounded-xl" style={{ background: 'var(--skin-muted)' }} />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-24">
          <Calendar className="size-12 mx-auto mb-4 opacity-15" style={{ color: 'var(--skin-text-secondary)' }} />
          <p className="text-sm font-medium text-[var(--skin-text-secondary)]">还没有任何记录</p>
          <Link href="/notes" className="inline-block mt-4 text-xs font-bold tracking-wider uppercase hover:underline" style={{ color: 'var(--skin-primary)' }}>
            去写笔记 →
          </Link>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline vertical line — thicker */}
          <div className="absolute left-5 top-2 bottom-2 w-0.5"
               style={{ background: 'linear-gradient(to bottom, var(--skin-primary), var(--skin-accent), transparent)' }} />

          <div className="space-y-10">
            {groups.map(group => (
              <div key={group.date}>
                {/* Date Header */}
                <div className="flex items-center gap-4 mb-4 pl-5">
                  <div className="relative flex items-center justify-center">
                    <div className="size-3 rounded-full z-10" style={{ backgroundColor: 'var(--skin-primary)', boxShadow: 'var(--shadow-colored)' }} />
                  </div>
                  <span className="text-xl font-extrabold tracking-wide" style={{ fontFamily: "var(--font-display)", color: 'var(--skin-text)' }}>
                    {group.label}
                  </span>
                  <span className="text-[10px] text-[var(--skin-text-secondary)] font-mono tracking-wider uppercase">{group.entries.length} 条</span>
                </div>

                {/* Entries */}
                <div className="space-y-3 pl-12">
                  {group.entries.map(entry => {
                    if (entry.source === "timeline") {
                      const memo = entry as TimelineMemo;
                      return (
                        <div key={memo.id} className="card rounded-lg p-5 group relative">
                          <p className="text-sm leading-relaxed font-medium" style={{ color: 'var(--skin-text)' }}>{memo.content}</p>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t-2 border-[var(--skin-border)]">
                            <span className="text-[10px] font-mono text-[var(--skin-text-secondary)]">
                              {new Date(memo.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <button onClick={() => delMemo(memo.id)}
                                    className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    const note = entry as NoteItem;
                    const Icon = typeIcons[note.type] || FileText;
                    return (
                      <div key={note.id} className="card rounded-lg p-5 group relative">
                        <div className="flex gap-4">
                          {note.image ? (
                            <img src={note.image} alt={note.title}
                                 className="size-16 rounded object-cover shrink-0 border-2 border-[var(--skin-border)]" />
                          ) : (
                            <div className="size-16 rounded flex items-center justify-center shrink-0" style={{ background: 'var(--skin-muted)' }}>
                              <Icon className="size-6" style={{ color: 'var(--skin-primary)', opacity: 0.5 }} />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className="tag">{typeLabels[note.type] || "笔记"}</span>
                              {note.tags?.slice(0, 2).map(t => (
                                <span key={t} className="text-[10px] text-[var(--skin-text-secondary)] font-bold">#{t}</span>
                              ))}
                            </div>
                            <h4 className="text-sm font-extrabold line-clamp-1" style={{ color: 'var(--skin-text)', fontFamily: "var(--font-display)" }}>{note.title}</h4>
                            {note.content && (
                              <p className="text-xs text-[var(--skin-text-secondary)] line-clamp-2 mt-1 leading-relaxed">{note.content}</p>
                            )}
                            <span className="text-[10px] font-mono text-[var(--skin-text-secondary)] mt-2 block">
                              {new Date(note.createdAt).toLocaleDateString("zh-CN")}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
