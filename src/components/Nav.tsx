"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, Music, Calendar, FileText, Layers } from "lucide-react";

const nav = [
  { href: "/", icon: Home, label: "首页" },
  { href: "/notes", icon: Library, label: "笔记" },
  { href: "/collections", icon: Layers, label: "合集" },
  { href: "/timeline", icon: Calendar, label: "时间" },
  { href: "/music", icon: Music, label: "音乐" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-200/50 dark:border-zinc-800/50 z-50 md:top-0 md:bottom-auto md:border-t-0 md:border-b">
      <div className="max-w-4xl mx-auto flex items-center justify-around md:justify-start md:gap-1 md:px-4 py-2">
        <Link href="/" className="hidden md:flex items-center gap-2 mr-4 text-lg font-bold text-amber-600"><span>🐰</span><span>迷你兔</span></Link>
        {nav.map((n) => {
          const active = path === n.href || (n.href !== "/" && path.startsWith(n.href));
          return (
            <Link key={n.href} href={n.href} className={`flex flex-col md:flex-row items-center gap-0.5 md:gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm transition-colors ${active ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"}`}>
              <n.icon className="w-5 h-5 md:w-4 md:h-4" /><span>{n.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
