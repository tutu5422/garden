"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMusic } from '@/lib/music/MusicContext';
import {
  BookOpen, Calendar, Layers, FileText, Settings,
  ArrowUpRight, Music, Clock, Sparkles, ChevronDown, Grid3x3,
  Disc3, MicVocal, Library,
} from "lucide-react";

// ===== 封面地图（首页快速展示用） =====
interface CoverMap { [key: string]: string }
let _homeCoverCache: CoverMap | null = null
async function loadHomeCoverMap(): Promise<CoverMap> {
  if (_homeCoverCache) return _homeCoverCache
  try {
    const res = await fetch('/music-covers-manifest.json')
    const data = await res.json()
    const map: CoverMap = {}
    for (const e of data) {
      if (e.coverUrl) {
        map[`${e.artist}|${e.album}`] = e.coverUrl
        if (e.album === '_default_') map[`${e.artist}|`] = e.coverUrl
      }
    }
    _homeCoverCache = map; return map
  } catch { return {} }
}

const HomeMusicPlayer = dynamic(() => import("@/components/music/HomeMusicPlayer"), { ssr: false });

import type { Resource } from '@/lib/types/database'
import { getRecentPatterns, getPatternCount } from '@/lib/api/patterns-api'

// ===== 色块调色板 — 编辑杂志 8 色系统 =====
const C = {
  burgundy:  "#8B1A2B",
  gold:      "#D4971A",
  teal:      "#0D7B6B",
  plum:      "#5B2D8E",
  sapphire:  "#1B4F8A",
  crimson:   "#BE185D",
  clay:      "#C17F6B",
  slate:     "#2D3748",
  dark:      "#1A1D23",
} as const;

// ===== 类型 =====
interface NoteItem {
  id: string; title: string; content: string; type: string; tags: string[];
  collectionId?: string; collectionName?: string;
  createdAt: string; image?: string; imageThumb?: string;
  images?: string[]; imageThumbs?: string[];
}
interface TimelineMemo { id: string; content: string; createdAt: string; source: string; }

