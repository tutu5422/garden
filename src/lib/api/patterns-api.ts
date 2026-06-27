/**
 * 织集数据 API 层（客户端版）
 *
 * 所有数据操作通过 HTTP 调用 /api/db 代理路由，
 * 由服务端执行真正的 dbFetch/dbUpsert 操作。
 * 这样客户端组件（'use client'）可以安全调用，无需直接访问服务端环境变量。
 */
import type { Resource, Category, Tag } from '@/lib/types'

export interface PatternFilters {
  categoryId?: string
  status?: string
  search?: string
  tagId?: string
  wishlisted?: boolean
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/** 通用数据库请求——调用 /api/db 代理路由 */
async function dbRequest(table: string, action: 'fetch' | 'upsert' | 'delete', data?: any, options?: { owned?: boolean }): Promise<any> {
  const res = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, action, data, owned: options?.owned }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `请求失败: ${res.status}`)
  }
  const json = await res.json()
  return json.data
}

// ============================================================
// 图解 CRUD
// ============================================================

/** 获取图解列表 */
export async function getPatterns(filters?: PatternFilters): Promise<Resource[]> {
  const params = new URLSearchParams()
  params.set('select', '*,category:categories(*),resource_tags(tag:tags(*))')
  params.set('metadata->>is_pattern', 'eq.true')
  params.set('order', 'created_at.desc')

  if (filters?.categoryId) params.set('category_id', `eq.${filters.categoryId}`)
  if (filters?.status) params.set('metadata->>patternStatus', `eq.${filters.status}`)
  if (filters?.wishlisted) params.set('metadata->>patternStatus', 'eq.wishlist')
  if (filters?.search) params.set('title', `ilike.*${filters.search}*`)

  const qs = params.toString()
  const data = await dbRequest(`resources?${qs}`, 'fetch', { method: 'GET' })
  return (data as Resource[]) || []
}

/** 获取单个图解 */
export async function getPattern(id: string): Promise<Resource | null> {
  const data = await dbRequest(
    `resources?select=*,category:categories(*),resource_tags(tag:tags(*))&id=eq.${id}`,
    'fetch',
    { method: 'GET' },
  )
  const list = (data as Resource[]) || []
  return list[0] || null
}

/**
 * 通过文件哈希查询是否已存在图解（用于导入去重）。
 */
export async function findExistingPatternHashes(hashes: string[]): Promise<Set<string>> {
  if (hashes.length === 0) return new Set()
  const params = new URLSearchParams()
  params.set('select', 'metadata->>patternHash')
  params.set('metadata->>is_pattern', 'eq.true')
  params.set('metadata->>patternHash', `in.(${hashes.join(',')})`)
  const data = await dbRequest(`resources?${params.toString()}`, 'fetch', { method: 'GET' })
  const rows = (data as { patternHash?: string }[]) || []
  return new Set(rows.map((r) => r.patternHash).filter(Boolean) as string[])
}

/** 创建图解 */
export async function createPattern(data: {
  title: string
  metadata?: Record<string, JsonValue>
}): Promise<Resource | null> {
  const payload: Record<string, unknown> = {
    title: data.title,
    resource_type: 'other',
    status: 'active',
    metadata: {
      is_pattern: true,
      patternStatus: 'not-started',
      patternProgress: 0,
      ...(data.metadata || {}),
    },
  }
  await dbRequest('resources', 'upsert', payload, { owned: true })
  return null
}

/** 更新图解 */
export async function updatePattern(
  id: string,
  data: Partial<Resource> | { metadata: Record<string, JsonValue> },
): Promise<Resource | null> {
  await dbRequest('resources', 'upsert', { id, ...data }, { owned: true })
  return getPattern(id)
}

/** 删除图解 */
export async function deletePattern(id: string): Promise<void> {
  await dbRequest(`resources?id=eq.${id}`, 'delete')
}

// ============================================================
// 分类 CRUD
// ============================================================

export async function getCategories(): Promise<Category[]> {
  const data = await dbRequest('categories?order=sort_order.asc', 'fetch', { method: 'GET' })
  return (data as Category[]) || []
}

/**
 * 确保 "未分类" 分类存在，不存在时自动创建
 */
export async function ensureUncategorized(): Promise<Category | null> {
  try {
    const cats = await getCategories()
    let uncat: Category | null = cats.find((c: Category) => c.name === '未分类') || null
    if (!uncat) {
      await dbRequest('categories', 'upsert', {
        name: '未分类',
        slug: 'uncategorized',
        color: '#C0B0A8',
        icon: '\uD83D\uDCC1',
        sort_order: 999,
      })
      const updated = await getCategories()
      uncat = updated.find((c: Category) => c.name === '未分类') ?? null
    }
    return uncat
  } catch (e) {
    console.error('ensureUncategorized:', e)
    return null
  }
}

