'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import {
  Library,
  Layers,
  Calendar,
  FileText,
  Menu,
  PlusCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { mainNavItems } from '@/lib/constants/navigation'
import SearchBar from '@/components/shared/SearchBar'
import SkinToggle from '@/components/theme/SkinToggle'
import UserMenu from '@/components/layout/UserMenu'
import LyricsMarquee from '@/components/music/LyricsMarquee'

const iconMap: Record<string, React.ReactNode> = {
  Library: <Library className="size-4" />,
  Layers: <Layers className="size-4" />,
  Calendar: <Calendar className="size-4" />,
  FileText: <FileText className="size-4" />,
}

export default function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-[var(--skin-border)]" style={{ backgroundColor: 'var(--skin-surface)' }}>
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
        {/* Left group: Logo + Nav + LyricsMarquee */}
        <div className="flex items-center flex-1 min-w-0">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0 group">
            <span
              className="inline-flex items-center justify-center size-8 rounded-lg text-sm font-black select-none"
              style={{ background: 'var(--skin-primary)', color: '#fff' }}
            >
              MT
            </span>
            <span
              className="hidden sm:inline text-xl font-extrabold tracking-wider select-none"
              style={{ color: 'var(--skin-primary)', fontFamily: "var(--font-display)" }}
            >
              迷你兔
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 shrink-0">
            {mainNavItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }),
                    'gap-2 transition-all duration-200 font-bold tracking-wider',
                    isActive
                      ? ''
                      : 'hover:bg-[var(--skin-muted)]'
                  )}
                  style={isActive ? {
                    color: 'var(--skin-primary)',
                    borderBottom: '2px solid var(--skin-primary)',
                    borderRadius: '0',
                    background: 'transparent',
                  } : {}}
                >
                  {iconMap[item.icon]}
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Lyrics Marquee — fills blank space when music is playing */}
          <LyricsMarquee />
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 shrink-0">
          <SearchBar />

          <Link
            href="/notes"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'hidden sm:inline-flex gap-2 font-bold'
            )}
            style={{ borderWidth: '2px' }}
          >
            <PlusCircle className="size-4" />
            <span>写笔记</span>
          </Link>

          <SkinToggle />

          <UserMenu />

          {/* Mobile Menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'md:hidden hover:bg-[var(--skin-muted)]')}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-64 pt-12" style={{ backgroundColor: 'var(--skin-surface)', borderLeft: '2px solid var(--skin-border)' }}>
              <SheetTitle className="sr-only">导航菜单</SheetTitle>
              <nav className="flex flex-col gap-2 animate-stagger">
                {mainNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      buttonVariants({ variant: pathname.startsWith(item.href) ? 'secondary' : 'ghost' }),
                      'justify-start gap-3 animate-fade-in-up font-bold'
                    )}
                    style={pathname.startsWith(item.href) ? {
                      color: 'var(--skin-primary)',
                      background: 'var(--skin-muted)',
                    } : {}}
                    onClick={() => setMobileOpen(false)}
                  >
                    {iconMap[item.icon]}
                    {item.label}
                  </Link>
                ))}
                <hr className="my-2 border-[var(--skin-border)]" style={{ borderWidth: '2px' }} />
                <Link
                  href="/notes"
                  className={cn(buttonVariants({ variant: 'outline' }), 'justify-start gap-3 animate-fade-in-up font-bold')}
                  style={{ borderWidth: '2px' }}
                  onClick={() => setMobileOpen(false)}
                >
                  <PlusCircle className="size-5" />
                  写笔记
                </Link>
                <Link
                  href="/profile"
                  className={cn(buttonVariants({ variant: 'ghost' }), 'justify-start gap-3 animate-fade-in-up font-bold')}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="text-base w-5 text-center">👤</span>
                  个人中心
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
