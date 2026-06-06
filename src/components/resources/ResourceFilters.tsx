'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Option {
  slug: string
  name: string
}

interface ResourceFiltersProps {
  categories?: Option[]
  collections?: Option[]
  tags?: Option[]
}

export default function ResourceFilters({ categories = [], collections = [], tags = [] }: ResourceFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const category = searchParams.get('category') || ''
  const collection = searchParams.get('collection') || ''
  const tag = searchParams.get('tag') || ''
  const sort = searchParams.get('sort') || 'newest'

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    router.push(`/resources?${params.toString()}`)
  }

  const clearAll = () => router.push('/resources')
  const hasFilters = category || collection || tag || sort !== 'newest'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">筛选</h3>
        {hasFilters && (
          <button
            onClick={clearAll}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-auto py-1 px-2 text-xs gap-1')}
          >
            <X className="size-3" /> 清除
          </button>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">分类</Label>
        <Select value={category} onValueChange={(v) => updateFilter('category', v === 'all' ? '' : v)}>
          <SelectTrigger className="h-9"><SelectValue placeholder="全部分类" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">合集</Label>
        <Select value={collection} onValueChange={(v) => updateFilter('collection', v === 'all' ? '' : v)}>
          <SelectTrigger className="h-9"><SelectValue placeholder="全部合集" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部合集</SelectItem>
            {collections.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">标签</Label>
        <Select value={tag} onValueChange={(v) => updateFilter('tag', v === 'all' ? '' : v)}>
          <SelectTrigger className="h-9"><SelectValue placeholder="全部标签" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部标签</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t.slug} value={t.slug}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">排序</Label>
        <Select value={sort} onValueChange={(v) => updateFilter('sort', v)}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">最新添加</SelectItem>
            <SelectItem value="oldest">最早添加</SelectItem>
            <SelectItem value="title">标题排序</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
