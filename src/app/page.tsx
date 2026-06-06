"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Library, Music, Calendar, FileText, Settings, Layers } from "lucide-react";

export default function Home() {
  const [greeting, setGreeting] = useState("");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 6 ? "夜深了 🌙" : h < 9 ? "早上好 ☀️" : h < 12 ? "上午好 🌤️" : h < 14 ? "中午好 ☀️" : h < 18 ? "下午好 🌈" : "晚上好 🌙");
  }, []);

  const cards = [
    { title: "笔记", desc: "记录生活点滴", href: "/notes", icon: Library, color: "from-blue-500 to-cyan-500" },
    { title: "合集", desc: "整理你的收藏", href: "/collections", icon: Layers, color: "from-purple-500 to-pink-500" },
    { title: "音乐", desc: "私人电台", href: "/music", icon: Music, color: "from-rose-500 to-red-500" },
    { title: "时间线", desc: "时光轨迹", href: "/timeline", icon: Calendar, color: "from-emerald-500 to-teal-500" },
    { title: "文件", desc: "资料管理", href: "/files", icon: FileText, color: "from-orange-500 to-amber-500" },
    { title: "设置", desc: "个性化", href: "/settings", icon: Settings, color: "from-zinc-500 to-slate-500" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/30 dark:from-zinc-950 dark:to-zinc-900">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
        <div className="text-center mb-12 animate-in fade-in slide-in-from-top-6 duration-700">
          <span className="text-6xl">🐰</span>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold text-zinc-800 dark:text-white">{greeting}</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2">欢迎回到你的数字花园</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
          {cards.map((c, i) => (
            <Link key={c.href} href={c.href} className="group relative overflow-hidden rounded-2xl bg-white/60 dark:bg-zinc-800/60 backdrop-blur border border-zinc-200/60 dark:border-zinc-700/60 p-5 hover:shadow-lg hover:scale-[1.02] transition-all" style={{ animationDelay: `${i * 80}ms` }}>
              <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl ${c.color} opacity-10 rounded-bl-full group-hover:scale-150 transition-transform duration-500`} />
              <c.icon className="w-7 h-7 text-zinc-700 dark:text-zinc-300 mb-3" />
              <h2 className="font-semibold text-zinc-800 dark:text-white">{c.title}</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{c.desc}</p>
            </Link>
          ))}
        </div>
        <p className="text-center text-xs text-zinc-400/60 dark:text-zinc-600 mt-16">minitu.online · 仅限主人访问</p>
      </div>
    </div>
  );
}
