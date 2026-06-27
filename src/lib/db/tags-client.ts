import { searchLocalTags, getOrCreateTag as localGetOrCreate } from '@/lib/db/local-store'
import type { Tag } from '@/lib/types'

export async function searchTags(query: string): Promise<Tag[]> {
  return searchLocalTags(query)
}

export async function getOrCreateTag(name: string): Promise<Tag> {
  return localGetOrCreate(name)
}
