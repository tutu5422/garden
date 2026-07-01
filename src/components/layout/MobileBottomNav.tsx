'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Library, Calendar, Layers, FileText, Grid3x3, Music } from 'lucide-react'
import { cn } from '@/lib/utils'
import { mobileNavItems } from '@/lib/constants/navigation'

const iconMap: Record<string, React.ReactNode> = {
  Library: <Library className="size-5" />,
  Layers: <Layers className="size-5" />,
  Calendar: <Calendar className="size-5" />,
  FileText: <FileText className="size-5" />,
  Grid3x3: <Grid3x3 className="size-5" />,
  Music4: <Music className="size-5" />,
}

export default function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t-2 border-[var(--skin-border)] safe-area-bottom"
         style={{ backgroundColor: 'var(--skin-surface)' }}>
      <div className="flex items-center justify-around h-14">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href)
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
              {iconMap[item.icon] || <FileText className="size-5" />}
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
