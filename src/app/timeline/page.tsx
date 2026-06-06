"use client";
import { useState, useEffect, useMemo } from "react";
import { Calendar, Eye, EyeOff, ExternalLink, BookOpen, Image, Film, Wrench, FileText, Trash2 } from "lucide-react";

interface TimelineItem { id: string; date: string; title: string; content: string; source: "event" | "note"; type?: string; tags?: string[]; }

const typeIcons: Record<string, any> = { link: ExternalLink, image: Image, book: BookOpen, movie: Film, tool: Wrench, article: FileText };
const typeLabels: Record<string, string> = { link: "链接", image: "图片", book: "书籍", movie: "影视", tool: "工具", article: "文章" };
const typeColors: Record<string, string> = {
  link: "border-l-blue-400", image: "border-l-rose-400", book: "border-l-amber-400",
  movie: "border-l-purple-400", tool: "border-l-zinc-400", article: "border-l-emerald-400",
};

function groupByDate(items: TimelineItem[]) {
  const map = new Map<string, TimelineItem[]>();
  items.forEach(item => {
    if (!map.has(item.date)) map.set(item.date, []);
    map.get(item.date)!.push(item);
  });
  const groups: { date: string; label: string; items: TimelineItem[]; }[] = [];
  map.forEach((items, date) => {
    const d = new Date(date);
    const today = new Date();
    const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
    let label: string;
    if (diff === 0) label = "今天";
    else if (diff === 1) label = "昨天";
    else if (diff < 7) label = `${diff}天前`;
    else label = d.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });
    groups.push({ date, label, items });
  });
  groups.sort((a, b) => b.date.localeCompare(a.date));
  return groups;
}

export default function Timeline() {
  const [events, setEvents] = useState<TimelineItem[]>([]);
  const [hideNotes, setHideNotes] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newEvent, setNewEvent] = useState({ date: new Date().toISOString().split("T")[0], title: "", content: "" });

  useEffect(() => {
    const allItems: TimelineItem[] = [];
    // Load timeline events
    try {
      const evs = JSON.parse(localStorage.getItem("minitu_timeline") || "[]");
      evs.forEach((e: any) => allItems.push({ ...e, source: "event" as const }));
    } catch {}
    // Load notes and merge
    try {
      const notes = JSON.parse(localStorage.getItem("minitu_notes") || "[]");
      notes.forEach((n: any) => allItems.push({
        id: "note-" + n.id,
        date: n.createdAt,
        title: n.title,
        content: n.content,
        source: "note" as const,
        type: n.type || "article",
        tags: n.tags || [],
      }));
    } catch {}
    allItems.sort((a, b) => b.date.localeCompare(a.date));
    setEvents(allItems);
  }, []);

  const saveEvents = () => {
    const pureEvents = events.filter(e => e.source === "event").map(({ source, type, tags, ...rest }) => rest);
    localStorage.setItem("minitu_timeline", JSON.stringify(pureEvents));
  };

  const add = () => {
    if (!newEvent.title.trim()) return;
    const ev: TimelineItem = { id: Date.now().toString(36), date: newEvent.date, title: newEvent.title, content: newEvent.content, source: "event" };
    setEvents([ev, ...events]);
    setNewEvent({ date: new Date().toISOString().split("T")[0], title: "", content: "" });
    setShowAdd(false);
    // Save after state update
    setTimeout(() => {
      const updated = [ev, ...events];
      const pure = updated.filter(e => e.source === "event").map(({ source, type, tags, ...rest }) => rest);
      localStorage.setItem("minitu_timeline", JSON.stringify(pure));
    }, 50);
  };

  const del = (id: string) => {
    const updated = events.filter(e => e.id !== id);
    setEvents(updated);
    if (!id.startsWith("note-")) {
      const pure = updated.filter(e => e.source === "event").map(({ source, type, tags, ...rest }) => rest);
      localStorage.setItem("minitu_timeline", JSON.stringify(pure));
    }
  };

  const filtered = hideNotes ? events.filter(e => e.source !== "note") : events;
  const groups = groupByDate(filtered);
  const today = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
  const noteCount = events.filter(e => e.source === "note").length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-sm">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-zinc-400">{today}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{filtered.length} 条记录{!hideNotes && noteCount > 0 ? `（含 ${noteCount} 篇笔记）` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Hide notes toggle */}
          <button
            onClick={() => setHideNotes(!hideNotes)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              hideNotes ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
            }`}
          >
            {hideNotes ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {hideNotes ? "已隐藏笔记" : "隐藏笔记"}
          </button>
          <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-sm hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors">+ 记录</button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 space-y-3 animate-in slide-in-from-top-2 duration-200 shadow-sm">
          <input type="date" className="px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm w-full" value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} />
          <input className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm outline-none focus:ring-2 ring-emerald-500" placeholder="标题" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} />
          <textarea className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm min-h-[60px] outline-none" placeholder="内容" value={newEvent.content} onChange={e => setNewEvent({ ...newEvent, content: e.target.value })} />
          <button onClick={add} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium hover:scale-[1.01] transition-all">记录</button>
        </div>
      )}

      {/* Timeline */}
      {groups.length === 0 ? (
        <div className="text-center py-20 text-zinc-400 dark:text-zinc-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">还没有记录，点击右上角开始记录时间线</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-emerald-300 dark:from-emerald-700 to-transparent" />
          <div className="space-y-8">
            {groups.map(group => (
              <div key={group.date}>
                {/* Date label */}
                <div className="flex items-center gap-3 mb-3 pl-[17px]">
                  <div className="size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950 flex-shrink-0" />
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{group.label}</span>
                  <span className="text-xs text-zinc-400">{group.items.length} 条</span>
                </div>

                {/* Items */}
                <div className="space-y-2 pl-11">
                  {group.items.map(item => {
                    const isNote = item.source === "note";
                    const Icon = isNote && item.type ? (typeIcons[item.type] || FileText) : Calendar;
                    const color = isNote && item.type ? typeColors[item.type] : "border-l-emerald-400";
                    return (
                      <div key={item.id} className={`group relative p-3 rounded-xl bg-white dark:bg-zinc-800/80 border border-l-2 ${color} border-zinc-200/60 dark:border-zinc-700/60 hover:shadow-md transition-shadow`}>
                        {/* Thumbnail area */}
                        <div className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                            isNote ? "bg-zinc-100 dark:bg-zinc-700/50" : "bg-emerald-100 dark:bg-emerald-950/30"
                          }`}>
                            <Icon className={`w-5 h-5 ${isNote ? "text-zinc-500" : "text-emerald-600 dark:text-emerald-400"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {isNote && item.type && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500 dark:text-zinc-400 font-medium">
                                  {typeLabels[item.type]}
                                </span>
                              )}
                              {isNote && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                                  笔记
                                </span>
                              )}
                            </div>
                            <h4 className="font-medium text-sm text-zinc-800 dark:text-white line-clamp-1">{item.title}</h4>
                            {item.content && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">{item.content}</p>}
                            {isNote && item.tags && item.tags.length > 0 && (
                              <div className="flex gap-1 mt-1.5 flex-wrap">
                                {item.tags.map((t: string) => (
                                  <span key={t} className="text-[9px] px-1 py-0.5 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400">#{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button onClick={() => del(item.id)} className="flex-shrink-0 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
