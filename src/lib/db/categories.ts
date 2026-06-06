import { createServerSupabase, isPlaceholder } from '@/lib/supabase/server'
import { getLocalCategories, getLocalCategory, getLocalCategoryCounts } from '@/lib/db/local-store'
import type { Category } from '@/lib/types'

const MOCK_CATEGORIES: Category[] = [
  { id: 'cat-1', name: '编程', slug: 'coding', description: null, icon: '💻', color: '#3B82F6', sort_order: 1, created_at: '', updated_at: '' },
  { id: 'cat-2', name: '阅读', slug: 'reading', description: null, icon: '📚', color: '#10B981', sort_order: 2, created_at: '', updated_at: '' },
  { id: 'cat-3', name: '影视', slug: 'movies', description: null, icon: '🎬', color: '#F59E0B', sort_order: 3, created_at: '', updated_at: '' },
  { id: 'cat-4', name: '音乐', slug: 'music', description: null, icon: '🎵', color: '#EF4444', sort_order: 4, created_at: '', updated_at: '' },
  { id: 'cat-5', name: '设计', slug: 'design', description: null, icon: '🎨', color: '#EC4899', sort_order: 5, created_at: '', updated_at: '' },
]

export async function getCategories(): Promise<Category[]> {
  if (isPlaceholder()) return getLocalCategories()
  const supabase = await createServerSupabase()
  const { data } = await supabase.from('categories').select('*').order('sort_order')
  // 合并本地和云端
  const cloud = (data || []) as unknown as Category[]
  const local = getLocalCategories()
  const cloudNames = new Set(cloud.map(c => c.name))
  const localOnly = local.filter(c => !cloudNames.has(c.name))
  return [...cloud, ...localOnly]
}

export async function getCategory(slug: string): Promise<Category | null> {
  if (isPlaceholder()) return getLocalCategory(slug)
  const supabase = await createServerSupabase()
  const { data } = await supabase.from('categories').select('*').eq('slug', slug).single()
  return data ? (data as unknown as Category) : MOCK_CATEGORIES.find(c => c.slug === slug) || null
}

export async function getCategoryResourceCounts() {
  if (isPlaceholder()) return getLocalCategoryCounts()
  const cats = await getCategories()
  const supabase = await createServerSupabase()
  const counts = await Promise.all(cats.map(async cat => {
    const { count } = await supabase.from('resources').select('*', { count: 'exact', head: true }).eq('category_id', cat.id).eq('status', 'active')
    return { id: cat.id, name: cat.name, slug: cat.slug, icon: cat.icon, count: count || 0 }
  }))
  return counts
}
