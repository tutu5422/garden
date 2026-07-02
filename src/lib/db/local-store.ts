// 本地浏览器存储 — 数据库未配置时的临时方案
// 数据存在 localStorage，刷新页面后仍在

import type { Resource, Category, Tag, PatternNoteRow } from '@/lib/types'
import { broadcastSync } from '@/lib/utils/sync-broadcast'

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
  // 编织分类
  { id: 'cat-6', name: '毛衣', slug: 'sweater', description: '毛衣编织', icon: '🧶', color: '#8B5CF6', sort_order: 6, created_at: '', updated_at: '' },
  { id: 'cat-7', name: '帽子', slug: 'hat', description: '帽子编织', icon: '🧢', color: '#F43F5E', sort_order: 7, created_at: '', updated_at: '' },
  { id: 'cat-8', name: '围巾', slug: 'scarf', description: '围巾编织', icon: '🧣', color: '#F97316', sort_order: 8, created_at: '', updated_at: '' },
  { id: 'cat-9', name: '袜子', slug: 'socks', description: '袜子编织', icon: '🧦', color: '#06B6D4', sort_order: 9, created_at: '', updated_at: '' },
  { id: 'cat-10', name: '玩偶', slug: 'doll', description: '玩偶编织', icon: '🧸', color: '#D946EF', sort_order: 10, created_at: '', updated_at: '' },
  { id: 'cat-11', name: '毯子', slug: 'blanket', description: '毯子编织', icon: '🛏️', color: '#22C55E', sort_order: 11, created_at: '', updated_at: '' },
  { id: 'cat-12', name: '配饰', slug: 'accessory', description: '配饰编织', icon: '💍', color: '#EAB308', sort_order: 12, created_at: '', updated_at: '' },
  { id: 'cat-13', name: '其他', slug: 'other-craft', description: '其他编织', icon: '📦', color: '#A1A1AA', sort_order: 13, created_at: '', updated_at: '' },
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

// ========== 通用墓碑机制 ==========
// 记录本地已删除的行 id，防止下次 cloud→local 同步时云端残留的旧数据
// （updatedAt 较新）按"云端优先"策略"复活"已删除的行。
// 墓碑保留 30 天，超期自动清理；云端删除成功后立即清理对应墓碑。

function tombstoneKey(table: string): string {
  return `garden_deleted_${table}`
}

// 从 syncToCloud 的 data 中提取用于墓碑的 id。
// pattern_notes 表无 id 列，使用 `pattern_id_note_id` 复合键作为墓碑 id。
function tombstoneIdFromData(table: string, data: unknown): string | null {
  const d = data as { id?: string; pattern_id?: string; note_id?: string }
  if (d?.id) return d.id
  if (table === 'pattern_notes' && d?.pattern_id && d?.note_id) {
    return `${d.pattern_id}_${d.note_id}`
  }
  return null
}

// 标记删除（写时间戳 + id），去重并更新时间戳
export function markDeleted(table: string, id: string): void {
  if (typeof window === 'undefined') return
  try {
    const key = tombstoneKey(table)
    const list: Array<{ id: string; deletedAt: string }> = JSON.parse(localStorage.getItem(key) || '[]')
    const existing = list.find(item => item.id === id)
    if (existing) {
      existing.deletedAt = new Date().toISOString()
    } else {
      list.push({ id, deletedAt: new Date().toISOString() })
    }
    localStorage.setItem(key, JSON.stringify(list))
  } catch (e) {
    console.error('[markDeleted] 写入墓碑失败:', table, id, e)
  }
}

// 检查是否被标记删除
export function isTombstoned(table: string, id: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const key = tombstoneKey(table)
    const list: Array<{ id: string }> = JSON.parse(localStorage.getItem(key) || '[]')
    return list.some(item => item.id === id)
  } catch { return false }
}

// 清理过期墓碑（超过 30 天）
export function cleanStaleTombstones(table: string): void {
  if (typeof window === 'undefined') return
  try {
    const key = tombstoneKey(table)
    const list: Array<{ id: string; deletedAt: string }> = JSON.parse(localStorage.getItem(key) || '[]')
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    const fresh = list.filter(item => new Date(item.deletedAt).getTime() > cutoff)
    if (fresh.length !== list.length) {
      localStorage.setItem(key, JSON.stringify(fresh))
    }
  } catch (e) {
    console.error('[cleanStaleTombstones] 清理墓碑失败:', table, e)
  }
}

