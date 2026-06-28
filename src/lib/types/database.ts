export type ResourceType = 'link' | 'image' | 'book' | 'movie' | 'tool' | 'article' | 'other'
export type ResourceStatus = 'active' | 'archived' | 'wishlist'

// ---------------------------------------------------------------------------
// Raw DB row shapes (as returned by PostgREST / Supabase REST).
// These mirror the actual table columns plus the `metadata` JSONB blob.
// ---------------------------------------------------------------------------

/** Raw `resources` table row (PostgREST/Supabase REST shape). */
export interface ResourceRow {
  id: string;
  title: string;
  description: string | null;
  resource_type: ResourceType | null;
  url: string | null;
  cover_image_url: string | null;
  author: string | null;
  rating: number | null;
  status: ResourceStatus;
  category_id: string | null;
  user_id: string;
  pinned: boolean;
  metadata: ResourceMetadata;
  created_at: string;
  updated_at: string;
}

/** Shape of the `metadata` JSONB column on `resources`. All fields optional
 *  because different resource kinds (note / file / music / link) use subsets. */
export interface ResourceMetadata {
  is_note?: boolean;
  is_file?: boolean;
  content?: string;
  image?: string | null;
  imageThumb?: string | null;
  tags?: string[];
  collectionId?: string | null;
  collectionName?: string | null;
  type?: string;
  actual_resource_type?: string;
  collection_name?: string;
  storagePath?: string;
  fileSize?: string;
  fileSizeBytes?: number;
  fileType?: string;
  fileCategory?: string;
  tracks?: MusicTrack[];
  updated_at?: string;
  // 图解（pattern）字段 — 用 metadata.is_pattern 标记，不修改 resource_type 枚举
  is_pattern?: true;
  patternBrand?: string;
  patternYarn?: string;
  patternYarnWeight?: string;
  patternDifficulty?: string;
  patternType?: string[];
  patternCraftType?: 'knit' | 'crochet' | 'both';
  patternStatus?: string; // 'not-started' | 'in-progress' | 'completed' | 'paused' | 'abandoned' | 'wishlist'
  patternProgress?: number; // 0-100
  patternPages?: number;
  patternStoragePath?: string;
  patternThumbnailPath?: string;
  patternLastUsedAt?: string;
  patternUsageCount?: number;
  patternRelatedNoteIds?: string[]; // 冗余缓存
  // BGM（可选）
  patternBgmTrackId?: string;
  patternBgmTrackTitle?: string;
  patternBgmTrackArtist?: string;
  [key: string]: unknown;
}

/** A single track in the music playlist (`metadata.tracks[]`). */
export interface MusicTrack {
  id: string;
  title: string;
  artist?: string;
  url?: string;
  storagePath?: string;
  duration?: number;
  lyrics?: string;
  [key: string]: unknown;
}

/** Raw `collections` table row. */
export interface CollectionRow {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  sort_order: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

/** Raw `collection_resources` junction row. */
export interface CollectionResourceRow {
  collection_id: string;
  resource_id: string;
  sort_order?: number;
}

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

/** `pattern_notes` junction table row. No separate `id` column — the primary
 *  key is the composite (pattern_id, note_id). The optional `id` field is used
 *  only by client-side code that synthesizes a composite key for React keys. */
export interface PatternNoteRow {
  id?: string;
  pattern_id: string;
  note_id: string;
  created_at: string;
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
      pattern_notes: { Row: PatternNoteRow; Insert: Pick<PatternNoteRow, 'pattern_id' | 'note_id'>; Update: never }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      resource_type: ResourceType
    }
  }
}
