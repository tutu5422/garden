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
 * 查询图解列表 — 仅本地 localStorage。
 * 云端图解请使用 @/lib/api/patterns-api（通过 /api/db 代理走 VPS PostgREST）。
 */
export async function getPatterns(filters: PatternFilters = {}): Promise<{ data: Resource[]; count: number }> {
  return getLocalPatternsFiltered(filters)
}

/**
 * 单个图解详情 — 仅本地。
 */
export async function getPatternById(id: string): Promise<Resource | null> {
  return getLocalPattern(id)
}

/**
 * 笔记关联的图解列表 — 仅本地。
 */
export async function getPatternsForNote(noteId: string): Promise<Resource[]> {
  return getLocalPatternsForNote(noteId)
}

/**
 * 图解关联的笔记列表 — 仅本地。
 */
export async function getNotesForPattern(patternId: string): Promise<any[]> {
  return getLocalNotesForPattern(patternId)
}

/**
 * 建立图解-笔记关联 — 仅本地。
 */
export async function linkPatternNote(patternId: string, noteId: string): Promise<boolean> {
  return linkLocalPatternNote(patternId, noteId)
}

/**
 * 取消图解-笔记关联 — 仅本地。
 */
export async function unlinkPatternNote(patternId: string, noteId: string): Promise<boolean> {
  return unlinkLocalPatternNote(patternId, noteId)
}

/**
 * 创建图解资源（不包含文件上传，仅 metadata）— 仅本地。
 */
export async function createPattern(data: { title: string; metadata: any }): Promise<Resource | null> {
  return createLocalPattern(data)
}

/**
 * 更新图解状态和进度（自动更新 patternLastUsedAt）— 仅本地。
 */
export async function updatePatternStatus(id: string, status: string, progress?: number): Promise<boolean> {
  return updateLocalPatternStatus(id, status, progress)
}

/**
 * 获取心愿单图解（patternStatus='wishlist'）
 */
export async function getWishlistPatterns(): Promise<{ data: Resource[]; count: number }> {
  return getPatterns({ status: 'wishlist', pageSize: 999 })
}

// =============================================================================
// 本地（localStorage）实现
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
