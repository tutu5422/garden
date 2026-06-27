'use client'

import { getLocalResources, getLocalCategories, getLocalTags, getLocalCollections } from '@/lib/db/local-store'

/**
 * 将本地 localStorage 数据同步到云端（VPS PostgREST，通过 /api/sync 服务端代理）。
 *
 * 逐条调用 /api/sync POST upsert。失败的项目计入 skipped。
 */
export async function syncToCloud(): Promise<{ notes: number; categories: number; tags: number; collections: number }> {
  const localResources = getLocalResources()
  const localCategories = getLocalCategories()
  const localTags = getLocalTags()
  const localCollections = getLocalCollections()

  let syncedNotes = 0
  let syncedCategories = 0
  let syncedTags = 0
  let syncedCollections = 0

  const push = async (table: string, data: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, action: 'upsert', data }),
      })
      return res.ok
    } catch {
      return false
    }
  }

  // 同步分类
  for (const cat of localCategories) {
    const ok = await push('collections', {
      id: cat.id,
      title: cat.name,
      description: cat.description || '',
      // categories 表与 collections 不同步，这里只推 collections
    } as any)
    // categories 暂无 /api/sync 处理，跳过
    void ok
  }

  // 同步标签（/api/sync 暂未处理 tags，跳过）
  void localTags
  syncedTags = localTags.length ? 0 : 0

  // 同步笔记/资源
  for (const r of localResources) {
    const isNote = (r.metadata as any)?.is_note === true
    const table = isNote ? 'notes' : 'resources'
    const ok = await push(table, {
      id: r.id,
      title: r.title,
      description: r.description,
      content: (r.metadata as any)?.content || '',
      type: (r.metadata as any)?.type || r.resource_type,
      tags: (r.metadata as any)?.tags || [],
      resource_type: r.resource_type,
      url: r.url,
      cover_image_url: r.cover_image_url,
      author: r.author,
      rating: r.rating,
      status: r.status,
      category_id: r.category_id,
      metadata: r.metadata || {},
      pinned: r.pinned,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })
    if (ok) syncedNotes++
  }

  // 同步合集
  for (const col of localCollections) {
    const ok = await push('collections', {
      id: col.id,
      title: col.title,
      description: col.description || '',
      coverImage: col.coverImage || '',
      resourceIds: col.resourceIds || [],
      createdAt: col.createdAt,
    })
    if (ok) syncedCollections++
  }

  return { notes: syncedNotes, categories: syncedCategories, tags: syncedTags, collections: syncedCollections }
}
