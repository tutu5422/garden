// 本地浏览器存储 — 数据库未配置时的临时方案
// 数据存在 localStorage，刷新页面后仍在

import type { Resource, Category, Tag } from '@/lib/types'

const RESOURCES_KEY = 'garden_resources'
const CATEGORIES_KEY = 'garden_categories'
const TAGS_KEY = 'garden_tags'

// 默认分类
const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: '编程', slug: 'coding', description: '编程语言与工具', icon: '💻', color: '#3B82F6', sort_order: 1, created_at: '', updated_at: '' },
  { id: 'cat-2', name: '阅读', slug: 'reading', description: '书籍与文章', icon: '📚', color: '#10B981', sort_order: 2, created_at: '', updated_at: '' },
  { id: 'cat-3', name: '影视', slug: 'movies', description: '电影与剧集', icon: '🎬', color: '#F59E0B', sort_order: 3, created_at: '', updated_at: '' },
  { id: 'cat-4', name: '音乐', slug: 'music', description: '歌曲与专辑', icon: '🎵', color: '#EF4444', sort_order: 4, created_at: '', updated_at: '' },
  { id: 'cat-5', name: '设计', slug: 'design', description: 'UI与品牌', icon: '🎨', color: '#EC4899', sort_order: 5, created_at: '', updated_at: '' },
]

// ========== 工具函数 ==========

function read<T>(key: string, defaults: T): T {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : defaults
  } catch { return defaults }
}

function write<T>(key: string, data: T) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.error('localStorage 写入失败:', e)
  }
}

function uid(): string {
  return crypto.randomUUID?.() || 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

// Fire-and-forget sync to Supabase (non-blocking)
async function syncToCloud(table: string, action: string, data: any) {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, action, data }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.warn('[syncToCloud]', table, action, data.id?.substring(0,12), '→', res.status, err.substring(0, 200));
    } else {
      console.log('[syncToCloud]', table, action, data.id?.substring(0,12), '✅');
    }
  } catch (e: any) {
    console.error('[syncToCloud] network error:', table, action, e.message);
  }
}

// ========== 分类 ==========

export function getLocalCategories(): Category[] {
  return read(CATEGORIES_KEY, DEFAULT_CATEGORIES)
}

export function getLocalCategory(slug: string): Category | null {
  const cats = getLocalCategories()
  return cats.find(c => c.slug === slug) || null
}

export function createLocalCategory(name: string, icon: string): Category {
  const cats = getLocalCategories()
  const cat: Category = {
    id: uid(),
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-') || uid(),
    description: null,
    icon,
    color: null,
    sort_order: cats.length,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  cats.push(cat)
  write(CATEGORIES_KEY, cats)
  return cat
}

export function updateLocalCategory(id: string, data: { name?: string; icon?: string }) {
  const cats = getLocalCategories()
  const idx = cats.findIndex(c => c.id === id)
  if (idx === -1) return
  if (data.name) {
    cats[idx].name = data.name
    cats[idx].slug = data.name.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-') || cats[idx].slug
  }
  if (data.icon) cats[idx].icon = data.icon
  cats[idx].updated_at = new Date().toISOString()
  write(CATEGORIES_KEY, cats)
}

export function deleteLocalCategory(id: string) {
  const cats = getLocalCategories()
  const target = cats.find(c => c.id === id)
  if (target) {
    // 记录已删除的分类名，防止云端同步回来
    const deleted = JSON.parse(localStorage.getItem('garden_deleted_cats') || '[]') as string[]
    if (!deleted.includes(target.name)) {
      deleted.push(target.name)
      localStorage.setItem('garden_deleted_cats', JSON.stringify(deleted))
    }
  }
  write(CATEGORIES_KEY, cats.filter(c => c.id !== id))
}

export function getDeletedCategoryNames(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    return new Set(JSON.parse(localStorage.getItem('garden_deleted_cats') || '[]'))
  } catch { return new Set() }
}

// 云端同步版本 — 同时写本地和 Supabase
export async function syncCategoriesToCloud(categories: Category[]) {
  // 本地存储
  write(CATEGORIES_KEY, categories)
}

export async function syncTagsToCloud(tags: Tag[]) {
  write(TAGS_KEY, tags)
}

