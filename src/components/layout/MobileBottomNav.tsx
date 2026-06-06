'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Library, FolderOpen, Tag, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: '笔记', href: '/resources', icon: Library },
  { label: '分类', href: '/categories', icon: FolderOpen },
  { label: '标签', href: '/tags', icon: Tag },
  { label: '我的', href: '/profile', icon: User },
]

export default function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-heavy border-t border-white/20 dark:border-white/5 safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 text-xs transition-all duration-300',
                isActive
                  ? 'text-primary font-medium scale-110'
                  : 'text-muted-foreground hover:text-foreground hover:scale-105'
              )}
            >
              <Icon className="size-5 transition-transform duration-300" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
