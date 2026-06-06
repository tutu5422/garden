'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

export default function SearchBar() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (query.trim()) {
        setOpen(false)
        router.push(`/search?q=${encodeURIComponent(query.trim())}`)
        setQuery('')
      }
    },
    [query, router]
  )

  return (
    <>
      {/* Desktop: inline search trigger */}
      <Button
        variant="outline"
        size="sm"
        className="hidden sm:flex items-center gap-2 text-muted-foreground w-40 lg:w-56"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="hidden lg:inline text-xs">搜索资源...</span>
        <kbd className="ml-auto hidden lg:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
          Ctrl+K
        </kbd>
      </Button>

      {/* Mobile: search icon button */}
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden"
        onClick={() => setOpen(true)}
        aria-label="搜索"
      >
        <Search className="size-5" />
      </Button>

      {/* Search Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="sr-only">搜索资源</DialogTitle>
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <Search className="size-5 text-muted-foreground shrink-0" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索笔记..."
              className="border-0 focus-visible:ring-0 text-base"
              autoFocus
            />
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
