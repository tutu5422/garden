'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Library, Calendar, Layers, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: '笔记', href: '/notes', icon: Library },
  { label: '时间', href: '/timeline', icon: Calendar },
  { label: '合集', href: '/collections', icon: Layers },
  { label: '文件', href: '/files', icon: FileText },
]

export default function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t-2 border-[var(--skin-border)] safe-area-bottom"
         style={{ backgroundColor: 'var(--skin-surface)' }}>
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 text-xs font-bold tracking-wider transition-all duration-200',
                isActive
                  ? ''
                  : 'text-[var(--skin-text-secondary)] hover:text-[var(--skin-text)]'
              )}
              style={isActive ? {
                color: 'var(--skin-primary)',
                borderTop: '2px solid var(--skin-primary)',
                marginTop: '-2px',
              } : {}}
            >
              <Icon className="size-5 transition-transform duration-200" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
