"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Library, Calendar, Grid3x3, Layers, FileText, Home, Music } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import LyricsMarquee from "@/components/music/LyricsMarquee"
import SyncStatus from "@/components/shared/SyncStatus"
import { mainNavItems } from "@/lib/constants/navigation"

const iconMap: Record<string, React.ReactNode> = {
  Library: <Library className="size-4" />,
  Layers: <Layers className="size-4" />,
  Calendar: <Calendar className="size-4" />,
  FileText: <FileText className="size-4" />,
  Grid3x3: <Grid3x3 className="size-4" />,
  Music4: <Music className="size-4" />,
}

const navItems = mainNavItems.map(item => ({
  href: item.href,
  icon: iconMap[item.icon] || <FileText className="size-4" />,
  label: item.label,
}))

const authPaths = ["/login", "/signup", "/callback"]

export default function Nav() {
  const path = usePathname()

  // Auth pages have their own layout, no main navbar
  if (authPaths.some(p => path === p || path.startsWith(p + "/"))) return null

  const isActive = (href: string) =>
    path === href || (href !== "/" && path.startsWith(href))

  return (
    <>
      {/* Desktop / Tablet Top Nav — fixed at top */}
      <header
        className="hidden md:block fixed top-0 z-50 w-full border-b-2 border-[var(--skin-border)]"
        style={{ backgroundColor: "var(--skin-surface)" }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          {/* Left: Logo + Nav */}
          <div className="flex items-center shrink-0">
            <Link href="/" className="flex items-center gap-2 shrink-0 group">
              <span
                className="inline-flex items-center justify-center size-8 rounded-lg text-sm font-black select-none"
                style={{ background: 'var(--skin-primary)', color: '#fff' }}
              >
                MT
              </span>
              <span
                className="hidden sm:inline text-xl font-extrabold tracking-wider select-none"
                style={{
                  color: "var(--skin-primary)",
                  fontFamily: "var(--font-display)",
                }}
              >
                迷你兔
              </span>
            </Link>

            <nav className="flex items-center gap-1 shrink-0">
              {navItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      buttonVariants({
                        variant: active ? "secondary" : "ghost",
                        size: "sm",
                      }),
                      "gap-2 transition-all duration-200 font-bold tracking-wider",
                      active ? "" : "hover:bg-[var(--skin-muted)]"
                    )}
                    style={
                      active
                        ? {
                            color: "var(--skin-primary)",
                            borderBottom: "2px solid var(--skin-primary)",
                            borderRadius: "0",
                            background: "transparent",
                          }
                        : {}
                    }
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Lyrics area — fills space, right-aligned */}
          <div className="flex-1 flex justify-end items-center gap-3 min-w-0">
            <SyncStatus />
            <LyricsMarquee className="max-w-[320px]" />
          </div>
        </div>
      </header>

      {/* Mobile Bottom Nav — matches MobileBottomNav.tsx positioning */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t-2 border-[var(--skin-border)]"
        style={{ backgroundColor: "var(--skin-surface)" }}
      >
        <div className="flex items-center justify-around h-14">
          {/* Home */}
          <Link
            href="/"
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 text-xs font-bold tracking-wider transition-all duration-200",
              path === "/"
                ? ""
                : "text-[var(--skin-text-secondary)] hover:text-[var(--skin-text)]"
            )}
            style={
              path === "/"
                ? {
                    color: "var(--skin-primary)",
                    borderTop: "2px solid var(--skin-primary)",
                    marginTop: "-2px",
                  }
                : {}
            }
          >
            <Home className="size-5 transition-transform duration-200" />
            <span>首页</span>
          </Link>
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 text-xs font-bold tracking-wider transition-all duration-200",
                  active
                    ? ""
                    : "text-[var(--skin-text-secondary)] hover:text-[var(--skin-text)]"
                )}
                style={
                  active
                    ? {
                        color: "var(--skin-primary)",
                        borderTop: "2px solid var(--skin-primary)",
                        marginTop: "-2px",
                      }
                    : {}
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
