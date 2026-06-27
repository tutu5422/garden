import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Unified service-key Supabase admin client.
 *
 * Why this exists:
 * - Before unification, API routes built the service-key client in three
 *   different ways: raw `fetch` with hand-rolled headers (sync, files, music,
 *   debug), `createClient` from supabase-js (storage/presign), and ad-hoc
 *   URL/protocol fixing duplicated in every file.
 * - This module centralizes: env parsing, protocol-prefix fixing, config
 *   presence checks, the supabase-js client, and the REST helpers (fetch +
 *   POST-first upsert) that the sync route needs.
 *
 * Security notes:
 * - The service key bypasses RLS. Only import this from server-side route
 *   handlers that have already called `isAuth(req)`.
 * - Never expose the service key to the client.
 */

/** Raw env URL (may be missing the `https://` scheme on Vercel). */
export const RAW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
/** URL with a guaranteed protocol prefix. */
export const SUPABASE_URL = RAW_URL.startsWith('http') ? RAW_URL : `https://${RAW_URL}`;
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
export const LOCAL_USER_ID = process.env.SUPABASE_LOCAL_USER_ID || '';

/** True when every required server-side Supabase env var is present. */
export function supabaseConfigOk(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_KEY && LOCAL_USER_ID);
}

/**
 * True when the active DB backend is configured.
 * - VPS mode: requires VPS_DB_URL + LOCAL_USER_ID
 * - Supabase mode: requires supabaseConfigOk()
 * Use this instead of `supabaseConfigOk()` in routes that dispatch via
 * `dbFetch`/`dbUpsert`, so removing the Supabase service key post-migration
 * doesn't break the VPS code path.
 */
export function dbConfigOk(): boolean {
  if (vpsDbEnabled()) return Boolean(vpsDbUrl() && LOCAL_USER_ID);
  return supabaseConfigOk();
}

export interface SupabaseFetchResult {
  ok: boolean;
  status: number;
  error?: string;
  body?: unknown;
}

/**
 * Low-level REST call against the PostgREST API (`/rest/v1/...`).
 * Injects the standard service-key headers and `Prefer: return=minimal`.
 * Caller-supplied headers win over defaults.
 */
export async function supabaseFetch(
  path: string,
  options: RequestInit = {},
): Promise<SupabaseFetchResult> {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'return=minimal',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.error(`Supabase ${path}:`, res.status, err.substring(0, 300));
    return { ok: false, status: res.status, error: `${res.status}: ${err.substring(0, 200)}` };
  }

  // 204 / empty bodies shouldn't be parsed as JSON.
  const text = await res.text().catch(() => '');
  let body: unknown;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { ok: true, status: res.status, body };
}

/**
 * POST-first upsert: try POST (insert), and on a 409 unique-violation fall
 * back to PATCH on the matching `id`. Mirrors the original sync behaviour.
 */
export async function supabaseUpsert(
  table: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const id = data.id;
  const postResult = await supabaseFetch(table, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (postResult.ok) return { ok: true };
  if (postResult.status === 409) {
    // PATCH 时排除 id（主键），避免 API 报错
    const { id: _id, ...patchData } = data;
    const patchResult = await supabaseFetch(`${table}?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patchData),
    });
    return { ok: patchResult.ok, error: patchResult.error };
  }
  return { ok: false, error: postResult.error || `POST returned ${postResult.status}` };
}

/** Standard headers for direct Storage API calls (used by upload/delete helpers). */
export function storageHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    ...extra,
  };
}

/** Build a Storage object URL (e.g. for public/read links). */
export function storageObjectUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
}

/** Build a public Storage object URL. */
export function storagePublicUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

let _client: SupabaseClient | null = null;

/**
 * Lazily-built singleton supab-js client configured with the service key.
 * Use for Storage signed URLs and any high-level SDK call. Session/auth is
 * disabled since we only use the service key.
 */
export function supabaseAdmin(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}

// ---------------------------------------------------------------------------
// VPS local storage helpers (Nginx WebDAV-style PUT/DELETE).
//
// These are intentionally independent of Supabase. Routes check
// `process.env.VPS_STORAGE_URL` to decide whether to use VPS storage or fall
// back to the existing Supabase Storage logic. When the env var is absent,
// behaviour is unchanged.
// ---------------------------------------------------------------------------

/** True when VPS storage is enabled (env var present). */
export function vpsStorageEnabled(): boolean {
  return Boolean(process.env.VPS_STORAGE_URL);
}

/** Build a VPS storage URL for a given object path. */
export function vpsStorageUrl(path: string): string {
  const base = (process.env.VPS_STORAGE_URL || '').replace(/\/+$/, '');
  return `${base}/${path}`;
}

/**
 * Default Supabase Storage bucket used by the garden app. Kept here so
 * `resolveStorageUrl` and the presign route share a single source of truth.
 */
export const STORAGE_BUCKET = 'minitu-garden';

/**
 * Resolve a `storagePath` (e.g. `abc-uuid/abc-uuid.mp3`) into a fully-qualified
 * URL pointing at whichever storage backend is currently enabled.
 *
 * - When VPS storage is enabled (`VPS_STORAGE_URL` present) → returns the VPS
 *   WebDAV URL (`${VPS_STORAGE_URL}/${path}`).
 * - Otherwise → returns the Supabase Storage public object URL
 *   (`${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`).
 *
 * Use this anywhere a stored `storagePath` needs to become a playable /
 * downloadable URL at runtime, so the app follows the active backend
 * automatically without hardcoded absolute URLs in metadata.
 */
export function resolveStorageUrl(storagePath: string): string {
  if (!storagePath) return '';
  if (vpsStorageEnabled()) return vpsStorageUrl(storagePath);
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`;
}

/** Upload a buffer to VPS storage via HTTP PUT. */
export async function vpsUpload(
  path: string,
  buffer: ArrayBuffer,
  contentType: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = vpsStorageUrl(path);
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-storage-key': process.env.VPS_STORAGE_KEY || '',
    },
    body: buffer,
  });
  if (res.ok || res.status === 201 || res.status === 204) return { ok: true };
  const text = await res.text().catch(() => '');
  return { ok: false, error: `${res.status}: ${text.substring(0, 200)}` };
}

/** Delete an object from VPS storage via HTTP DELETE. 404 is treated as success. */
export async function vpsDelete(path: string): Promise<boolean> {
  const url = vpsStorageUrl(path);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'x-storage-key': process.env.VPS_STORAGE_KEY || '' },
  });
  return res.ok || res.status === 404;
}

