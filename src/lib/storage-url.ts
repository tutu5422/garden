/**
 * Client-side storage URL resolver.
 *
 * Mirrors the server-side `resolveStorageUrl` in `vps-db.ts` but only
 * reads `NEXT_PUBLIC_*` env vars (server-only vars like `VPS_STORAGE_URL` are
 * not inlined into the client bundle). Both env vars must be kept in sync via
 * `.env.local` (`VPS_STORAGE_URL` + `NEXT_PUBLIC_VPS_STORAGE_URL`).
 *
 * Use this in client components (`'use client'`) to turn a stored `storagePath`
 * into a playable/downloadable URL that follows the currently active backend.
 */

/** True when the client bundle sees a VPS storage base URL. */
export function clientVpsStorageEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VPS_STORAGE_URL);
}

/**
 * Resolve a `storagePath` (e.g. `abc/abc.mp3`) to a fully-qualified URL.
 * Returns `''` for empty input. When `f.url` is already a valid absolute URL
 * stored at upload time, callers should prefer it and only fall back to this.
 */
export function resolveStorageUrl(storagePath: string | undefined | null): string {
  if (!storagePath) return '';
  const vpsBase = (process.env.NEXT_PUBLIC_VPS_STORAGE_URL || '').replace(/\/+$/, '');
  if (vpsBase) return `${vpsBase}/${storagePath}`;
  return '';
}
