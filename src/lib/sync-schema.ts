import { z } from 'zod';

/**
 * Input validation for the `/api/sync` POST endpoint.
 *
 * Before this module the route read `await req.json()` and accessed fields
 * with no shape check, so a malformed client payload could throw deep inside
 * a Supabase call or — worse — write a partially-shaped row. These schemas
 * make the contract explicit and produce a clean 400 on bad input.
 *
 * The shapes mirror what the route handler actually reads; fields the route
 * ignores are left permissive (`z.any()` / `.passthrough()`) so we don't
 * reject payloads the existing client already sends.
 */

// ----- Shared primitives -------------------------------------------------

/** UUID-ish string. We don't enforce canonical UUID format because legacy
 *  notes use a mix of uuid v4 and v5; we only require a non-empty string. */
const idSchema = z.string().min(1);

const isoString = z.string().min(1);

// ----- Upsert data shapes (per table) -----------------------------------

const resourceUpsertDataSchema = z.object({
  id: idSchema,
  title: z.string().optional().default(''),
  description: z.string().nullable().optional(),
  resource_type: z.string().optional(),
  category_id: z.string().nullable().optional(),
  status: z.string().optional(),
  url: z.string().nullable().optional(),
  cover_image_url: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  rating: z.union([z.number(), z.string(), z.null()]).optional(),
  pinned: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional().default({}),
  resource_tags: z
    .array(
      z.object({ tag: z.union([z.string(), z.object({ name: z.string() })]) }).passthrough(),
    )
    .optional()
    .default([]),
  created_at: isoString.optional(),
});

const noteUpsertDataSchema = z.object({
  id: idSchema,
  title: z.string().optional().default(''),
  content: z.string().optional().default(''),
  image: z.string().nullable().optional(),
  imageThumb: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  collectionId: z.string().nullable().optional(),
  collectionName: z.string().nullable().optional(),
  type: z.string().optional().default('article'),
  createdAt: isoString.optional(),
});

const musicPlaylistUpsertDataSchema = z.object({
  tracks: z.array(z.record(z.string(), z.any())).optional().default([]),
  created_at: isoString.optional(),
});

const collectionUpsertDataSchema = z.object({
  id: idSchema,
  title: z.string(),
  description: z.string().optional().default(''),
  coverImage: z.string().optional().default(''),
  isPublic: z.boolean().optional().default(false),
  sort_order: z.number().optional().default(0),
  resourceIds: z.array(idSchema).optional().default([]),
  createdAt: isoString.optional(),
});

const fileUpsertDataSchema = z.object({
  id: idSchema,
  name: z.string().optional().default(''),
  size: z.string().optional().default('0 B'),
  sizeBytes: z.number().optional().default(0),
  type: z.string().optional().default(''),
  category: z.string().optional().default(''),
  storagePath: z.string().optional().default(''),
  createdAt: isoString.optional(),
});

const patternNoteUpsertDataSchema = z.object({
  id: idSchema.optional(),
  pattern_id: idSchema,
  note_id: idSchema,
  created_at: isoString.optional(),
});

// ----- Delete data shape -------------------------------------------------

const deleteDataSchema = z.object({
  id: idSchema.optional(),
  // pattern_notes uses composite key (pattern_id, note_id) — no `id` column
  pattern_id: idSchema.optional(),
  note_id: idSchema.optional(),
}).refine(
  (d) => d.id || (d.pattern_id && d.note_id),
  { message: 'Either id or (pattern_id + note_id) is required' },
);

// ----- Top-level payload -------------------------------------------------

export const SYNC_TABLES_UPSERT = ['resources', 'music_playlist', 'notes', 'collections', 'files', 'pattern_notes'] as const;
export const SYNC_TABLES_DELETE = ['resources', 'notes', 'collections', 'files', 'pattern_notes'] as const;
export const SYNC_ACTIONS = ['upsert', 'delete'] as const;

const upsertPayloadSchema = z.discriminatedUnion('table', [
  z.object({ table: z.literal('resources'), action: z.literal('upsert'), data: resourceUpsertDataSchema }),
  z.object({ table: z.literal('music_playlist'), action: z.literal('upsert'), data: musicPlaylistUpsertDataSchema }),
  z.object({ table: z.literal('notes'), action: z.literal('upsert'), data: noteUpsertDataSchema }),
  z.object({ table: z.literal('collections'), action: z.literal('upsert'), data: collectionUpsertDataSchema }),
  z.object({ table: z.literal('files'), action: z.literal('upsert'), data: fileUpsertDataSchema }),
  z.object({ table: z.literal('pattern_notes'), action: z.literal('upsert'), data: patternNoteUpsertDataSchema }),
]);

const deletePayloadSchema = z.object({
  table: z.enum(SYNC_TABLES_DELETE),
  action: z.literal('delete'),
  data: deleteDataSchema,
});

export const syncPostSchema = z.discriminatedUnion('action', [
  upsertPayloadSchema,
  deletePayloadSchema,
]);

export type SyncPostPayload = z.infer<typeof syncPostSchema>;
export type ResourceUpsertData = z.infer<typeof resourceUpsertDataSchema>;
export type NoteUpsertData = z.infer<typeof noteUpsertDataSchema>;
export type CollectionUpsertData = z.infer<typeof collectionUpsertDataSchema>;
export type FileUpsertData = z.infer<typeof fileUpsertDataSchema>;
export type MusicPlaylistUpsertData = z.infer<typeof musicPlaylistUpsertDataSchema>;
export type PatternNoteUpsertData = z.infer<typeof patternNoteUpsertDataSchema>;
