'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Settings2 } from 'lucide-react'
import { getLocalCategories, getLocalResources, getDeletedCategoryNames } from '@/lib/db/local-store'
import CategoryManager from '@/components/categories/CategoryManager'
import type { Category } from '@/lib/types'

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
