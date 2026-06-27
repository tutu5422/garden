'use client'

import { useState } from 'react'
import Link from 'next/link'
import { User, LogOut } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function UserMenu() {
  const [open, setOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' })
    } catch { /* ignore */ }
    setOpen(false)
    toast.success('已退出登录')
    window.location.href = '/login'
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
        aria-label="菜单"
      >
        <User className="size-5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 glass-heavy rounded-xl shadow-3d-lg p-2 w-48 animate-scale-in">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-white/30 transition-colors"
            >
              <User className="size-4" /> 个人中心
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-white/30 transition-colors w-full text-left text-destructive"
            >
              <LogOut className="size-4" /> 退出登录
            </button>
          </div>
        </>
      )}
    </div>
  )
}
