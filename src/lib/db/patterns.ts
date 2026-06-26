import { createServerSupabase, isPlaceholder } from '@/lib/supabase/server'
import type { Resource, PatternNoteRow } from '@/lib/types'

export interface PatternFilters {
  search?: string
  status?: string        // patternStatus: 'not-started' | 'in-progress' | 'completed' | 'paused' | 'wishlist'
  difficulty?: string
  brand?: string
  category?: string
  sort?: string
  page?: number
  pageSize?: number
}

/**
 * 查询图解列表 — 过滤 metadata->>is_pattern = true
 */
export async function getPatterns(filters: PatternFilters = {}): Promise<{ data: Resource[]; count: number }> {
  if (isPlaceholder()) {
    return getLocalPatternsFiltered(filters)
  }

  const supabase = await createServerSupabase()

  const {
    search, status, difficulty, brand, category,
    sort = 'newest', page = 1, pageSize = 12,
  } = filters

  let query = supabase
    .from('resources')
    .select('*, category:categories(*), resource_tags(tag:tags(*))', { count: 'exact' })
    .filter('metadata->>is_pattern', 'eq', 'true')

  if (status) query = query.filter('metadata->>patternStatus', 'eq', status)
  if (difficulty) query = query.filter('metadata->>patternDifficulty', 'eq', difficulty)
  if (brand) query = query.ilike('metadata->>patternBrand', `%${brand}%`)
  if (search) query = query.ilike('title', `%${search}%`)
  if (category) {
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', category).single()
    if (cat) query = query.eq('category_id', (cat as { id: string }).id)
  }

  if (sort === 'oldest') query = query.order('created_at', { ascending: true })
  else if (sort === 'title') query = query.order('title', { ascending: true })
  else if (sort === 'updated') query = query.order('updated_at', { ascending: false })
  else query = query.order('created_at', { ascending: false })

  const from = (page - 1) * pageSize
  query = query.range(from, from + pageSize - 1)

  const { data, error, count } = await query
  if (error) { console.error('getPatterns 错误:', error); return { data: [], count: 0 } }
  return { data: (data || []) as unknown as Resource[], count: count || 0 }
}

/**
 * 单个图解详情
 */
