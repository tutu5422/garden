'use client'

import { useState } from 'react'
import Link from 'next/link'
import { User, LogOut, Cloud, CloudOff } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'
import { toast } from 'sonner'

export default function UserMenu() {
  const { user, loading, isLocal, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    setOpen(false)
    toast.success('已退出登录')
  }

  if (loading) {
    return <div className="size-8 rounded-full bg-muted animate-pulse" />
  }

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        {isLocal ? (
          <span className="text-[10px] text-muted-foreground/50 hidden lg:inline-flex items-center gap-1">
            <CloudOff className="size-3" /> 离线
          </span>
        ) : (
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'hidden sm:inline-flex')}
          >
            <User className="size-5" />
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="size-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium hover:bg-primary/30 transition-colors"
      >
        {user.email?.charAt(0).toUpperCase() || <User className="size-4" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 glass-heavy rounded-xl shadow-3d-lg p-2 w-48 animate-scale-in">
            <p className="px-2 py-1.5 text-xs text-muted-foreground truncate">{user.email}</p>
            <hr className="my-1 border-border" />
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