export function getLocalCategoryCounts() {
  const cats = getLocalCategories()
  const resources = getLocalResources()
  return cats.map(cat => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    icon: cat.icon,
    count: resources.filter(r => r.category_id === cat.id).length,
  }))
}

// ========== 标签 ==========

export function getLocalTags(): Tag[] {
  return read(TAGS_KEY, [])
}

function saveTag(tag: Tag) {
  const tags = getLocalTags()
  if (!tags.find(t => t.id === tag.id)) {
    tags.push(tag)
    write(TAGS_KEY, tags)
  }
}

export function searchLocalTags(query: string): Tag[] {
  const tags = getLocalTags()
  return tags.filter(t => t.name.includes(query)).slice(0, 10)
}

export function getOrCreateTag(name: string): Tag {
  const tags = getLocalTags()
  const existing = tags.find(t => t.name === name)
  if (existing) return existing

  const tag: Tag = {
    id: uid(),
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-'),
    color: null,
    created_at: new Date().toISOString(),
  }
  saveTag(tag)
  return tag
}

export function deleteLocalTag(id: string) {
  const tags = getLocalTags().filter(t => t.id !== id)
  write(TAGS_KEY, tags)
}

export function renameLocalTag(id: string, newName: string) {
  const tags = getLocalTags()
  const tag = tags.find(t => t.id === id)
  if (!tag) return
  tag.name = newName
  tag.slug = newName.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-')
  write(TAGS_KEY, tags)
}

// ========== 资源 ==========

export function getLocalResources(): Resource[] {
  return read<Resource[]>(RESOURCES_KEY, [])
}

export function getLocalResource(id: string): Resource | null {
  return getLocalResources().find(r => r.id === id) || null
}

export function getLocalResourcesFiltered(filters: {
  search?: string
  type?: string
  category?: string
  status?: string
  tag?: string
  collection?: string
  sort?: string
  page?: number
  pageSize?: number
}): { data: Resource[]; count: number } {
  let list = getLocalResources()

  if (filters.status) list = list.filter(r => r.status === filters.status)
  if (filters.type) list = list.filter(r => r.resource_type === filters.type)
  if (filters.category) {
    const cat = getLocalCategories().find(c => c.slug === filters.category || c.name === filters.category)
    if (cat) {
      list = list.filter(r => r.category_id === cat.id || r.category?.slug === filters.category || r.category?.name === filters.category)
    } else {
      return { data: [], count: 0 }
    }
  }
  if (filters.search) {
    const s = filters.search.toLowerCase()
    list = list.filter(r => r.title.toLowerCase().includes(s))
  }
  if (filters.tag) {
    list = list.filter(r =>
      r.resource_tags?.some(rt => rt.tag.slug === filters.tag || rt.tag.name === filters.tag)
    )
  }
  if (filters.collection) {
    const col = getLocalCollections().find(c => c.title === filters.collection || c.id === filters.collection)
    if (col) {
      list = list.filter(r => col.resourceIds.includes(r.id))
    } else {
      return { data: [], count: 0 }
    }
  }

  // Sort
  if (filters.sort === 'oldest') list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  else if (filters.sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'zh'))
  else list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const count = list.length
  const page = filters.page || 1
  const size = filters.pageSize || 12
  const paged = list.slice((page - 1) * size, page * size)

  return { data: paged, count }
}

export function createLocalResource(data: {
  title: string
  description?: string
  resource_type: string
  url?: string
  cover_image_url?: string
  author?: string
  rating?: number
  status?: string
  category_id?: string
  tag_ids?: string[]
}): Resource {
  const resources = getLocalResources()
  const cats = getLocalCategories()

  const category = cats.find(c => c.id === data.category_id) || null
  const allTags = getLocalTags()
  const tags = (data.tag_ids || [])
    .map(id => allTags.find(t => t.id === id))
    .filter(Boolean) as Tag[]

  const resource: Resource = {
    id: uid(),
    title: data.title,
    description: data.description || null,
    resource_type: data.resource_type as Resource['resource_type'],
    url: data.url || null,
    cover_image_url: data.cover_image_url || null,
    author: data.author || null,
    rating: data.rating || null,
    status: (data.status as Resource['status']) || 'active',
    category_id: data.category_id || null,
    category,
    resource_tags: tags.map(tag => ({ tag })),
    metadata: {},
    pinned: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: 'local-user',
  }

  resources.push(resource)
  write(RESOURCES_KEY, resources)
  syncToCloud('resources', 'upsert', resource)
  return resource
}