export async function getPatternById(id: string): Promise<Resource | null> {
  if (isPlaceholder()) {
    return getLocalPattern(id)
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('resources')
    .select('*, category:categories(*), resource_tags(tag:tags(*))')
    .eq('id', id)
    .filter('metadata->>is_pattern', 'eq', 'true')
    .single()

  if (error) return null
  return data as unknown as Resource
}

/**
 * 笔记关联的图解列表
 */
export async function getPatternsForNote(noteId: string): Promise<Resource[]> {
  if (isPlaceholder()) {
    return getLocalPatternsForNote(noteId)
  }

  const supabase = await createServerSupabase()

  // 先查出关联的 pattern_ids
  const { data: links, error: linkErr } = await supabase
    .from('pattern_notes')
    .select('pattern_id')
    .eq('note_id', noteId)

  if (linkErr || !links?.length) return []

  const patternIds = links.map(l => (l as { pattern_id: string }).pattern_id)
  const { data, error } = await supabase
    .from('resources')
    .select('*, category:categories(*), resource_tags(tag:tags(*))')
    .in('id', patternIds)
    .filter('metadata->>is_pattern', 'eq', 'true')

  if (error) return []
  return (data || []) as unknown as Resource[]
}

/**
 * 图解关联的笔记列表
 */
export async function getNotesForPattern(patternId: string): Promise<any[]> {
  if (isPlaceholder()) {
    return getLocalNotesForPattern(patternId)
  }

  const supabase = await createServerSupabase()

  const { data: links, error: linkErr } = await supabase
    .from('pattern_notes')
    .select('note_id')
    .eq('pattern_id', patternId)

  if (linkErr || !links?.length) return []

  const noteIds = links.map(l => (l as { note_id: string }).note_id)
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .in('id', noteIds)

  if (error) return []
  return data || []
}

/**
 * 建立图解-笔记关联
 */
export async function linkPatternNote(patternId: string, noteId: string): Promise<boolean> {
  if (isPlaceholder()) {
    return linkLocalPatternNote(patternId, noteId)
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from('pattern_notes')
    .insert({ pattern_id: patternId, note_id: noteId })

  if (error) {
    // 唯一约束冲突表示已存在，不算错误
    if (error.code === '23505') return true
    console.error('linkPatternNote 错误:', error)
    return false
  }
  return true
}

/**
 * 取消图解-笔记关联
 */
export async function unlinkPatternNote(patternId: string, noteId: string): Promise<boolean> {
  if (isPlaceholder()) {
    return unlinkLocalPatternNote(patternId, noteId)
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from('pattern_notes')
    .delete()
    .eq('pattern_id', patternId)
    .eq('note_id', noteId)

  if (error) {
    console.error('unlinkPatternNote 错误:', error)
    return false
  }
  return true
}

/**
 * 创建图解资源（不包含文件上传，仅 metadata）
 */
export async function createPattern(data: { title: string; metadata: any }): Promise<Resource | null> {
  if (isPlaceholder()) {
    return createLocalPattern(data)
  }

  const supabase = await createServerSupabase()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('请先登录')

  const resourceData = {
    title: data.title,
    resource_type: 'other' as const,
    status: 'active' as const,
    metadata: {
      is_pattern: true,
      patternStatus: 'not-started',
      patternProgress: 0,
      ...data.metadata,
    },
    user_id: userData.user.id,
  }

  const { data: created, error } = await supabase
    .from('resources')
    .insert(resourceData as any)
    .select()
    .single()

  if (error) {
    console.error('createPattern 错误:', error)
    return null
  }
  return created as unknown as Resource
}

/**
 * 更新图解状态和进度（自动更新 patternLastUsedAt）
 */
export async function updatePatternStatus(id: string, status: string, progress?: number): Promise<boolean> {
  if (isPlaceholder()) {
    return updateLocalPatternStatus(id, status, progress)
  }

  const supabase = await createServerSupabase()

  // 先获取当前 metadata
  const { data: current, error: getErr } = await supabase
    .from('resources')
    .select('metadata')
    .eq('id', id)
    .single()

  if (getErr || !current) {
    console.error('updatePatternStatus 查询错误:', getErr)
    return false
  }

  const currentMeta = (current as any).metadata || {}
  const updatedMeta = {
    ...currentMeta,
    patternStatus: status,
    patternProgress: progress !== undefined ? progress : (currentMeta.patternProgress || 0),
    patternLastUsedAt: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('resources')
    .update({ metadata: updatedMeta, updated_at: new Date().toISOString() } as any)
    .eq('id', id)

  if (error) {
    console.error('updatePatternStatus 错误:', error)
    return false
  }
  return true
}

/**
 * 获取心愿单图解（patternStatus='wishlist'）
 */
export async function getWishlistPatterns(): Promise<{ data: Resource[]; count: number }> {
  return getPatterns({ status: 'wishlist', pageSize: 999 })
}

// =============================================================================
// 本地（localStorage）实现 — 供 isPlaceholder 模式使用
// =============================================================================

function getLocalResourcesFromStore(): Resource[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('garden_resources')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function getLocalPatternNoteLinks(): PatternNoteRow[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('garden_pattern_notes')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveLocalPatternNoteLinks(links: PatternNoteRow[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('garden_pattern_notes', JSON.stringify(links))
  } catch (e) {
    console.error('保存 pattern_notes 失败:', e)
  }
}

function getLocalPatterns(): Resource[] {
  return getLocalResourcesFromStore().filter(r => {
    const meta = r.metadata || {}
    return (meta as any).is_pattern === true
  })
}

function getLocalPattern(id: string): Resource | null {
  return getLocalPatterns().find(r => r.id === id) || null
}

function getLocalPatternsFiltered(filters: PatternFilters = {}): { data: Resource[]; count: number } {
  let list = getLocalPatterns()

  if (filters.status) list = list.filter(r => (r.metadata as any).patternStatus === filters.status)
  if (filters.difficulty) list = list.filter(r => (r.metadata as any).patternDifficulty === filters.difficulty)
  if (filters.brand) {
    const q = filters.brand.toLowerCase()
    list = list.filter(r => ((r.metadata as any).patternBrand || '').toLowerCase().includes(q))
  }
  if (filters.search) {
    const q = filters.search.toLowerCase()
    list = list.filter(r => r.title.toLowerCase().includes(q))
  }

  if (filters.sort === 'oldest') list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  else if (filters.sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'zh'))
  else if (filters.sort === 'updated') list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  else list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const count = list.length
  const page = filters.page || 1
  const size = filters.pageSize || 12
  const paged = list.slice((page - 1) * size, page * size)

  return { data: paged, count }
}

function getLocalPatternsForNote(noteId: string): Resource[] {
  const links = getLocalPatternNoteLinks()
  const patternIds = links.filter(l => l.note_id === noteId).map(l => l.pattern_id)
  return getLocalPatterns().filter(r => patternIds.includes(r.id))
}

function getLocalNotesForPattern(patternId: string): any[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('garden_notes') || '[]'
    const allNotes: any[] = JSON.parse(raw)
    const links = getLocalPatternNoteLinks()
    const noteIds = links.filter(l => l.pattern_id === patternId).map(l => l.note_id)
    return allNotes.filter(n => noteIds.includes(n.id))
  } catch { return [] }
}

function linkLocalPatternNote(patternId: string, noteId: string): boolean {
  const links = getLocalPatternNoteLinks()
  if (links.some(l => l.pattern_id === patternId && l.note_id === noteId)) return true
  links.push({
    id: crypto.randomUUID?.() || 'pn-' + Date.now().toString(36),
    pattern_id: patternId,
    note_id: noteId,
    created_at: new Date().toISOString(),
  })
  saveLocalPatternNoteLinks(links)
  return true
}

function unlinkLocalPatternNote(patternId: string, noteId: string): boolean {
  const links = getLocalPatternNoteLinks().filter(
    l => !(l.pattern_id === patternId && l.note_id === noteId)
  )
  saveLocalPatternNoteLinks(links)
  return true
}

function uid(): string {
  return crypto.randomUUID?.() || 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

function createLocalPattern(data: { title: string; metadata: any }): Resource {
  const resources = getLocalResourcesFromStore()
  const pattern: Resource = {
    id: uid(),
    title: data.title,
    description: null,
    resource_type: 'other',
    url: null,
    cover_image_url: null,
    author: null,
    rating: null,
    status: 'active',
    category_id: null,
    metadata: {
      is_pattern: true,
      patternStatus: 'not-started',
      patternProgress: 0,
      ...data.metadata,
    },
    pinned: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: 'local-user',
  }
  resources.push(pattern)
  try { localStorage.setItem('garden_resources', JSON.stringify(resources)) } catch {}
  return pattern
}

function updateLocalPatternStatus(id: string, status: string, progress?: number): boolean {
  const resources = getLocalResourcesFromStore()
  const idx = resources.findIndex(r => r.id === id)
  if (idx === -1) return false
  const meta = (resources[idx].metadata || {}) as any
  meta.patternStatus = status
  meta.patternProgress = progress !== undefined ? progress : (meta.patternProgress || 0)
  meta.patternLastUsedAt = new Date().toISOString()
  resources[idx].metadata = meta
  resources[idx].updated_at = new Date().toISOString()
  try { localStorage.setItem('garden_resources', JSON.stringify(resources)) } catch {}
  return true
}
