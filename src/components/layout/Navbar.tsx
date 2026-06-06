'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import {
  Library,
  Layers,
  FolderOpen,
  Tag,
  Eye,
  Calendar,
  Menu,
  PlusCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { mainNavItems } from '@/lib/constants/navigation'
import SearchBar from '@/components/shared/SearchBar'
import SkinToggle from '@/components/theme/SkinToggle'
import UserMenu from '@/components/layout/UserMenu'

const iconMap: Record<string, React.ReactNode> = {
  Library: <Library className="size-5" />,
  Layers: <Layers className="size-5" />,
  FolderOpen: <FolderOpen className="size-5" />,
  Tag: <Tag className="size-5" />,
  Eye: <Eye className="size-5" />,
  Calendar: <Calendar className="size-5" />,
}

export default function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full glass-heavy border-b border-white/20 dark:border-white/5">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <span className="text-2xl animate-float">🌿</span>
          <span
            className="hidden sm:inline text-xl font-bold tracking-wider select-none"
            style={{
              color: 'var(--skin-primary)',
              fontFamily: "'Noto Serif SC', 'STSong', 'Songti SC', 'SimSun', serif",
            }}
          >
            秘密花园
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({
                    variant: isActive ? 'secondary' : 'ghost',
                    size: 'sm',
                  }),
                  'gap-2 transition-all duration-300',
                  isActive
                    ? 'glass shadow-3d font-medium'
                    : 'hover:bg-white/40 dark:hover:bg-white/5'
                )}
              >
                {iconMap[item.icon]}
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          <SearchBar />

          <Link
            href="/resources/new"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'hidden sm:inline-flex gap-2 glass shadow-3d btn-3d'
            )}
          >
            <PlusCircle className="size-4" />
            <span>写笔记</span>
          </Link>

          <SkinToggle />

          <UserMenu />

          {/* Mobile Menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'icon' }),
                'md:hidden hover:bg-white/40 dark:hover:bg-white/5'
              )}
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-64 pt-12 glass-heavy">
              <SheetTitle className="sr-only">导航菜单</SheetTitle>
              <nav className="flex flex-col gap-2 animate-stagger">
                {mainNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      buttonVariants({
                        variant: pathname === item.href ? 'secondary' : 'ghost',
                      }),
                      'justify-start gap-3 animate-fade-in-up',
                      pathname === item.href && 'glass shadow-3d font-medium'
                    )}
                    onClick={() => setMobileOpen(false)}
                  >
                    {iconMap[item.icon]}
                    {item.label}
                  </Link>
                ))}
                <hr className="my-2 border-white/20 dark:border-white/5" />
                <Link
                  href="/resources/new"
                  className={cn(
                    buttonVariants({ variant: 'outline' }),
                    'justify-start gap-3 glass animate-fade-in-up'
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <PlusCircle className="size-5" />
                  写笔记
                </Link>
                <Link
                  href="/profile"
                  className={cn(
                    buttonVariants({ variant: 'ghost' }),
                    'justify-start gap-3 animate-fade-in-up'
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="text-base w-5 text-center">👤</span>
                  个人中心
                </Link>
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ variant: 'ghost' }),
                    'justify-start gap-3 animate-fade-in-up'
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="text-base w-5 text-center">🔑</span>
                  登录
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
