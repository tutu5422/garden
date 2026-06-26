'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { message } from 'antd'
import PatternSidebar from '@/components/patterns/PatternSidebar'
import PatternHeader from '@/components/patterns/PatternHeader'
import PatternGrid from '@/components/patterns/PatternGrid'
import ImportDialog from '@/components/patterns/ImportDialog'
import type { Resource, Category, Tag } from '@/lib/types'
import {
  getPatterns,
  deletePattern,
  updatePattern,
  getCategories,
  getTags,
} from '@/lib/api/patterns-api'

type FilterMode = 'all' | 'category' | 'wishlist' | 'status' | 'tag'

export default function PatternsPage() {
  const [allPatterns, setAllPatterns] = useState<Resource[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  // 筛选状态
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [tagFilterId, setTagFilterId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // 批量管理
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // 导入对话框
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  // 加载所有图解
  const loadPatterns = useCallback(async () => {
    setLoading(true)
    try {
      const all = await getPatterns()
      all.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime(),
      )
      setAllPatterns(all)
    } catch (e) {
      console.error('加载图解列表失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCategories = useCallback(async () => {
    try {
      const cats = await getCategories()
      setCategories(cats.sort((a, b) => a.sort_order - b.sort_order))
    } catch (e) {
      console.error('加载分类失败:', e)
    }
  }, [])

  const loadTags = useCallback(async () => {
    try {
      setTags(await getTags())
    } catch (e) {
      console.error('加载标签失败:', e)
    }
  }, [])

  useEffect(() => {
    void loadPatterns()
    void loadCategories()
    void loadTags()
  }, [loadPatterns, loadCategories, loadTags])

  // 筛选后的图解
  const filteredPatterns = useMemo(() => {
    let list = allPatterns

    if (filterMode === 'wishlist') {
      list = list.filter((p) => (p.metadata as Record<string, unknown>)?.patternStatus === 'wishlist')
    } else if (filterMode === 'status' && statusFilter) {
      list = list.filter((p) => (p.metadata as Record<string, unknown>)?.patternStatus === statusFilter)
    } else if (filterMode === 'category' && selectedCategoryId) {
      list = list.filter((p) => p.category_id === selectedCategoryId)
    } else if (filterMode === 'tag' && tagFilterId) {
      list = list.filter((p) =>
        p.resource_tags?.some((rt) => rt.tag.id === tagFilterId),
      )
    }

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          ((p.metadata as Record<string, unknown>)?.patternBrand as string || '').toLowerCase().includes(q),
      )
    }

    return list
  }, [allPatterns, filterMode, statusFilter, selectedCategoryId, tagFilterId, search])

  // 筛选标签
  const filterLabel = useMemo(() => {
    if (filterMode === 'wishlist') return '心愿单'
    if (filterMode === 'status' && statusFilter) {
      const map: Record<string, string> = {
        'not-started': '未开始',
        'in-progress': '进行中',
        completed: '已完成',
      }
      return map[statusFilter] || statusFilter
    }
    if (filterMode === 'category' && selectedCategoryId) {
      return categories.find((c) => c.id === selectedCategoryId)?.name || '分类'
    }
    if (filterMode === 'tag' && tagFilterId) {
      return tags.find((t) => t.id === tagFilterId)?.name || '标签'
    }
    return '全部图解'
  }, [filterMode, statusFilter, selectedCategoryId, tagFilterId, categories, tags])

  const selectedCategoryName = useMemo(() => {
    if (filterMode === 'category' && selectedCategoryId) {
      return categories.find((c) => c.id === selectedCategoryId)?.name || null
    }
    return null
  }, [filterMode, selectedCategoryId, categories])

  // 筛选操作
  const handleSelectAll = () => {
    setFilterMode('all')
    setSelectedCategoryId(null)
    setStatusFilter(null)
    setTagFilterId(null)
  }

  const handleSelectWishlist = () => {
    setFilterMode('wishlist')
    setSelectedCategoryId(null)
    setStatusFilter(null)
    setTagFilterId(null)
  }

  const handleSelectCategory = (id: string | null) => {
    setFilterMode(id ? 'category' : 'all')
    setSelectedCategoryId(id)
    setStatusFilter(null)
    setTagFilterId(null)
  }

  const handleSelectStatus = (status: string) => {
    setFilterMode('status')
    setStatusFilter(status)
    setSelectedCategoryId(null)
    setTagFilterId(null)
  }

  const handleSelectTag = (tagId: string) => {
    setFilterMode('tag')
    setTagFilterId(tagId)
    setSelectedCategoryId(null)
    setStatusFilter(null)
  }

  // 心愿单切换
  const handleWishlist = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'wishlist' ? 'not-started' : 'wishlist'
    const target = allPatterns.find((r) => r.id === id)
    if (!target) return
    const meta = { ...((target.metadata || {}) as Record<string, unknown>) }
    meta.patternStatus = newStatus
    meta.patternLastUsedAt = new Date().toISOString()
    try {
      await updatePattern(id, { metadata: meta })
      void loadPatterns()
    } catch (e) {
      console.error('更新心愿单失败:', e)
      message.error('更新失败')
    }
  }

  // 删除单个
  const handleDelete = async (id: string) => {
    try {
      await deletePattern(id)
      message.success('已删除')
      void loadPatterns()
    } catch (e) {
      console.error('删除失败:', e)
      message.error('删除失败')
    }
  }

  // 批量操作
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAllIds = (ids: string[]) => {
    setSelectedIds(new Set(ids))
  }

  const handleClearSelection = () => {
    setSelectedIds(new Set())
  }

  const handleBatchDelete = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => deletePattern(id)))
      handleClearSelection()
      void loadPatterns()
    } catch (e) {
      console.error('批量删除失败:', e)
      message.error('部分删除失败')
    }
  }

  const handleBatchMove = async (ids: string[], targetCategoryId: string) => {
    try {
      await Promise.all(
        ids.map((id) => updatePattern(id, { category_id: targetCategoryId })),
      )
      handleClearSelection()
      void loadPatterns()
    } catch (e) {
      console.error('批量移动失败:', e)
      message.error('部分移动失败')
    }
  }

  const handleToggleBatchMode = () => {
    setBatchMode(true)
    handleClearSelection()
  }

  const handleExitBatchMode = () => {
    setBatchMode(false)
    handleClearSelection()
  }

  return (
    <div className="patterns-layout warm-antd">
      <PatternSidebar
        patterns={allPatterns}
        filterMode={filterMode}
        selectedCategoryId={selectedCategoryId}
        statusFilter={statusFilter}
        tagFilterId={tagFilterId}
        onSelectAll={handleSelectAll}
        onSelectWishlist={handleSelectWishlist}
        onSelectCategory={handleSelectCategory}
        onSelectStatus={handleSelectStatus}
        onSelectTag={handleSelectTag}
        onCategoriesChange={loadCategories}
        onTagsChange={loadTags}
      />

      <div className="patterns-main">
        <PatternHeader
          search={search}
          onSearchChange={setSearch}
          batchMode={batchMode}
          onToggleBatchMode={handleToggleBatchMode}
          onExitBatchMode={handleExitBatchMode}
          filterLabel={filterLabel}
          selectedCategoryName={selectedCategoryName}
          onImportClick={() => setImportDialogOpen(true)}
        />

        {loading ? (
          <div className="pattern-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="warm-card"
                style={{ height: 300, opacity: 0.4 }}
              >
                <div className="warm-card-cover" style={{ height: 220 }} />
                <div className="warm-card-body">
                  <div style={{ height: 14, background: '#F0E0DA', borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ height: 10, width: 60, background: '#F0E0DA', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <PatternGrid
            patterns={filteredPatterns}
            categories={categories}
            batchMode={batchMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAllIds}
            onClearSelection={handleClearSelection}
            onBatchDelete={handleBatchDelete}
            onBatchMove={handleBatchMove}
            onWishlist={handleWishlist}
            onDelete={handleDelete}
            selectedCategoryName={selectedCategoryName}
            onImportClick={() => setImportDialogOpen(true)}
          />
        )}
      </div>

      <ImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImported={() => void loadPatterns()}
      />
    </div>
  )
}
