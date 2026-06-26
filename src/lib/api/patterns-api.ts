/**
 * 织集数据 API 层
 *
 * 所有数据操作通过 dbFetch/dbUpsert/dbUpsertOwned 走统一调度，
 * 自动判断走 VPS PostgREST 或 Supabase REST。
 */
import { dbFetch, dbUpsert, dbUpsertOwned } from '@/lib/supabase-admin'
import type { Resource, Category, Tag } from '@/lib/types'

export interface PatternFilters {
  categoryId?: string
  status?: string
  search?: string
  tagId?: string
  wishlisted?: boolean
}

// ============================================================
// 图解 CRUD
// ============================================================

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

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
  const res = await dbFetch(`resources?${qs}`)
  if (!res.ok) throw new Error(res.error || '获取图解列表失败')
  return (res.body as Resource[]) || []
}

/** 获取单个图解 */
export async function getPattern(id: string): Promise<Resource | null> {
  const res = await dbFetch(
    `resources?select=*,category:categories(*),resource_tags(tag:tags(*))&id=eq.${id}`,
  )
  if (!res.ok) return null
  const data = (res.body as Resource[]) || []
  return data[0] || null
}

/**
 * 通过文件哈希查询是否已存在图解（用于导入去重）。
 * 一次可传多个哈希，返回已存在的哈希集合。
 */
export async function findExistingPatternHashes(hashes: string[]): Promise<Set<string>> {
  if (hashes.length === 0) return new Set()
  const params = new URLSearchParams()
  params.set('select', 'metadata->>patternHash')
  params.set('metadata->>is_pattern', 'eq.true')
  params.set('metadata->>patternHash', `in.(${hashes.join(',')})`)
  const res = await dbFetch(`resources?${params.toString()}`)
  if (!res.ok) return new Set()
  const rows = (res.body as { patternHash?: string }[]) || []
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
  const res = await dbUpsertOwned('resources', payload)
  if (!res.ok) throw new Error(res.error || '创建图解失败')
  // 创建后查询完整数据
  return null // caller 需要重新 getPattern
}

/** 更新图解 */
export async function updatePattern(
  id: string,
  data: Partial<Resource> | { metadata: Record<string, JsonValue> },
): Promise<Resource | null> {
  const res = await dbUpsertOwned('resources', { id, ...data } as Record<string, unknown>)
  if (!res.ok) throw new Error(res.error || '更新图解失败')
  return getPattern(id)
}

