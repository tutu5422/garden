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
  const local = getLocalCategories()
  return local.length ? local : MOCK_CATEGORIES
}

export async function getCategory(slug: string): Promise<Category | null> {
  return getLocalCategory(slug) || MOCK_CATEGORIES.find(c => c.slug === slug) || null
}

export async function getCategoryResourceCounts() {
  return getLocalCategoryCounts()
}