export async function createCategory(name: string, color?: string, icon?: string): Promise<Category | null> {
  const suffix = Math.random().toString(36).substring(2, 8)
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '')
  const slug = baseSlug ? `${baseSlug}-${suffix}` : 'cat-' + suffix
  const payload: Record<string, unknown> = {
    name,
    slug,
    color: color || '#C17F6B',
    icon: icon || '\uD83E\uDD76',
    sort_order: 0,
  }
  await dbRequest('categories', 'upsert', payload)
  const cats = await getCategories()
  return cats.find((c: Category) => c.slug === slug) || null
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<void> {
  await dbRequest('categories', 'upsert', { id, ...data })
}

export async function deleteCategory(id: string): Promise<void> {
  await dbRequest(`categories?id=eq.${id}`, 'delete')
}

// ============================================================
// 标签 CRUD
// ============================================================

export async function getTags(): Promise<Tag[]> {
  const data = await dbRequest('tags?order=name.asc', 'fetch', { method: 'GET' })
  return (data as Tag[]) || []
}

export async function createTag(name: string, color?: string): Promise<Tag | null> {
  const suffix = Math.random().toString(36).substring(2, 8)
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '')
  const slug = baseSlug ? `${baseSlug}-${suffix}` : 'tag-' + suffix
  const payload: Record<string, unknown> = { name, slug, color: color || '#8FA88A' }
  await dbRequest('tags', 'upsert', payload)
  const tags = await getTags()
  return tags.find((t: Tag) => t.slug === slug) || null
}

export async function updateTag(id: string, data: Partial<Tag>): Promise<void> {
  await dbRequest('tags', 'upsert', { id, ...data })
}

export async function deleteTag(id: string): Promise<void> {
  await dbRequest(`tags?id=eq.${id}`, 'delete')
}

// ============================================================
// 资源-标签关联
// ============================================================

export interface ResourceTagResult {
  resource_id: string
  tag_id: string
  tag: Tag
}

export async function getResourceTags(resourceId: string): Promise<Tag[]> {
  const data = await dbRequest(
    `resource_tags?select=tag:tags(*)&resource_id=eq.${resourceId}`,
    'fetch',
    { method: 'GET' },
  )
  const items = (data as ResourceTagResult[]) || []
  return items.map((i) => i.tag).filter(Boolean)
}

export async function setResourceTags(resourceId: string, tagIds: string[]): Promise<void> {
  // 先删除旧的
  await dbRequest(`resource_tags?resource_id=eq.${resourceId}`, 'delete')
  // 再插入新的
  for (const tagId of tagIds) {
    await dbRequest('resource_tags', 'upsert', { resource_id: resourceId, tag_id: tagId })
  }
}

// ============================================================
// 图解-笔记关联
// ============================================================

export interface PatternNoteLink {
  id: string
  pattern_id: string
  note_id: string
  created_at: string
  note?: Record<string, unknown>
}

export async function linkPatternNote(patternId: string, noteId: string): Promise<void> {
  await dbRequest('pattern_notes', 'upsert', { pattern_id: patternId, note_id: noteId })
}

export async function unlinkPatternNote(patternId: string, noteId: string): Promise<void> {
  try {
    await dbRequest(`pattern_notes?pattern_id=eq.${patternId}&note_id=eq.${noteId}`, 'delete')
  } catch {
    // 404 means already deleted, that's fine
  }
}

export async function getNotesForPattern(patternId: string): Promise<PatternNoteLink[]> {
  const data = await dbRequest(
    `pattern_notes?select=*,note:notes(*)&pattern_id=eq.${patternId}`,
    'fetch',
    { method: 'GET' },
  )
  return (data as PatternNoteLink[]) || []
}

export async function getPatternsForNote(noteId: string): Promise<Resource[]> {
  const data = await dbRequest(
    `pattern_notes?select=pattern_id&note_id=eq.${noteId}`,
    'fetch',
    { method: 'GET' },
  )
  const links = (data as { pattern_id: string }[]) || []
  if (links.length === 0) return []
  const patternIds = links.map((l) => l.pattern_id)
  const patternsData = await dbRequest(
    `resources?select=*,category:categories(*)&id=in.(${patternIds.join(',')})&metadata->>is_pattern=eq.true`,
    'fetch',
    { method: 'GET' },
  )
  return (patternsData as Resource[]) || []
}