// 云端删除成功后清理墓碑
export function clearTombstone(table: string, id: string): void {
  if (typeof window === 'undefined') return
  try {
    const key = tombstoneKey(table)
    const list: Array<{ id: string }> = JSON.parse(localStorage.getItem(key) || '[]')
    const filtered = list.filter(item => item.id !== id)
    if (filtered.length !== list.length) {
      localStorage.setItem(key, JSON.stringify(filtered))
    }
  } catch (e) {
    console.error('[clearTombstone] 清理墓碑失败:', table, id, e)
  }
}

// Fire-and-forget sync to cloud (non-blocking). On failure or offline, the
// write is enqueued in the offline queue (IndexedDB) and replayed later.
//
// P1-3: per-table debounce (500ms) + per-id mutex 防并发写竞争。
// 快速编辑时多次 upsert 同一 id 会被合并为最后一次，且同一 id 的请求串行化。
//
// P1-6: 失败时通过 setLastSyncError 暴露错误给 SyncStatus 组件展示。

// per-table 的 pending debounce timer
const syncDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
// per-id 的进行中 Promise，用于串行化同一 id 的写
const syncInFlight = new Map<string, Promise<void>>();
const SYNC_DEBOUNCE_MS = 500;

/**
 * 实际执行同步请求的内部函数（带错误暴露）。
 */
async function doSyncToCloud(table: string, action: string, data: unknown): Promise<void> {
  if (typeof window === 'undefined') return;
  const logId = (data as { id?: string })?.id?.substring(0, 12) || '?';
  // If already offline, skip the doomed fetch and enqueue immediately.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const { enqueue } = await import('@/lib/offline-queue');
    void enqueue(table, action, data);
    return;
  }
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, action, data }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.warn('[syncToCloud]', table, action, logId, '→', res.status, err.substring(0, 200));
      // P1-6: 暴露同步错误给 UI
      const { setLastSyncError } = await import('@/lib/offline-queue');
      setLastSyncError(`同步失败 [${table}/${action}]: HTTP ${res.status} ${err.substring(0, 120)}`);
      // P1-4: 广播同步错误给其他标签页
      broadcastSync({ type: 'sync-error', table, error: `HTTP ${res.status}` });
      // 4xx (except 401/429) are likely permanent (bad payload) — don't retry
      // forever. 5xx and network errors are transient → enqueue for replay.
      if (res.status >= 500 || res.status === 401 || res.status === 429) {
        const { enqueue } = await import('@/lib/offline-queue');
        void enqueue(table, action, data);
      }
    } else {
      console.log('[syncToCloud]', table, action, logId, '✅');
      // 同步成功：清空错误状态
      const { setLastSyncError } = await import('@/lib/offline-queue');
      setLastSyncError(null);
      // P1-4: 广播同步成功给其他标签页，便于刷新视图
      broadcastSync({ type: 'sync-success', table });
      // 删除成功：清理对应墓碑并清理该表的过期墓碑
      if (action === 'delete') {
        const tsId = tombstoneIdFromData(table, data);
        if (tsId) clearTombstone(table, tsId);
        cleanStaleTombstones(table);
      }
      // Best-effort: drain any backlog that may have accumulated.
      const { flush } = await import('@/lib/offline-queue');
      void flush();
    }
  } catch (e: any) {
    console.error('[syncToCloud] network error:', table, action, e.message);
    // P1-6: 暴露网络错误给 UI
    const { setLastSyncError } = await import('@/lib/offline-queue');
    setLastSyncError(`同步失败 [${table}/${action}]: ${e?.message || '网络错误'}`);
    // P1-4: 广播同步错误给其他标签页
    broadcastSync({ type: 'sync-error', table, error: e?.message || 'network' });
    // Network error (offline / DNS / CORS) → enqueue for later replay.
    const { enqueue } = await import('@/lib/offline-queue');
    void enqueue(table, action, data);
  }
}

/**
 * P1-3: 带 debounce + per-id mutex 的 syncToCloud 入口。
 * - delete 操作立即执行（不 debounce，避免删除被合并丢失）
 * - upsert 操作按 (table + id) debounce 500ms，同 id 的连续写合并为最后一次
 * - 同一 id 的请求通过 syncInFlight 串行化，避免并发覆盖
 */
