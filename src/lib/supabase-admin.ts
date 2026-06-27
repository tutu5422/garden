/**
 * 统一数据层 — VPS 版
 *
 * 所有数据操作走 VPS PostgREST / Nginx WebDAV，彻底脱离 Supabase。
 */

export const LOCAL_USER_ID = process.env.SUPABASE_LOCAL_USER_ID || '';

export interface DbResult {
  ok: boolean;
  status: number;
  error?: string;
  body?: unknown;
}

// ---------------------------------------------------------------------------
// VPS PostgREST 数据库
// ---------------------------------------------------------------------------

export function vpsDbUrl(): string {
  return (process.env.VPS_DB_URL || '').replace(/\/+$/, '');
}

export function vpsDbEnabled(): boolean {
  return Boolean(process.env.VPS_DB_URL);
}

export function dbConfigOk(): boolean {
  return Boolean(vpsDbUrl() && process.env.SUPABASE_LOCAL_USER_ID);
}

/** 低层 REST 调用（VPS PostgREST） */
export async function vpsDbFetch(
  path: string,
  options: RequestInit = {},
): Promise<DbResult> {
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

  const text = await res.text().catch(() => '');
  let body: unknown;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { ok: true, status: res.status, body };
}

/** Upsert：有 id 先 PATCH，404 降级 POST */
export async function vpsDbUpsert(
  table: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const id = data.id;
  if (id) {
    const { id: _id, ...patchData } = data;
    const patchResult = await vpsDbFetch(`${table}?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patchData),
    });
    if (patchResult.status === 204) return { ok: true };
    if (patchResult.status !== 404) {
      return { ok: false, error: patchResult.error || `PATCH returned ${patchResult.status}` };
    }
  }
  const postResult = await vpsDbFetch(table, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (postResult.ok) return { ok: true };
  return { ok: false, error: postResult.error || `POST returned ${postResult.status}` };
}

// ---------------------------------------------------------------------------
// 统一调度（直接走 VPS，无 Supabase 回退）
// ---------------------------------------------------------------------------

export async function dbFetch(path: string, options: RequestInit = {}): Promise<DbResult> {
  return vpsDbFetch(path, options);
}

export async function dbUpsert(
  table: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  return vpsDbUpsert(table, data);
}

const OWNED_TABLES = new Set(['resources', 'collections']);

export async function dbUpsertOwned(
  table: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  if (!OWNED_TABLES.has(table)) {
    return { ok: false, error: `dbUpsertOwned: table '${table}' is not user-owned` };
  }
  return dbUpsert(table, { ...data, user_id: LOCAL_USER_ID });
}

// ---------------------------------------------------------------------------
// VPS 文件存储（Nginx WebDAV）
// ---------------------------------------------------------------------------

export function vpsStorageEnabled(): boolean {
  return Boolean(process.env.VPS_STORAGE_URL);
}

export function vpsStorageUrl(path: string): string {
  const base = (process.env.VPS_STORAGE_URL || '').replace(/\/+$/, '');
  return `${base}/${path}`;
}

export const STORAGE_BUCKET = 'minitu-garden';

export function resolveStorageUrl(storagePath: string): string {
  if (!storagePath) return '';
  if (vpsStorageEnabled()) return vpsStorageUrl(storagePath);
  return ''; // VPS 未配置时返回空
}

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

export async function vpsDelete(path: string): Promise<boolean> {
  const url = vpsStorageUrl(path);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'x-storage-key': process.env.VPS_STORAGE_KEY || '' },
  });
  return res.ok || res.status === 404;
}