export default function Home() {
  const [greeting, setGreeting] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [stats, setStats] = useState({ notes: 0, collections: 0, files: 0, timeline: 0 });
  const [featuredNote, setFeaturedNote] = useState<NoteItem | null>(null);
  const [recentMemos, setRecentMemos] = useState<TimelineMemo[]>([]);
  const [collectionPreviews, setCollectionPreviews] = useState<{id:string;title:string;count:number}[]>([]);
  const [recentNotes, setRecentNotes] = useState<NoteItem[]>([]);
  const [patternCount, setPatternCount] = useState(0)
  const [inProgressPatterns, setInProgressPatterns] = useState<Resource[]>([])
  const [wishlistPatterns, setWishlistPatterns] = useState<Resource[]>([])
  const [patternsLoaded, setPatternsLoaded] = useState(false)
  const musicCtx = useMusic()
  const [musicStats, setMusicStats] = useState({ tracks: 0, albums: 0, artists: 0 })
  const [homeCoverMap, setHomeCoverMap] = useState<CoverMap>({})
  const [featuredAlbums, setFeaturedAlbums] = useState<{ album: string; artist: string; coverUrl?: string }[]>([])

  // Compute music stats from context
  useEffect(() => {
    if (!musicCtx?.playlist) return
    const tracks = musicCtx.playlist
    const albumSet = new Set<string>()
    const artistSet = new Set<string>()
    for (const t of tracks) {
      if (t.album) albumSet.add(t.album)
      if (t.artist) artistSet.add(t.artist)
    }
    setMusicStats({ tracks: tracks.length, albums: albumSet.size, artists: artistSet.size })
  }, [musicCtx?.playlist])

  // Load cover map
  useEffect(() => { loadHomeCoverMap().then(setHomeCoverMap) }, [])

  // Pick featured albums (ones with covers)
  useEffect(() => {
    if (!musicCtx?.playlist || Object.keys(homeCoverMap).length === 0) return
    const seen = new Set<string>()
    const result: { album: string; artist: string; coverUrl?: string }[] = []
    for (const t of musicCtx.playlist) {
      if (!t.album || seen.has(t.album)) continue
      seen.add(t.album)
      const key = `${t.artist || ''}|${t.album}`
      const coverKey = `${t.artist || ''}|`
      const coverUrl = homeCoverMap[key] || homeCoverMap[coverKey]
      if (coverUrl) {
        result.push({ album: t.album, artist: t.artist || '', coverUrl })
        if (result.length >= 6) break
      }
    }
    setFeaturedAlbums(result)
  }, [musicCtx?.playlist, homeCoverMap])

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 6 ? "夜安" : h < 9 ? "晨安" : h < 12 ? "早安" : h < 14 ? "午安" : h < 18 ? "午后好" : "晚安");

    const now = new Date();
    setDateStr(now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }));

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

      const withImage = notes.filter(n => n.imageThumb || n.image);
      setFeaturedNote(withImage.length > 0 ? withImage[0] : notes.length > 0 ? notes[0] : null);
      setRecentNotes(notes.slice(0, 3));

      const allRecent = [...timeline.map(m => ({ ...m, source: "timeline" })), ...notes.slice(0, 3).map(n => ({
        id: n.id, content: n.title, createdAt: n.createdAt, source: "notes"
      }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
      setRecentMemos(allRecent);

      setCollectionPreviews(collections.slice(0, 4).map((c: any) => ({
        id: c.id,
        title: c.title,
        count: notes.filter((n: NoteItem) => n.collectionId === c.id).length,
      })));
      // 加载织集数据
      getPatternCount().then(setPatternCount).catch(() => {})
      Promise.all([
        getRecentPatterns(6, 'in-progress'),
        getRecentPatterns(6, 'wishlist'),
      ]).then(([inProg, wish]) => {
        setInProgressPatterns(inProg)
        setWishlistPatterns(wish)
      }).catch(() => {}).finally(() => setPatternsLoaded(true))
    } catch {}
  }, []);

  function SectionHead({ num, label }: { num: string; label: string }) {
    return (
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <span className="section-number">{num}</span>
        <div className="rule-thin flex-1" style={{ background: "var(--skin-border)" }} />
        <span className="text-[10px] tracking-[0.25em] uppercase font-bold text-[var(--skin-text-secondary)]">
          {label}
        </span>
      </div>
    );
  }

  function ArrowHint() {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-bold tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0 translate-x-1"
            style={{ color: "var(--skin-primary)" }}>
        浏览 <ArrowUpRight className="size-3.5" />
      </span>
    );
  }

  // 首页织集展示：在织排前，心愿单排后，最多 6 个
  const displayPatterns = [...inProgressPatterns, ...wishlistPatterns].slice(0, 6)

  return (
    <div className="min-h-screen" style={{ background: "var(--skin-bg)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 page-enter">

        {/* ════════════════════════════════════════════════════════
            HERO — 编辑刊头
           ════════════════════════════════════════════════════════ */}
        <header className="pt-4 sm:pt-16 pb-6 sm:pb-20">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4 sm:mb-14">
            <div>
              <p className="text-[11px] tracking-[0.2em] uppercase font-bold text-[var(--skin-text-secondary)] font-mono">
                {dateStr}
              </p>
              <p className="text-[10px] tracking-[0.15em] uppercase text-[var(--skin-text-secondary)] opacity-50 mt-1 font-mono">
                minitu.online · 私人数字花园
              </p>
            </div>
            <Link href="/settings"
              className="flex items-center gap-1 text-[10px] tracking-[0.15em] uppercase font-bold text-[var(--skin-text-secondary)] hover:text-[var(--skin-primary)] transition-colors">
              <Settings className="size-3" /> 设置
            </Link>
          </div>

          <h1 className="hidden sm:block editorial-hero mb-4 sm:mb-6" style={{ color: "var(--skin-text)" }}>
            迷你兔
          </h1>

          <div className="hidden sm:flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-4 sm:mb-8">
            <span className="editorial-hero-sub text-[var(--skin-text-secondary)]">个人数字花园</span>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--skin-primary)" }} />
            <span className="text-sm font-medium text-[var(--skin-text-secondary)] tracking-wide">{greeting}</span>
          </div>

          <div className="hidden sm:block rule-fade mb-4" />

          <div className="hidden sm:flex items-center justify-between">
            <p className="text-[13px] leading-relaxed max-w-md text-[var(--skin-text-secondary)] font-medium">
              记录思考、收集灵感、整理知识。<br />这是属于你的数字花园。
            </p>
            <span className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase font-bold text-[var(--skin-text-secondary)] opacity-40">
              向下浏览 <ChevronDown className="size-3 animate-bounce" />
            </span>
          </div>
        </header>

        {/* ════════════════════════════════════════════════════════
            SECTION 1 — 精选笔记 (2/3) + 数据概览 (1/3)
           ════════════════════════════════════════════════════════ */}
        <section className="section-gap-sm">
          <SectionHead num="01" label="精选笔记" />

          <div className="grid grid-cols-[3fr_2fr] sm:grid-cols-[2fr_1fr] gap-2 sm:gap-5">
            {featuredNote ? (
              <Link href="/notes"
                className="block-gloss rounded-2xl p-3 sm:p-10 flex flex-col justify-between min-h-[160px] sm:min-h-[400px] cursor-pointer group relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${C.burgundy}, ${C.crimson})` }}>
                {featuredNote.imageThumb && (
                  <>
                    <img src={featuredNote.imageThumb} alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-45 transition-all duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0"
                      style={{ background: `linear-gradient(135deg, ${C.burgundy}dd, ${C.crimson}cc)` }} />
                  </>
                )}

                <div className="relative z-10">
                  <span className="inline-block text-[10px] tracking-[0.25em] uppercase font-bold px-3 py-1 mb-5 border border-white/30 text-white/80 font-mono">
                    精选
                  </span>
                  <h2 className="editorial-section-title text-white mb-4 line-clamp-2"
                      style={{ textShadow: "0 2px 12px rgba(0,0,0,0.25)" }}>
                    {featuredNote.title}
                  </h2>
                  {featuredNote.content && (
                    <p className="text-sm text-white/75 line-clamp-2 max-w-lg leading-relaxed">
                      {featuredNote.content.slice(0, 120)}
                    </p>
                  )}
                </div>

                <div className="relative z-10 flex items-end justify-between mt-8">
                  <div className="flex gap-2 flex-wrap">
                    {featuredNote.tags?.slice(0, 3).map(t => (
                      <span key={t} className="text-[10px] px-2.5 py-1 rounded-full font-bold tracking-wider uppercase border border-white/25 text-white/85"
                            style={{ background: "rgba(255,255,255,0.1)" }}>#{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold tracking-widest uppercase text-white/80 group-hover:text-white transition-colors">
                      阅读全文
                    </span>
                    <ArrowUpRight className="size-4 text-white/60 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                </div>
              </Link>
            ) : (
              <Link href="/notes"
                className="block-gloss rounded-2xl p-3 sm:p-10 flex flex-col justify-center items-center text-center min-h-[160px] sm:min-h-[400px] cursor-pointer group"
                style={{ background: `linear-gradient(135deg, ${C.burgundy}, ${C.crimson})` }}>
                <BookOpen className="size-12 mb-5 text-white/30" />
                <h2 className="editorial-section-title text-white/90 mb-3">开始记录</h2>
                <p className="text-sm text-white/60 max-w-sm leading-relaxed">
                  写下第一则笔记，它会出现在杂志封面的精选位置
                </p>
                <span className="mt-6 text-xs font-bold tracking-widest uppercase text-white/50 group-hover:text-white/80 transition-colors">
                  创建笔记 →
                </span>
              </Link>
            )}

            <div className="flex flex-col justify-between gap-4">
              <div className="rounded-2xl p-4 sm:p-8 flex-1 flex flex-col justify-center"
                   style={{ background: `linear-gradient(180deg, ${C.gold}15, ${C.gold}08)` }}>
                <span className="section-number mb-4">数据</span>
                <div className="space-y-5">
                  {[
                    { label: "笔记", num: stats.notes,   color: C.teal },
                    { label: "备忘", num: stats.timeline, color: C.plum },
                    { label: "合集", num: stats.collections, color: C.sapphire },
                    { label: "图解", num: patternCount, color: C.clay },
                    { label: "文件", num: stats.files, color: C.slate },
                  ].map(s => (
                    <div key={s.label} className="flex items-end justify-between group/item">
                      <span className="text-xl sm:text-4xl font-extrabold tracking-tight"
                            style={{ fontFamily: "var(--font-display)", color: s.color }}>
                        {s.num}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] tracking-[0.15em] uppercase font-bold text-[var(--skin-text-secondary)] opacity-50">
                          {s.label}
                        </span>
                        <div className="w-6 h-px" style={{ background: s.color, opacity: 0.3 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Link href="/notes/edit"
                className="rounded-2xl p-3 sm:p-5 flex items-center justify-between cursor-pointer group transition-all hover:shadow-md"
                style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.gold}dd)` }}>
                <div>
                  <span className="text-xs font-extrabold tracking-wider uppercase"
                        style={{ color: "#1A0F00" }}>✎ 快速笔记</span>
                  <span className="block text-[10px] mt-0.5 font-medium opacity-60" style={{ color: "#1A0F00" }}>
                    灵感稍纵即逝
                  </span>
                </div>
                <ArrowUpRight className="size-4" style={{ color: "#1A0F00", opacity: 0.6 }} />
              </Link>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            SECTION 2 — 织集 · 在织 &amp; 心愿单
           ════════════════════════════════════════════════════════ */}
        <section className="section-gap-sm">
          <SectionHead num="02" label={'织集 · 在织 & 心愿单'} />

          {!patternsLoaded || displayPatterns.length === 0 ? (
            <div className="text-center py-16 rounded-2xl"
                 style={{ background: "var(--skin-muted)" }}>
              <Grid3x3 className="size-10 mx-auto mb-4 text-[var(--skin-text-secondary)] opacity-20" />
              <p className="text-sm font-medium text-[var(--skin-text-secondary)]">
                {patternsLoaded ? '还没有进行中或心愿单的图解' : '加载中...'}
              </p>
              <Link href="/patterns"
                className="inline-block mt-4 text-xs font-bold tracking-wider uppercase"
                style={{ color: "var(--skin-primary)" }}>
                {patternsLoaded ? '去织集看看 →' : ''}
              </Link>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
                {displayPatterns.map((p) => {
                  const meta = (p.metadata || {}) as Record<string, unknown>
                  const brand = (meta.patternBrand as string) || ''
                  const pStatus = (meta.patternStatus as string) || ''
                  return (
                    <Link
                      key={p.id}
                      href={`/patterns/${p.id}`}
                      className="group block rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg"
                      style={{ background: 'var(--skin-surface)', border: '1px solid var(--skin-border)', position: 'relative' }}
                    >
                      {/* 状态标记 */}
                      <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 2 }}>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase"
                              style={{
                                background: pStatus === 'in-progress' ? `${C.teal}dd` : `${C.clay}dd`,
                                color: '#fff',
                              }}>
                          {pStatus === 'in-progress' ? '在织' : '心愿'}
                        </span>
                      </div>
                      {/* 封面 */}
                      <div className="aspect-[3/4] relative overflow-hidden" style={{ background: 'var(--skin-muted)' }}>
                        {p.cover_image_url ? (
                          <img
                            src={p.cover_image_url}
                            alt={p.title}
                            className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Grid3x3 className="size-8 opacity-30" style={{ color: C.clay }} />
                          </div>
                        )}
                      </div>
                      {/* 信息 */}
                      <div className="p-2.5 sm:p-3">
                        <h4 className="text-xs sm:text-sm font-semibold leading-snug line-clamp-2 transition-colors group-hover:text-[var(--skin-primary)]"
                            style={{ color: 'var(--skin-text)' }}>
                          {p.title}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {p.category && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                                  style={{ background: `${C.clay}15`, color: C.clay }}>
                              {p.category.name}
                            </span>
                          )}
                          {brand && (
                            <span className="text-[9px] text-[var(--skin-text-secondary)] opacity-60 truncate">
                              {brand}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>

              <div className="mt-6 text-center">
                <Link href="/patterns"
                  className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase transition-all hover:gap-2"
                  style={{ color: C.clay }}>
                  浏览全部 {patternCount} 个图解 <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* ════════════════════════════════════════════════════════
            SECTION 3 — 四宫格：笔记 / 时间线 / 合集 / 文件
           ════════════════════════════════════════════════════════ */}
        <section className="section-gap-sm">
          <SectionHead num="03" label="探索" />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            {/* 笔记 */}
            <Link href="/notes"
              className="rounded-2xl p-3 sm:p-6 flex flex-col justify-between cursor-pointer group min-h-[100px] sm:min-h-[180px] transition-all duration-400 hover:shadow-lg"
              style={{ background: `linear-gradient(135deg, ${C.teal}08, ${C.teal}15)`, border: `1px solid ${C.teal}20` }}>
              <div>
                <BookOpen className="size-5 sm:size-7 mb-1.5 sm:mb-3" style={{ color: C.teal }} />
                <h3 className="text-base sm:text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--skin-text)" }}>笔记</h3>
                <p className="text-[10px] sm:text-xs text-[var(--skin-text-secondary)] leading-relaxed mt-0.5 sm:mt-1 hidden sm:block">记录思考与灵感</p>
              </div>
              <div className="flex items-center justify-between mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-[var(--skin-border)]">
                <span className="text-xl sm:text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: C.teal }}>{stats.notes}</span>
                <ArrowHint />
              </div>
            </Link>

            {/* 时间线 */}
            <Link href="/timeline"
              className="rounded-2xl p-3 sm:p-6 flex flex-col justify-between cursor-pointer group min-h-[100px] sm:min-h-[180px] transition-all duration-400 hover:shadow-lg"
              style={{ background: `linear-gradient(180deg, ${C.plum}08, ${C.plum}12)`, border: `1px solid ${C.plum}18` }}>
              <div>
                <Calendar className="size-5 sm:size-7 mb-1.5 sm:mb-3" style={{ color: C.plum }} />
                <h3 className="text-base sm:text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--skin-text)" }}>时间线</h3>
                <p className="text-[10px] sm:text-xs text-[var(--skin-text-secondary)] leading-relaxed mt-0.5 sm:mt-1 hidden sm:block">回顾时光轨迹</p>
              </div>
              <div className="flex items-center justify-between mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-[var(--skin-border)]">
                <span className="text-xl sm:text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: C.plum }}>{stats.timeline}</span>
                <ArrowHint />
              </div>
            </Link>

            {/* 合集 */}
            <Link href="/collections"
              className="rounded-2xl p-3 sm:p-6 flex flex-col justify-between cursor-pointer group min-h-[100px] sm:min-h-[180px] transition-all duration-400 hover:shadow-lg"
              style={{ background: `linear-gradient(180deg, ${C.sapphire}08, ${C.sapphire}12)`, border: `1px solid ${C.sapphire}18` }}>
              <div>
                <Layers className="size-5 sm:size-7 mb-1.5 sm:mb-3" style={{ color: C.sapphire }} />
                <h3 className="text-base sm:text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--skin-text)" }}>合集</h3>
                <p className="text-[10px] sm:text-xs text-[var(--skin-text-secondary)] leading-relaxed mt-0.5 sm:mt-1 hidden sm:block">整理知识体系</p>
              </div>
              <div className="flex items-center justify-between mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-[var(--skin-border)]">
                <span className="text-xl sm:text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: C.sapphire }}>{stats.collections}</span>
                <ArrowHint />
              </div>
            </Link>

            {/* 织集 */}
            <Link href="/patterns"
              className="rounded-2xl p-3 sm:p-6 flex flex-col justify-between cursor-pointer group min-h-[100px] sm:min-h-[180px] transition-all duration-400 hover:shadow-lg"
              style={{ background: `linear-gradient(180deg, ${C.clay}08, ${C.clay}12)`, border: `1px solid ${C.clay}18` }}>
              <div>
                <Grid3x3 className="size-5 sm:size-7 mb-1.5 sm:mb-3" style={{ color: C.clay }} />
                <h3 className="text-base sm:text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--skin-text)" }}>织集</h3>
                <p className="text-[10px] sm:text-xs text-[var(--skin-text-secondary)] leading-relaxed mt-0.5 sm:mt-1 hidden sm:block">编织图解收藏</p>
              </div>
              <div className="flex items-center justify-between mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-[var(--skin-border)]">
                <span className="text-xl sm:text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: C.clay }}>{patternCount}</span>
                <ArrowHint />
              </div>
            </Link>

            {/* 文件 — 手机端在四宫格，电脑端在音乐区 */}
            <Link href="/files"
              className="sm:hidden rounded-2xl p-3 sm:p-6 flex flex-col justify-between cursor-pointer group min-h-[100px] sm:min-h-[180px] transition-all duration-400 hover:shadow-lg"
              style={{ background: `linear-gradient(180deg, ${C.slate}08, ${C.slate}15)`, border: `1px solid ${C.slate}20` }}>
              <div>
                <FileText className="size-5 sm:size-7 mb-1.5 sm:mb-3" style={{ color: C.slate }} />
                <h3 className="text-base sm:text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--skin-text)" }}>文件</h3>
                <p className="text-[10px] sm:text-xs text-[var(--skin-text-secondary)] leading-relaxed mt-0.5 sm:mt-1 hidden sm:block">管理文档与媒体</p>
              </div>
              <div className="flex items-center justify-between mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-[var(--skin-border)]">
                <span className="text-xl sm:text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: C.slate }}>{stats.files}</span>
                <ArrowHint />
              </div>
            </Link>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            SECTION 4 — 音乐 & 文件（电脑端）
           ════════════════════════════════════════════════════════ */}
        <section className="section-gap-sm">
          <SectionHead num="04" label="音乐 &amp; 文件" />
          {/* 手机端：仅音乐全宽；电脑端：音乐左 + 文件右 */}
          <div className="flex flex-col sm:grid sm:grid-cols-[2fr_1fr] gap-2 sm:gap-5">

            {/* 音乐 — 迷你播放器 + 统计 + 精选专辑 */}
            <div className="block-gloss rounded-2xl p-4 sm:p-6 flex flex-col"
                 style={{ background: `linear-gradient(135deg, ${C.crimson}dd, ${C.crimson}, ${C.dark})` }}>
              {/* 正在播放 */}
              <div className="flex items-center gap-2.5 mb-2">
                <Music className="size-5 text-white/80" />
                <span className="text-[10px] tracking-[0.25em] uppercase font-bold text-white/70 font-mono">正在播放</span>
              </div>
              <div className="text-white">
                <HomeMusicPlayer />
              </div>

              {/* 统计条 + 浏览 */}
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[11px] text-white/60 font-mono">
                    <span className="font-bold text-white/90">{musicStats.tracks || 158}首</span>
                    <span className="w-px h-3 bg-white/10" />
                    <span className="flex items-center gap-1">
                      <Disc3 className="size-3" />
                      {musicStats.albums || 111}专辑
                    </span>
                    <span className="w-px h-3 bg-white/10" />
                    <span className="flex items-center gap-1">
                      <MicVocal className="size-3" />
                      {musicStats.artists || 96}歌手
                    </span>
                  </div>
                  <Link href="/music"
                    className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-white/70 hover:text-white transition-colors">
                    浏览全部 <ArrowUpRight className="size-3" />
                  </Link>
                </div>
              </div>

              {/* 精选专辑封面 */}
              {featuredAlbums.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none pb-1">
                  {featuredAlbums.map(a => {
                    const hue = a.album.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 360
                    return (
                      <Link key={a.album} href="/music?view=albums"
                        className="shrink-0 group/cover">
                        <div className="size-12 sm:size-14 rounded-xl overflow-hidden ring-1 ring-white/10 shadow-md transition-all duration-300 group-hover/cover:ring-white/30 group-hover/cover:scale-105 group-hover/cover:shadow-lg">
                          {a.coverUrl ? (
                            <img src={a.coverUrl} alt={a.album} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-black"
                              style={{ background: `linear-gradient(135deg, hsl(${hue}, 60%, 40%), hsl(${(hue+50)%360}, 50%, 30%))`, color: `hsl(${hue}, 40%, 80%)` }}>
                              {a.album.charAt(0)}
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] text-white/50 text-center mt-1 truncate w-12 sm:w-14">{a.artist}</p>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 文件 — 仅电脑端显示 */}
            <Link href="/files"
              className="hidden sm:flex rounded-2xl p-4 sm:p-8 flex-col justify-between cursor-pointer group min-h-[180px] sm:min-h-[240px] transition-all duration-400 hover:shadow-lg"
              style={{ background: `linear-gradient(180deg, ${C.slate}08, ${C.slate}15)`, border: `1px solid ${C.slate}20` }}>
              <div>
                <FileText className="size-6 sm:size-8 mb-2 sm:mb-3" style={{ color: C.slate }} />
                <h3 className="text-lg sm:text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--skin-text)" }}>文件</h3>
                <p className="text-xs text-[var(--skin-text-secondary)] leading-relaxed mt-1 hidden sm:block">管理文档与媒体</p>
              </div>
              <div className="flex items-center justify-between mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-[var(--skin-border)]">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: C.slate }}>{stats.files}</span>
                <ArrowHint />
              </div>
            </Link>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            SECTION 5 — 最近动态 (全宽提要)
           ════════════════════════════════════════════════════════ */}
        <section className="section-gap-sm">
          <SectionHead num="04" label="最近动态" />

          {recentMemos.length === 0 ? (
            <div className="text-center py-16 rounded-2xl"
                 style={{ background: "var(--skin-muted)" }}>
              <Sparkles className="size-10 mx-auto mb-4 text-[var(--skin-text-secondary)] opacity-20" />
              <p className="text-sm font-medium text-[var(--skin-text-secondary)]">还没有任何动态</p>
              <Link href="/timeline"
                className="inline-block mt-4 text-xs font-bold tracking-wider uppercase"
                style={{ color: "var(--skin-primary)" }}>
                写第一条备忘 →
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl p-6 sm:p-8"
                 style={{ background: `linear-gradient(180deg, ${C.dark}08, transparent)` }}>
              <ul className="activity-feed">
                {recentMemos.map((m) => (
                  <li key={m.id}>
                    <Link href={m.source === "notes" ? "/notes" : "/timeline"}
                      className="flex items-start justify-between gap-4 group/item">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--skin-text)] line-clamp-1 group-hover/item:text-[var(--skin-primary)] transition-colors">
                          {m.content}
                        </p>
                        <span className="text-[10px] font-mono text-[var(--skin-text-secondary)] opacity-50">
                          {new Date(m.createdAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold tracking-wider uppercase shrink-0 mt-0.5"
                            style={{
                              background: m.source === "notes" ? `${C.teal}18` : `${C.plum}18`,
                              color: m.source === "notes" ? C.teal : C.plum,
                            }}>
                        {m.source === "notes" ? "笔记" : "备忘"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ════════════════════════════════════════════════════════
            FOOTER
           ════════════════════════════════════════════════════════ */}
        <footer className="pt-10 pb-12 text-center">
          <div className="rule-fade mb-8" />
          <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-[var(--skin-text-secondary)] opacity-30 font-mono">
            迷你兔 · 仅限主人访问 · minitu.online
          </p>
        </footer>
      </div>
    </div>
  );
}