function syncToCloud(table: string, action: string, data: unknown): void {
  if (typeof window === 'undefined') return;

  // delete 立即执行，不 debounce
  if (action === 'delete') {
    void runSync(table, action, data);
    return;
  }

  // upsert：按 (table + id) debounce，不同 id 互不影响
  const id = (data as { id?: string })?.id || `${table}_${action}`;
  const timerKey = `${table}:${id}`;
  const existing = syncDebounceTimers.get(timerKey);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    syncDebounceTimers.delete(timerKey);
    void runSync(table, action, data);
  }, SYNC_DEBOUNCE_MS);
  syncDebounceTimers.set(timerKey, timer);
}

/**
 * 执行同步：per-id mutex 串行化同一 id 的写。
 */
async function runSync(table: string, action: string, data: unknown): Promise<void> {
  const id = (data as { id?: string })?.id || `${table}_${action}`;
  const mutexKey = `${table}:${id}`;

  // 等待同一 id 的进行中请求完成，避免并发覆盖
  const prev = syncInFlight.get(mutexKey);
  if (prev) {
    // 让前一次完成后再执行本次（本次数据更新，覆盖前一次结果）
    await prev.catch(() => {});
  }

  const p = doSyncToCloud(table, action, data).finally(() => {
    syncInFlight.delete(mutexKey);
  });
  syncInFlight.set(mutexKey, p);
  await p;
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
  // 通用墓碑：按 id 记录，防止 cloud→local 合并时复活
  markDeleted('categories', id)
  // 注：categories 为本地默认数据，无对应云端表，不做 syncToCloud
}

export function getDeletedCategoryNames(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    return new Set(JSON.parse(localStorage.getItem('garden_deleted_cats') || '[]'))
  } catch { return new Set() }
}

// 云端同步版本 — 同时写本地和 VPS
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
  // 写墓碑，防止 cloud→local 同步时云端残留数据复活
  markDeleted('resources', id)
  syncToCloud('resources', 'delete', { id })
}

export function deleteLocalResources(ids: string[]) {
  if (ids.length === 0) return
  const idSet = new Set(ids)
  const resources = getLocalResources().filter(r => !idSet.has(r.id))
  write(RESOURCES_KEY, resources)
  ids.forEach(id => {
    markDeleted('resources', id)
    syncToCloud('resources', 'delete', { id })
  })
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
  // 写墓碑，防止 cloud→local 同步时云端残留数据复活
  markDeleted('collections', id)
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

// ========== 图解-笔记关联（pattern_notes） ==========

const PATTERN_NOTES_KEY = 'garden_pattern_notes'

export function getLocalPatternNotes(): PatternNoteRow[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(PATTERN_NOTES_KEY)
  return raw ? JSON.parse(raw) : []
}

export function saveLocalPatternNotes(notes: PatternNoteRow[]) {
  localStorage.setItem(PATTERN_NOTES_KEY, JSON.stringify(notes))
}

export function linkPatternNoteLocally(patternId: string, noteId: string): PatternNoteRow {
  const notes = getLocalPatternNotes()
  const existing = notes.find(n => n.pattern_id === patternId && n.note_id === noteId)
  if (existing) return existing
  const link: PatternNoteRow = {
    pattern_id: patternId,
    note_id: noteId,
    created_at: new Date().toISOString(),
  }
  notes.push(link)
  saveLocalPatternNotes(notes)
  // Sync without `id` — pattern_notes table has no id column (composite PK)
  syncToCloud('pattern_notes', 'upsert', { pattern_id: patternId, note_id: noteId, created_at: link.created_at })
  return link
}

export function unlinkPatternNoteLocally(patternId: string, noteId: string) {
  const notes = getLocalPatternNotes()
  const target = notes.find(n => n.pattern_id === patternId && n.note_id === noteId)
  const filtered = notes.filter(n => !(n.pattern_id === patternId && n.note_id === noteId))
  saveLocalPatternNotes(filtered)
  if (target) {
    // 写墓碑（复合键），防止 cloud→local 同步时云端残留关联复活
    markDeleted('pattern_notes', `${patternId}_${noteId}`)
    syncToCloud('pattern_notes', 'delete', { pattern_id: patternId, note_id: noteId })
  }
}

export function getPatternNotesForPattern(patternId: string): PatternNoteRow[] {
  return getLocalPatternNotes().filter(n => n.pattern_id === patternId)
}
