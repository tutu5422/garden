export type ResourceType = 'link' | 'image' | 'book' | 'movie' | 'tool' | 'article' | 'other'
export type ResourceStatus = 'active' | 'archived' | 'wishlist'

export interface Profile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  website: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Resource {
  id: string
  title: string
  description: string | null
  resource_type: ResourceType
  url: string | null
  cover_image_url: string | null
  author: string | null
  rating: number | null
  status: ResourceStatus
  category_id: string | null
  metadata: Record<string, unknown>
  pinned: boolean
  created_at: string
  updated_at: string
  user_id: string
  // Joined fields
  category?: Category | null
  resource_tags?: { tag: Tag }[]
}

export interface Tag {
  id: string
  name: string
  slug: string
  color: string | null
  created_at: string
}

export interface ResourceTag {
  resource_id: string
  tag_id: string
}

export interface Collection {
  id: string
  title: string
  description: string | null
  cover_image_url: string | null
  is_public: boolean
  sort_order: number
  created_at: string
  updated_at: string
  user_id: string
}

export interface Note {
  id: string
  title: string
  slug: string
  content: string | null
  excerpt: string | null
  is_published: boolean
  category_id: string | null
  created_at: string
  updated_at: string
  user_id: string
}

export interface ResourceFilters {
  search?: string
  type?: ResourceType
  category?: string
  status?: ResourceStatus
  tag?: string
  sort?: 'newest' | 'oldest' | 'rating' | 'title'
  page?: number
  pageSize?: number
}

// Supabase Database type (generated placeholder)
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Profile, 'id'>> }
      categories: { Row: Category; Insert: Omit<Category, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Category, 'id'>> }
      resources: { Row: Resource; Insert: Omit<Resource, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Resource, 'id'>> }
      tags: { Row: Tag; Insert: Omit<Tag, 'id' | 'created_at'>; Update: Partial<Omit<Tag, 'id'>> }
      resource_tags: { Row: ResourceTag; Insert: ResourceTag; Update: Partial<ResourceTag> }
      collections: { Row: Collection; Insert: Omit<Collection, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Collection, 'id'>> }
      collection_resources: { Row: { collection_id: string; resource_id: string; sort_order: number }; Insert: { collection_id: string; resource_id: string; sort_order?: number }; Update: { sort_order?: number } }
      notes: { Row: Note; Insert: Omit<Note, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Note, 'id'>> }
      note_links: { Row: { source_note_id: string; target_note_id: string; link_text: string | null; created_at: string }; Insert: { source_note_id: string; target_note_id: string; link_text?: string }; Update: Partial<{ link_text: string }> }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      resource_type: ResourceType
    }
  }
}
