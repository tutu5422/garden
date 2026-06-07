"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { BookOpen, Calendar, Layers, FileText, Settings, ArrowUpRight, Music, Clock, Sparkles, Play, Pause } from "lucide-react";

const HomeMusicPlayer = dynamic(() => import("@/components/music/HomeMusicPlayer"), { ssr: false });

// ===== 色块调色板 — 时尚杂志 8 色系统 =====
const BLOCKS = {
  burgundy:  { bg: "#8B1A2B", shadow: "rgba(139,26,43,0.35)",   accent: "#E8A817" },
  gold:      { bg: "#D4971A", shadow: "rgba(212,151,26,0.35)",   accent: "#FFF3CD" },
  teal:      { bg: "#0D7B6B", shadow: "rgba(13,123,107,0.35)",   accent: "#A3F0E0" },
  plum:      { bg: "#5B2D8E", shadow: "rgba(91,45,142,0.35)",    accent: "#D4B8F0" },
  sapphire:  { bg: "#1B4F8A", shadow: "rgba(27,79,138,0.35)",    accent: "#B8D8F8" },
  crimson:   { bg: "#BE185D", shadow: "rgba(190,24,93,0.35)",    accent: "#FBC8D8" },
  slate:     { bg: "#2D3748", shadow: "rgba(45,55,72,0.35)",     accent: "#CBD5E0" },
  dark:      { bg: "#1A1D23", shadow: "rgba(26,29,35,0.35)",     accent: "#9CA3AF" },
} as const;

// ===== 类型 =====
interface NoteItem {
  id: string; title: string; content: string; type: string; tags: string[];
  collectionId?: string; collectionName?: string;
  createdAt: string; image?: string; imageThumb?: string;
}
interface TimelineMemo { id: string; content: string; createdAt: string; source: string; }