// ---------------------------------------------------------------------------
// VPS PostgREST database helpers.
//
// These target a self-hosted PostgREST instance (e.g.
// https://storage.minitu.online/api/db/) and are independent of Supabase.
// Routes check `vpsDbEnabled()` to decide whether to use the VPS DB or fall
// back to the existing Supabase REST logic. When `VPS_DB_URL` is absent,
// behaviour is unchanged.
// ---------------------------------------------------------------------------

/** VPS PostgREST base URL (no trailing slash). */
export function vpsDbUrl(): string {
  return (process.env.VPS_DB_URL || '').replace(/\/+$/, '');
}

/** True when VPS PostgREST is enabled (env var present). */
export function vpsDbEnabled(): boolean {
  return Boolean(process.env.VPS_DB_URL);
}

/**
 * Low-level REST call against the VPS PostgREST API.
 * Injects `x-storage-key` for write auth and `Prefer: return=minimal`.
 * Caller-supplied headers win over defaults.
 */
export async function vpsDbFetch(
  path: string,
  options: RequestInit = {},
): Promise<SupabaseFetchResult> {
  const base = vpsDbUrl();
  if (!base) return { ok: false, status: 500, error: 'VPS_DB_URL not configured' };
  const url = `${base}/${path}`;
  const key = process.env.VPS_DB_KEY || '';
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-storage-key': key,
      Prefer: 'return=minimal',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.error(`VPS DB ${path}:`, res.status, err.substring(0, 300));
    return { ok: false, status: res.status, error: `${res.status}: ${err.substring(0, 200)}` };
  }

  // 204 / empty bodies shouldn't be parsed as JSON.
  const text = await res.text().catch(() => '');
  let body: unknown;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { ok: true, status: res.status, body };
}

/**
 * POST-first upsert against the VPS PostgREST API: try POST (insert), and on
 * a 409 unique-violation fall back to PATCH on the matching `id`. Mirrors
 * `supabaseUpsert`.
 */
export async function vpsDbUpsert(
  table: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const id = data.id;
  const postResult = await vpsDbFetch(table, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (postResult.ok) return { ok: true };
  if (postResult.status === 409) {
    // PATCH 时排除 id（主键），避免 PostgREST 报错
    const { id: _id, ...patchData } = data;
    const patchResult = await vpsDbFetch(`${table}?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patchData),
    });
    return { ok: patchResult.ok, error: patchResult.error };
  }
  return { ok: false, error: postResult.error || `POST returned ${postResult.status}` };
}

// ---------------------------------------------------------------------------
// Unified dispatch: routes DB calls through VPS PostgREST when enabled,
// falls back to Supabase REST otherwise.
// ---------------------------------------------------------------------------

/** Unified REST call — dispatches to `vpsDbFetch` or `supabaseFetch`. */
export async function dbFetch(path: string, options: RequestInit = {}): Promise<SupabaseFetchResult> {
  return vpsDbEnabled() ? vpsDbFetch(path, options) : supabaseFetch(path, options);
}

/** Unified upsert — dispatches to `vpsDbUpsert` or `supabaseUpsert`. */
export async function dbUpsert(
  table: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  return vpsDbEnabled() ? vpsDbUpsert(table, data) : supabaseUpsert(table, data);
}

/**
 * Tables that have a `user_id` column and are therefore "owned" by a user.
 * Used by `dbUpsertOwned` to enforce app-layer RLS: the LOCAL_USER_ID is
 * stamped onto every write so a forged payload can't create rows owned by
 * another user. This is defense-in-depth on top of the service key (which
 * bypasses DB-level RLS).
 */
const OWNED_TABLES = new Set(['resources', 'collections']);

/**
 * Upsert helper for user-owned tables (`resources`, `collections`).
 * Forces `user_id = LOCAL_USER_ID` on the row regardless of caller input,
 * so a client cannot write data attributed to another user.
 * Throws for tables not in `OWNED_TABLES` to prevent accidental misuse.
 */
export async function dbUpsertOwned(
  table: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  if (!OWNED_TABLES.has(table)) {
    return { ok: false, error: `dbUpsertOwned: table '${table}' is not user-owned` };
  }
  return dbUpsert(table, { ...data, user_id: LOCAL_USER_ID });
}
