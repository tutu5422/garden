'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Settings2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getLocalCategories, getLocalResources, getDeletedCategoryNames, syncCategoriesToCloud } from '@/lib/db/local-store'

function isUUID(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}
import CategoryManager from '@/components/categories/CategoryManager'
import type { Category } from '@/lib/types'

function isSupabaseReady() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return url && !url.includes('placeholder')
}

type CatWithCount = Category & { count: number }

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CatWithCount[]>([])
  const [showManager, setShowManager] = useState(false)

  useEffect(() => { loadCategories() }, [])

  const loadCategories = async () => {
    const local = getLocalCategories()
    const resources = getLocalResources()
    const addCounts = (cats: Category[]): CatWithCount[] =>
      cats.map(c => ({ ...c, count: resources.filter(r => r.category_id === c.id).length }))

    if (isSupabaseReady()) {
      try {
        const supabase = createClient()
        const { data } = await supabase.from('categories').select('*').order('sort_order')
        const cloud = (data || []) as unknown as Category[]

        // 有云端或本地数据时，不显示默认预设
        const source = (cloud.length > 0 || local.length > 0) ? [...cloud, ...local] : local

        // 按名称合并，最后修改的为准
        const merged = new Map<string, Category>()
        for (const c of source) {
          const existing = merged.get(c.name)
          if (!existing || new Date(c.updated_at || 0) > new Date(existing.updated_at || 0)) {
            merged.set(c.name, c)
          }
        }

        // 把合并结果同步回两个存储
        const mergedList = Array.from(merged.values())
        // 同步到本地
        syncCategoriesToCloud(mergedList)
        // 同步到云端（异步，不阻塞）
        mergedList.forEach(c => {
          if (isUUID(c.id)) {
            supabase.from('categories').upsert({ id: c.id, name: c.name, slug: c.slug, icon: c.icon, sort_order: c.sort_order } as any).then(({ error }) => {
              if (error) console.error('云端分类同步失败:', error.message)
            })
          }
        })

        // 过滤已删除的分类
        const deletedNames = getDeletedCategoryNames()
        const filtered = mergedList.filter(c => !deletedNames.has(c.name))
        setCategories(addCounts(filtered))
        return
      } catch {}
    }
    const deletedNames = getDeletedCategoryNames()
    setCategories(addCounts(local.filter(c => !deletedNames.has(c.name))))
  }

  const refresh = () => loadCategories()

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--skin-primary)' }}>
          兴趣分类
        </h1>
        <button
          onClick={() => setShowManager(!showManager)}
          className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors flex items-center gap-1"
        >
          <Settings2 className="size-3" />
          管理
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">按分类浏览笔记</p>

      {/* 折叠管理区 */}
      {showManager && (
        <div className="mb-6 animate-fade-in">
          <CategoryManager initialCategories={categories} onRefresh={refresh} />
        </div>
      )}

      {/* 分类入口网格 */}
      {categories.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {categories.map((cat) => (
            <Link key={cat.id} href={`/categories/${cat.slug}`}>
              <Card className="h-full text-center group">
                <CardContent className="flex flex-col items-center justify-center py-6 px-2">
                  <span className="text-2xl mb-2 group-hover:scale-125 transition-transform duration-300">
                    {cat.icon || '📂'}
                  </span>
                  <p className="text-sm font-medium group-hover:text-[var(--skin-primary)] transition-colors truncate w-full">
                    {cat.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{cat.count} 篇</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
