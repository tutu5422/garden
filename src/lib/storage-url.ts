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
/** 该 URL 是否已带存储读签名 */
export function isSignedStorageUrl(url: string | undefined | null): boolean {
  return Boolean(url && /[?&]s=/.test(url));
}

/**
 * 通过 /api/storage/sign 把（本地缓存里的）旧 URL 换成带签名的 URL。
 * `/storage/` 读已改成必须签名；客户端算不出签名，只能问服务端要。
 * 失败时原样返回（让调用方按原逻辑处理，不阻断流程）。
 */
export async function signStorageUrlClient(ref: string | undefined | null): Promise<string> {
  if (!ref || isSignedStorageUrl(ref)) return ref || '';
  try {
    const res = await fetch('/api/storage/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: [ref] }),
    });
    if (!res.ok) return ref;
    const j = (await res.json()) as { urls?: Record<string, string> };
    return j?.urls?.[ref] || ref;
  } catch {
    return ref;
  }
}

export function resolveStorageUrl(storagePath: string | undefined | null): string {
  if (!storagePath) return '';
  const vpsBase = (process.env.NEXT_PUBLIC_VPS_STORAGE_URL || '').replace(/\/+$/, '');
  if (vpsBase) return `${vpsBase}/${storagePath}`;
  return '';
}