export default function Home() {
  const [greeting, setGreeting] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [issueNum, setIssueNum] = useState("");

  const [stats, setStats] = useState({ notes: 0, collections: 0, files: 0, timeline: 0 });
  const [featuredNote, setFeaturedNote] = useState<NoteItem | null>(null);
  const [recentMemos, setRecentMemos] = useState<TimelineMemo[]>([]);
  const [collectionPreviews, setCollectionPreviews] = useState<{id:string;title:string;count:number}[]>([]);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 6 ? "夜安" : h < 9 ? "晨安" : h < 12 ? "早安" : h < 14 ? "午安" : h < 18 ? "午后好" : "晚安");

    const now = new Date();
    setDateStr(now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }));
    // 期号：年份 + 周数
    const start = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
    setIssueNum(`NO.${String(week).padStart(2, '0')}`);

    try {
      const notes: NoteItem[] = JSON.parse(localStorage.getItem("minitu_notes") || "[]");
      const timeline: TimelineMemo[] = JSON.parse(localStorage.getItem("minitu_timeline") || "[]");
      const collections = JSON.parse(localStorage.getItem("garden_collections") || "[]");
      const files = JSON.parse(localStorage.getItem("minitu_files") || "[]");

      setStats({
        notes: notes.length,
        collections: collections.length,
        files: files.length,
        timeline: timeline.length,
      });

      // 精选笔记 — 最新有图片的笔记
      const withImage = notes.filter(n => n.imageThumb || n.image);
      setFeaturedNote(withImage.length > 0 ? withImage[0] : notes.length > 0 ? notes[0] : null);

      // 最近时间线备忘
      const allRecent = [...timeline, ...notes.slice(0, 2).map(n => ({
        id: n.id, content: n.title, createdAt: n.createdAt, source: "notes"
      }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
      setRecentMemos(allRecent);

      // 合集预览
      setCollectionPreviews(collections.slice(0, 3).map((c: any) => ({
        id: c.id,
        title: c.title,
        count: notes.filter((n: NoteItem) => n.collectionId === c.id).length,
      })));
    } catch {}
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--skin-bg)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 page-enter">

        {/* ================================================================ */}
        {/* MASTHEAD — 杂志刊头                                                */}
        {/* ================================================================ */}
        <header className="mb-8 sm:mb-12">
          {/* 日期行 + 期号 */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-[11px] tracking-[0.2em] uppercase text-[var(--skin-text-secondary)] font-bold font-mono">
              {dateStr}
            </span>
            <span className="issue-label" style={{ color: 'var(--skin-primary)' }}>
              {issueNum} · 迷你兔周刊
            </span>
          </div>

          {/* 大标题 */}
          <h1 className="magazine-title text-6xl sm:text-8xl md:text-9xl mb-4"
              style={{ color: 'var(--skin-text)' }}>
            迷你兔
          </h1>

          {/* 副标题行 */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm sm:text-base font-medium text-[var(--skin-text-secondary)]">
                {greeting} · 个人数字花园
              </span>
              <span className="w-1 h-1 rounded-full" style={{ background: 'var(--skin-primary)' }} />
              <span className="text-xs tracking-widest uppercase text-[var(--skin-text-secondary)] font-bold hidden sm:inline">
                minitu.online
              </span>
            </div>
            <Link href="/settings"
              className="flex items-center gap-1.5 text-xs font-bold text-[var(--skin-text-secondary)] hover:text-[var(--skin-primary)] transition-colors">
              <Settings className="size-3.5" />设置
            </Link>
          </div>

          {/* 装饰线 */}
          <div className="decorative-line mt-5 mb-2" style={{ color: 'var(--skin-primary)' }} />
        </header>

        {/* ================================================================ */}
        {/* MAGAZINE GRID — 不等大色块布局                                      */}
        {/* ================================================================ */}

        {/* --- ROW 1: Featured Note (2/3) + Stats (1/3) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mb-4 sm:mb-5">
          {/* Featured Note — 大色块 */}
          <Link href="/notes"
            className="lg:col-span-2 card-block rounded-2xl p-6 sm:p-8 flex flex-col justify-between min-h-[240px] sm:min-h-[300px] cursor-pointer group animate-block-enter"
            style={{ backgroundColor: BLOCKS.burgundy.bg, animationDelay: "0s" }}>
            <div>
              <span className="issue-label mb-3" style={{ color: BLOCKS.burgundy.accent, borderColor: BLOCKS.burgundy.accent }}>
                精选笔记
              </span>
              {featuredNote ? (
                <>
                  <h2 className="magazine-title text-2xl sm:text-4xl text-block mt-3 line-clamp-2">
                    {featuredNote.title}
                  </h2>
                  <p className="text-sm mt-3 text-block opacity-80 line-clamp-2 max-w-lg leading-relaxed"
                     style={{ color: BLOCKS.burgundy.accent }}>
                    {featuredNote.content || "点击查看详情"}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="magazine-title text-2xl sm:text-4xl text-block mt-3">
                    开始记录
                  </h2>
                  <p className="text-sm mt-3 text-block opacity-80 max-w-lg leading-relaxed"
                     style={{ color: BLOCKS.burgundy.accent }}>
                    写下第一则笔记，它会出现在这里
                  </p>
                </>
              )}
            </div>

            {/* 底部缩略图 + 标签 */}
            <div className="flex items-end justify-between mt-6">
              <div className="flex gap-2 flex-wrap">
                {featuredNote?.tags?.slice(0, 2).map(t => (
                  <span key={t} className="text-[10px] px-2 py-1 rounded-full font-bold tracking-wider uppercase border"
                        style={{ color: BLOCKS.burgundy.accent, borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.08)' }}>
                    #{t}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-xs font-bold tracking-wider uppercase" style={{ color: BLOCKS.burgundy.accent }}>查看</span>
                <ArrowUpRight className="size-4" style={{ color: BLOCKS.burgundy.accent }} />
              </div>
            </div>

            {/* 图片（如果有） */}
            {featuredNote?.imageThumb && (
              <div className="absolute right-0 top-0 bottom-0 w-1/3 hidden sm:block">
                <img src={featuredNote.imageThumb} alt=""
                  className="img-magazine w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[var(--block-bg)]"
                     style={{ '--block-bg': BLOCKS.burgundy.bg } as React.CSSProperties} />
              </div>
            )}
          </Link>

          {/* Stats — 竖块 */}
          <div className="card-block rounded-2xl p-6 sm:p-7 flex flex-col justify-between animate-block-enter"
               style={{ backgroundColor: BLOCKS.gold.bg, animationDelay: "0.08s" }}>
            <div>
              <span className="issue-label mb-3" style={{ color: BLOCKS.gold.accent, borderColor: BLOCKS.gold.accent }}>
                数据概览
              </span>
            </div>
            <div className="space-y-4 sm:space-y-5">
              {[
                { label: "笔记", en: "Notes",   val: stats.notes },
                { label: "备忘", en: "Memos",   val: stats.timeline },
                { label: "合集", en: "Collections", val: stats.collections },
                { label: "文件", en: "Files",   val: stats.files },
              ].map(s => (
                <div key={s.en} className="flex items-end justify-between">
                  <div>
                    <span className="text-2xl sm:text-3xl font-extrabold text-block tracking-tight"
                          style={{ fontFamily: "var(--font-display)" }}>
                      {s.val}
                    </span>
                    <span className="text-[10px] tracking-widest uppercase ml-2 opacity-70 font-bold">{s.en}</span>
                  </div>
                  <span className="text-xs opacity-60 font-medium">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- ROW 2: Notes + Timeline + Collections (3 equal) --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-4 sm:mb-5">
          {/* 笔记 */}
          <Link href="/notes"
            className="card-block rounded-2xl p-6 flex flex-col justify-between min-h-[180px] cursor-pointer group animate-block-enter"
            style={{ backgroundColor: BLOCKS.teal.bg, animationDelay: "0.16s" }}>
            <div>
              <BookOpen className="size-8 mb-3" style={{ color: BLOCKS.teal.accent }} />
              <h3 className="magazine-title text-xl sm:text-2xl text-block">笔记</h3>
              <p className="text-xs mt-2 opacity-70 text-block leading-relaxed" style={{ color: BLOCKS.teal.accent }}>
                记录思考与灵感
              </p>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-3xl font-extrabold text-block" style={{ fontFamily: "var(--font-display)" }}>
                {stats.notes}
              </span>
              <ArrowUpRight className="size-5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0"
                style={{ color: BLOCKS.teal.accent }} />
            </div>
          </Link>

          {/* 时间线 */}
          <Link href="/timeline"
            className="card-block rounded-2xl p-6 flex flex-col justify-between min-h-[180px] cursor-pointer group animate-block-enter"
            style={{ backgroundColor: BLOCKS.plum.bg, animationDelay: "0.24s" }}>
            <div>
              <Calendar className="size-8 mb-3" style={{ color: BLOCKS.plum.accent }} />
              <h3 className="magazine-title text-xl sm:text-2xl text-block">时间线</h3>
              <p className="text-xs mt-2 opacity-70 text-block leading-relaxed" style={{ color: BLOCKS.plum.accent }}>
                回顾时光轨迹
              </p>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-3xl font-extrabold text-block" style={{ fontFamily: "var(--font-display)" }}>
                {stats.timeline + stats.notes}
              </span>
              <ArrowUpRight className="size-5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0"
                style={{ color: BLOCKS.plum.accent }} />
            </div>
          </Link>

          {/* 合集 */}
          <Link href="/collections"
            className="card-block rounded-2xl p-6 flex flex-col justify-between min-h-[180px] cursor-pointer group animate-block-enter sm:col-span-2 lg:col-span-1"
            style={{ backgroundColor: BLOCKS.sapphire.bg, animationDelay: "0.32s" }}>
            <div>
              <Layers className="size-8 mb-3" style={{ color: BLOCKS.sapphire.accent }} />
              <h3 className="magazine-title text-xl sm:text-2xl text-block">合集</h3>
              <p className="text-xs mt-2 opacity-70 text-block leading-relaxed" style={{ color: BLOCKS.sapphire.accent }}>
                整理知识体系
              </p>
              {/* 合集预览 */}
              {collectionPreviews.length > 0 && (
                <div className="flex gap-2 mt-4 flex-wrap">
                  {collectionPreviews.map(c => (
                    <span key={c.id} className="text-[10px] px-2 py-1 rounded-full font-bold tracking-wider"
                          style={{ background: 'rgba(255,255,255,0.12)', color: BLOCKS.sapphire.accent }}>
                      {c.title} · {c.count}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-3xl font-extrabold text-block" style={{ fontFamily: "var(--font-display)" }}>
                {stats.collections}
              </span>
              <ArrowUpRight className="size-5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0"
                style={{ color: BLOCKS.sapphire.accent }} />
            </div>
          </Link>
        </div>

        {/* --- ROW 3: Music (2/3) + Files (1/3) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mb-4 sm:mb-5">
          {/* 音乐播放器 */}
          <div className="lg:col-span-2 card-block rounded-2xl p-6 sm:p-7 animate-block-enter"
               style={{ backgroundColor: BLOCKS.crimson.bg, animationDelay: "0.40s" }}>
            <div className="flex items-center gap-2 mb-4">
              <Music className="size-5" style={{ color: BLOCKS.crimson.accent }} />
              <span className="issue-label" style={{ color: BLOCKS.crimson.accent, borderColor: BLOCKS.crimson.accent }}>
                正在播放
              </span>
            </div>
            <HomeMusicPlayer />
          </div>

          {/* 文件 */}
          <Link href="/files"
            className="card-block rounded-2xl p-6 flex flex-col justify-between min-h-[180px] cursor-pointer group animate-block-enter"
            style={{ backgroundColor: BLOCKS.slate.bg, animationDelay: "0.48s" }}>
            <div>
              <FileText className="size-8 mb-3" style={{ color: BLOCKS.slate.accent }} />
              <h3 className="magazine-title text-xl sm:text-2xl text-block">文件</h3>
              <p className="text-xs mt-2 opacity-70 text-block leading-relaxed" style={{ color: BLOCKS.slate.accent }}>
                管理文档与媒体
              </p>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-3xl font-extrabold text-block" style={{ fontFamily: "var(--font-display)" }}>
                {stats.files}
              </span>
              <ArrowUpRight className="size-5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0"
                style={{ color: BLOCKS.slate.accent }} />
            </div>
          </Link>
        </div>

        {/* --- ROW 4: 最近动态 — 全宽 --- */}
        <div className="card-block rounded-2xl p-6 sm:p-8 animate-block-enter mb-4 sm:mb-5"
             style={{ backgroundColor: BLOCKS.dark.bg, animationDelay: "0.56s" }}>
          <div className="flex items-center gap-2 mb-5">
            <Clock className="size-5" style={{ color: BLOCKS.dark.accent }} />
            <span className="issue-label" style={{ color: BLOCKS.dark.accent, borderColor: BLOCKS.dark.accent }}>
              最近动态
            </span>
          </div>

          {recentMemos.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="size-10 mx-auto mb-3" style={{ color: BLOCKS.dark.accent, opacity: 0.3 }} />
              <p className="text-sm text-block opacity-50">还没有任何动态</p>
              <Link href="/timeline" className="inline-block mt-3 text-xs font-bold tracking-wider hover:underline"
                    style={{ color: BLOCKS.dark.accent }}>
                写第一条备忘 →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentMemos.map((m, i) => (
                <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl transition-colors hover:bg-white/5 group cursor-default"
                     style={{ animationDelay: `${0.08 * i}s` }}>
                  <div className="shrink-0 mt-0.5">
                    <div className="size-2 rounded-full" style={{
                      background: i === 0 ? BLOCKS.crimson.accent :
                                  i === 1 ? BLOCKS.gold.accent :
                                  i === 2 ? BLOCKS.teal.accent : BLOCKS.sapphire.accent
                    }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-block line-clamp-1">{m.content}</p>
                    <span className="text-[10px] font-mono opacity-50 text-block">
                      {new Date(m.createdAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(255,255,255,0.1)', color: BLOCKS.dark.accent }}>
                    {m.source === "notes" ? "笔记" : "备忘"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- FOOTER --- */}
        <footer className="text-center pt-6 pb-8">
          <div className="decorative-line mb-6" style={{ color: 'var(--skin-primary)' }} />
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--skin-text-secondary)] font-bold opacity-40">
            迷你兔 · 仅限主人访问 · minitu.online
          </p>
        </footer>
      </div>
    </div>
  );
}
