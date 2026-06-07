"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Library, Calendar, Layers, FileText } from "lucide-react";

const nav = [
  { href: "/notes", icon: Library, label: "笔记" },
  { href: "/timeline", icon: Calendar, label: "时间" },
  { href: "/collections", icon: Layers, label: "合集" },
  { href: "/files", icon: FileText, label: "文件" },
];

const richPaths = ["/login", "/signup", "/callback", "/resources", "/categories", "/tags", "/search", "/profile", "/visitors", "/collections", "/timeline"];

export default function Nav() {
  const path = usePathname();
  if (richPaths.some(p => path === p || path.startsWith(p + "/"))) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:top-0 md:bottom-auto border-t-2 md:border-t-0 md:border-b-2 border-[var(--skin-border)]"
         style={{ backgroundColor: 'var(--skin-surface)' }}>
      <div className="max-w-5xl mx-auto flex items-center justify-around md:justify-start md:gap-1 md:px-4 py-2">
        <Link href="/" className="hidden md:flex items-center gap-2 mr-4 group">
          <span className="text-lg font-extrabold tracking-wider" style={{ fontFamily: "var(--font-display)", color: "var(--skin-primary)" }}>
            迷你兔
          </span>
        </Link>
        {nav.map((n) => {
          const active = path === n.href || (n.href !== "/" && path.startsWith(n.href));
          return (
            <Link key={n.href} href={n.href}
              className={`flex flex-col md:flex-row items-center gap-0.5 md:gap-1.5 px-3 py-1.5 text-xs md:text-sm transition-all duration-200 font-bold tracking-wider ${
                active ? "" : "text-[var(--skin-text-secondary)] hover:text-[var(--skin-text)]"
              }`}
              style={active ? {
                color: 'var(--skin-primary)',
                borderBottom: '2px solid var(--skin-primary)',
                marginBottom: '-2px',
              } : {}}>
              <n.icon className="size-5 md:size-4" />
              <span>{n.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