/** 删除图解 */
export async function deletePattern(id: string): Promise<void> {
  const res = await dbFetch(`resources?id=eq.${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error(res.error || '删除图解失败')
}

// ============================================================
// 分类 CRUD
// ============================================================

export async function getCategories(): Promise<Category[]> {
  const res = await dbFetch('categories?order=sort_order.asc')
  if (!res.ok) throw new Error(res.error || '获取分类失败')
  return (res.body as Category[]) || []
}

/**
 * 确保 "未分类" 分类存在，不存在时自动创建
 */
export async function ensureUncategorized(): Promise<Category | null> {
  try {
    const cats = await getCategories()
    let uncat: Category | null = cats.find((c: Category) => c.name === '未分类') || null
    if (!uncat) {
      // 创建默认未分类
      const res = await dbUpsert('categories', {
        name: '未分类',
        slug: 'uncategorized',
        color: '#C0B0A8',
        icon: '📁',
        sort_order: 999,
      })
      if (!res.ok) throw new Error(res.error || '创建默认分类失败')
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
  // 使用随机后缀避免 slug 冲突
  const suffix = Math.random().toString(36).substring(2, 8)
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '')
  const slug = baseSlug ? `${baseSlug}-${suffix}` : `cat-${suffix}`
  const payload: Record<string, unknown> = {
    name,
    slug,
    color: color || '#C17F6B',
    icon: icon || '🧶',
    sort_order: 0,
  }
  const res = await dbUpsert('categories', payload)
  if (!res.ok) throw new Error(res.error || '创建分类失败')
  const cats = await getCategories()
  return cats.find((c: Category) => c.slug === slug) || null
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<void> {
  const res = await dbUpsert('categories', { id, ...data } as Record<string, unknown>)
  if (!res.ok) throw new Error(res.error || '更新分类失败')
}

export async function deleteCategory(id: string): Promise<void> {
  const res = await dbFetch(`categories?id=eq.${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error(res.error || '删除分类失败')
}

// ============================================================
// 标签 CRUD
// ============================================================

export async function getTags(): Promise<Tag[]> {
  const res = await dbFetch('tags?order=name.asc')
  if (!res.ok) throw new Error(res.error || '获取标签失败')
  return (res.body as Tag[]) || []
}

export async function createTag(name: string, color?: string): Promise<Tag | null> {
  // 使用随机后缀避免 slug 冲突
  const suffix = Math.random().toString(36).substring(2, 8)
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '')
  const slug = baseSlug ? `${baseSlug}-${suffix}` : `tag-${suffix}`
  const payload: Record<string, unknown> = { name, slug, color: color || '#8FA88A' }
  const res = await dbUpsert('tags', payload)
  if (!res.ok) throw new Error(res.error || '创建标签失败')
  const tags = await getTags()
  return tags.find((t: Tag) => t.slug === slug) || null
}

export async function updateTag(id: string, data: Partial<Tag>): Promise<void> {
  const res = await dbUpsert('tags', { id, ...data } as Record<string, unknown>)
  if (!res.ok) throw new Error(res.error || '更新标签失败')
}

export async function deleteTag(id: string): Promise<void> {
  const res = await dbFetch(`tags?id=eq.${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error(res.error || '删除标签失败')
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
  const res = await dbFetch(
    `resource_tags?select=tag:tags(*)&resource_id=eq.${resourceId}`,
  )
  if (!res.ok) return []
  const items = (res.body as ResourceTagResult[]) || []
  return items.map((i) => i.tag).filter(Boolean)
}

export async function setResourceTags(resourceId: string, tagIds: string[]): Promise<void> {
  // 先删除旧的
  await dbFetch(`resource_tags?resource_id=eq.${resourceId}`, { method: 'DELETE' })
  // 再插入新的
  for (const tagId of tagIds) {
    await dbUpsert('resource_tags', { resource_id: resourceId, tag_id: tagId })
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
  const res = await dbUpsert('pattern_notes', { pattern_id: patternId, note_id: noteId })
  if (!res.ok) throw new Error(res.error || '关联笔记失败')
}

export async function unlinkPatternNote(patternId: string, noteId: string): Promise<void> {
  const res = await dbFetch(
    `pattern_notes?pattern_id=eq.${patternId}&note_id=eq.${noteId}`,
    { method: 'DELETE' },
  )
  if (!res.ok && res.status !== 404) throw new Error(res.error || '取消关联失败')
}

export async function getNotesForPattern(patternId: string): Promise<PatternNoteLink[]> {
  const res = await dbFetch(
    `pattern_notes?select=*,note:notes(*)&pattern_id=eq.${patternId}`,
  )
  if (!res.ok) return []
  return (res.body as PatternNoteLink[]) || []
}

export async function getPatternsForNote(noteId: string): Promise<Resource[]> {
  const res = await dbFetch(
    `pattern_notes?select=pattern_id&note_id=eq.${noteId}`,
  )
  if (!res.ok) return []
  const links = (res.body as { pattern_id: string }[]) || []
  if (links.length === 0) return []
  const patternIds = links.map((l) => l.pattern_id)
  const patternsRes = await dbFetch(
    `resources?select=*,category:categories(*)&id=in.(${patternIds.join(',')})&metadata->>is_pattern=eq.true`,
  )
  if (!patternsRes.ok) return []
  return (patternsRes.body as Resource[]) || []
}
