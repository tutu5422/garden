"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { BookOpen, Calendar, Layers, FileText, Settings } from "lucide-react";

const HomeMusicPlayer = dynamic(() => import("@/components/music/HomeMusicPlayer"), { ssr: false });

export default function Home() {
  const [greeting, setGreeting] = useState("");
  const [stats, setStats] = useState({ notes: 0, collections: 0, files: 0 });
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 6 ? "夜深了" : h < 9 ? "早安" : h < 12 ? "上午好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好");

    const now = new Date();
    setDateStr(now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }));

    try {
      const notes = JSON.parse(localStorage.getItem("minitu_notes") || "[]");
      const timeline = JSON.parse(localStorage.getItem("minitu_timeline") || "[]");
      const collections = JSON.parse(localStorage.getItem("garden_collections") || "[]");
      const files = JSON.parse(localStorage.getItem("minitu_files") || "[]");
      setStats({
        notes: notes.length + timeline.length,
        collections: collections.length,
        files: files.length,
      });
    } catch {}
  }, []);

  const cards = [
    { title: "笔记", en: "Notes", desc: "记录思考与灵感", href: "/notes", icon: BookOpen, stat: stats.notes, statLabel: "篇" },
    { title: "时间线", en: "Timeline", desc: "回顾时光轨迹", href: "/timeline", icon: Calendar, stat: stats.notes, statLabel: "条" },
    { title: "合集", en: "Collections", desc: "整理知识体系", href: "/collections", icon: Layers, stat: stats.collections, statLabel: "个" },
    { title: "文件", en: "Files", desc: "管理文档资料", href: "/files", icon: FileText, stat: stats.files, statLabel: "个" },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--skin-bg)' }}>
      <div className="max-w-5xl mx-auto px-6 py-12 sm:py-16 page-enter">
        {/* ===== HERO — Bold Serif Title ===== */}
        <header className="mb-12 sm:mb-16">
          <p className="text-xs tracking-[0.2em] uppercase text-[var(--skin-text-secondary)] font-bold mb-4 font-mono">
            {dateStr}
          </p>
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-none"
              style={{ fontFamily: "var(--font-display)", color: 'var(--skin-text)' }}>
            迷你兔
          </h1>
          <p className="text-sm sm:text-base text-[var(--skin-text-secondary)] mt-3 font-medium">
            {greeting} · 个人数字花园
          </p>

          {/* Stats Row — Big Numbers */}
          <div className="flex items-center gap-8 mt-8 flex-wrap">
            {cards.map((c) => (
              <div key={c.href} className="flex flex-col">
                <span className="stat-number" style={{ color: 'var(--skin-primary)' }}>{c.stat}</span>
                <span className="text-[10px] tracking-widest uppercase text-[var(--skin-text-secondary)] font-bold mt-1">
                  {c.en} · {c.statLabel}
                </span>
              </div>
            ))}
            <Link href="/settings" className="flex items-center gap-1.5 text-xs font-bold text-[var(--skin-text-secondary)] hover:text-[var(--skin-primary)] transition-colors ml-auto pb-1">
              <Settings className="size-3.5" />设置
            </Link>
          </div>
        </header>

        {/* ===== 2x2 Grid + Music ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 animate-stagger">
          {cards.map((c) => (
            <Link key={c.href} href={c.href} className="card card-hover card-rounded-tl p-6 sm:p-8 flex flex-col gap-4 group cursor-pointer">
              {/* Icon */}
              <div className="size-12 rounded-lg flex items-center justify-center shrink-0"
                   style={{ background: 'var(--skin-primary)', color: '#fff' }}>
                <c.icon className="size-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg sm:text-xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: 'var(--skin-text)' }}>
                  {c.title}
                </h3>
                <p className="text-[10px] tracking-[0.15em] uppercase text-[var(--skin-text-secondary)] font-bold mt-1">{c.en}</p>
                <p className="text-xs text-[var(--skin-text-secondary)] mt-2 leading-relaxed">{c.desc}</p>
              </div>
              <div className="flex items-end justify-between pt-2 border-t-2 border-[var(--skin-border)]">
                <span className="text-4xl font-extrabold" style={{ color: 'var(--skin-primary)', fontFamily: "var(--font-display)" }}>{c.stat}</span>
                <span className="text-[11px] font-bold tracking-wider uppercase text-[var(--skin-text-secondary)]">{c.statLabel}</span>
              </div>
            </Link>
          ))}

          {/* Music Card */}
          <div className="card card-rounded-br p-6 sm:p-8 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs tracking-[0.15em] uppercase font-extrabold" style={{ color: 'var(--skin-primary)', fontFamily: "var(--font-display)" }}>
                🎵 音乐
              </span>
            </div>
            <HomeMusicPlayer />
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center mt-16 pb-8">
          <div className="divider-bold mb-6" />
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--skin-text-secondary)] font-bold opacity-40">
            minitu.online · 仅限主人访问
          </p>
        </footer>
      </div>
    </div>
  );
}