export function updateLocalResource(id: string, data: {
  title?: string
  description?: string
  resource_type?: string
  url?: string
  cover_image_url?: string
  author?: string
  rating?: number
  status?: string
  category_id?: string
  tag_ids?: string[]
}) {
  const resources = getLocalResources()
  const idx = resources.findIndex(r => r.id === id)
  if (idx === -1) return

  const cats = getLocalCategories()
  const allTags = getLocalTags()
  const category = cats.find(c => c.id === data.category_id) || null
  const tags = (data.tag_ids || [])
    .map(id => allTags.find(t => t.id === id))
    .filter(Boolean) as Tag[]

  resources[idx] = {
    ...resources[idx],
    ...data,
    category: category || resources[idx].category,
    resource_tags: tags.length > 0 ? tags.map(tag => ({ tag })) : resources[idx].resource_tags,
    updated_at: new Date().toISOString(),
  } as Resource

  write(RESOURCES_KEY, resources)
  syncToCloud('resources', 'upsert', resources[idx])
}

export function deleteLocalResource(id: string) {
  const resources = getLocalResources().filter(r => r.id !== id)
  write(RESOURCES_KEY, resources)
  syncToCloud('resources', 'delete', { id })
}

export function deleteLocalResources(ids: string[]) {
  if (ids.length === 0) return
  const idSet = new Set(ids)
  const resources = getLocalResources().filter(r => !idSet.has(r.id))
  write(RESOURCES_KEY, resources)
  ids.forEach(id => syncToCloud('resources', 'delete', { id }))
}

// ========== 精选合集 ==========

const COLLECTIONS_KEY = 'garden_collections'

export interface LocalCollection {
  id: string
  title: string
  description: string
  coverImage: string
  resourceIds: string[]
  createdAt: string
}

export function getLocalCollections(): LocalCollection[] {
  return read<LocalCollection[]>(COLLECTIONS_KEY, [])
}

export function createLocalCollection(title: string, description: string): LocalCollection {
  const cols = getLocalCollections()
  const col: LocalCollection = {
    id: uid(),
    title,
    description,
    coverImage: '',
    resourceIds: [],
    createdAt: new Date().toISOString(),
  }
  cols.push(col)
  write(COLLECTIONS_KEY, cols)
  syncToCloud('collections', 'upsert', col)
  return col
}

export function updateLocalCollection(id: string, data: Partial<Pick<LocalCollection, 'title' | 'description'>>) {
  const cols = getLocalCollections()
  const idx = cols.findIndex(c => c.id === id)
  if (idx === -1) return
  if (data.title) cols[idx].title = data.title
  if (data.description !== undefined) cols[idx].description = data.description
  write(COLLECTIONS_KEY, cols)
  syncToCloud('collections', 'upsert', cols[idx])
}

export function deleteLocalCollection(id: string) {
  write(COLLECTIONS_KEY, getLocalCollections().filter(c => c.id !== id))
  syncToCloud('collections', 'delete', { id })
}

export function addResourceToCollection(collectionId: string, resourceId: string) {
  const cols = getLocalCollections()
  const col = cols.find(c => c.id === collectionId)
  if (!col || col.resourceIds.includes(resourceId)) return
  col.resourceIds.push(resourceId)
  write(COLLECTIONS_KEY, cols)
  syncToCloud('collections', 'upsert', col)
}

export function removeResourceFromCollection(collectionId: string, resourceId: string) {
  const cols = getLocalCollections()
  const col = cols.find(c => c.id === collectionId)
  if (!col) return
  col.resourceIds = col.resourceIds.filter(id => id !== resourceId)
  write(COLLECTIONS_KEY, cols)
  syncToCloud('collections', 'upsert', col)
}

export function getResourcesForCollection(collectionId: string): Resource[] {
  const col = getLocalCollections().find(c => c.id === collectionId)
  if (!col) return []
  const allResources = getLocalResources()
  return col.resourceIds.map(id => allResources.find(r => r.id === id)).filter(Boolean) as Resource[]
}
