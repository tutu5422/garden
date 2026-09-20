/**
 * 登录失败限流 —— 跨边缘实例的持久化版本
 *
 * 背景：原先限流是边缘实例内存态（Map），Vercel 会同时跑多个实例、还会冷启新实例，
 * 每个实例各算各的，「每分钟 5 次」在并发/多实例下会被放大成 N×5。
 *
 * 做法：把失败次数落到 VPS 的 PostgREST（表 login_attempts，只存 IP 的 SHA-256 前 32 位，
 * 不留明文 IP），每次登录前查近 60 秒内该 IP 的失败数，全局一致。
 *
 * 两条硬规则：
 *  1) **fail-open**：任何 DB 故障（超时/未配置/5xx）都返回 null = 「查不到」，
 *     调用方退回内存限流，绝不因为限流组件故障把主人锁在门外。
 *  2) 登录**成功即清空**该 IP 的失败记录，正常用户永远不会被自己的历史失败拖累。
 */

const WINDOW_MS = 60_000;
const MAX_FAILS = 5;
const TIMEOUT_MS = 1500;
const TABLE = 'login_attempts';

function cfg(): { url: string; key: string } | null {
  const url = (process.env.VPS_DB_URL || '').replace(/\/+$/, '');
  const key = process.env.VPS_DB_KEY || '';
  return url && key ? { url, key } : null;
}

/** IP → 短哈希（避免在数据库里存明文 IP；同机固定盐即可防彩虹表式对照） */
async function ipHash(ip: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|garden-login`));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  } catch {
    return ip.slice(0, 32);
  }
}

async function call(path: string, init: RequestInit = {}): Promise<Response | null> {
  const c = cfg();
  if (!c) return null;
  try {
    return await fetch(`${c.url}/${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'x-storage-key': c.key, ...(init.headers || {}) },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return null; // 超时/网络错误 → 交给调用方 fail-open
  }
}

/**
 * 近 60 秒内该 IP 的失败次数。
 * @returns 次数；null = 持久化层不可用（调用方应退回内存限流，不要拦截）
 */
export async function loginFailCount(ip: string): Promise<number | null> {
  if (!cfg()) return null;
  const hash = await ipHash(ip);
  const since = encodeURIComponent(new Date(Date.now() - WINDOW_MS).toISOString());
  const res = await call(`${TABLE}?ip=eq.${hash}&created_at=gt.${since}&select=id&limit=${MAX_FAILS + 1}`);
  if (!res || !res.ok) return null;
  try {
    const rows = await res.json();
    return Array.isArray(rows) ? rows.length : null;
  } catch {
    return null;
  }
}

/** 记一次失败 + 顺手清理 1 天前的旧记录（有索引，开销可忽略） */
export async function recordLoginFail(ip: string): Promise<void> {
  const hash = await ipHash(ip);
  await call(TABLE, { method: 'POST', body: JSON.stringify({ ip: hash }), headers: { Prefer: 'return=minimal' } });
  const old = encodeURIComponent(new Date(Date.now() - 86_400_000).toISOString());
  await call(`${TABLE}?created_at=lt.${old}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
}

/** 登录成功：清掉该 IP 的失败记录 */
export async function clearLoginFails(ip: string): Promise<void> {
  const hash = await ipHash(ip);
  await call(`${TABLE}?ip=eq.${hash}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
}

export const LOGIN_RL_WINDOW_MS = WINDOW_MS;
export const LOGIN_RL_MAX_FAILS = MAX_FAILS;
