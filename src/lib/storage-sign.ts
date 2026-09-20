/**
 * 存储读签名（服务端专用）
 *
 * 背景：`/storage/` 之前是公开读 —— 任何人拿到 URL（随机 slug）就能直接读图片/音频/PDF。
 * 现在 nginx 对**读**也要签名：`?e=<过期时间戳>&s=base64url(md5(secret + $uri + e))`，
 * 与上传用的 secure_link 同一套算法（写路径是 /storage-write/，读是 /storage/）。
 *
 * 设计要点：
 *  1) 只签 `/storage/` 下的路径；外部 URL 原样返回，避免误伤外链。
 *  2) 签名走**小时桶**：exp = 当前整点 + ttl。同一小时内同一路径签名完全一致，
 *     浏览器 / next/image / Service Worker 的缓存不会每次都 miss；过期后自然作废。
 *  3) 签的是**解码后的路径**（nginx 的 `$uri` 是解码后的），但 URL 里输出编码形式 ——
 *     含中文/空格的路径两边都对得上。
 *  4) 没配 secret 时原样返回（本地开发/降级），不抛错。
 *
 * 服务端在签发内容前调用 `signStorageDeep(payload)`，即可把响应体里所有存储 URL
 * 换成带签名的版本；数据库里**始终存不带签名的规范 URL**，签名只在读路径生成。
 */
import crypto from 'node:crypto';

const SECRET = process.env.STORAGE_SIGN_SECRET || '';
const BASE = (process.env.VPS_STORAGE_URL || 'https://storage.minitu.online/storage').replace(/\/+$/, '');
/** 读签名默认有效期：7 天（够覆盖长时间播放/离线缓存，同时让泄漏的 URL 会过期） */
export const READ_TTL_SEC = 7 * 24 * 3600;

/** 是否为本存储域下的 URL（或裸路径） */
export function isStorageRef(v: string): boolean {
  return typeof v === 'string' && (v.startsWith(`${BASE}/`) || v.startsWith('/storage/'));
}

/** 把存储路径/URL 换成带读签名的 URL */
export function signStorageReadUrl(ref: string | null | undefined, ttlSec: number = READ_TTL_SEC): string {
  if (!ref) return '';
  if (!SECRET) return ref;

  let path = ref;
  if (path.startsWith(BASE)) path = path.slice(BASE.length);
  else if (/^https?:\/\//i.test(path)) return ref; // 非本存储域，原样
  path = path.replace(/^\/+/, '');
  const q = path.indexOf('?');
  if (q >= 0) path = path.slice(0, q); // 去掉旧签名/查询串
  if (path.startsWith('storage/')) path = path.slice('storage/'.length); // 容错：误传了前缀
  if (!path) return '';

  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    /* 非法编码就用原串 */
  }

  const uri = `/storage/${decoded}`;
  const exp = Math.floor(Date.now() / 1000 / 3600) * 3600 + ttlSec;
  const s = crypto
    .createHash('md5')
    .update(`${SECRET}${uri}${exp}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // 注意：必须对**解码后**的路径做 encodeURI —— encodeURI 会把 % 转义成 %25，
  // 对已编码串再编一次就会得到 %2520/%257C（实测导致织集两张封面 403）。
  // encodeURI 不编码 # 和 ?（它们是 fragment / query 分隔符），要手动补。
  const enc = encodeURI(decoded).replace(/#/g, '%23').replace(/\?/g, '%3F');
  return `${BASE}/${enc}?e=${exp}&s=${s}`;
}

/** 去掉存储 URL 上的读签名（写库前必须去掉，否则 7 天后过期变死链） */
export function stripStorageReadSig(ref: string): string {
  if (typeof ref !== 'string' || !ref.startsWith(`${BASE}/`)) return ref;
  const q = ref.indexOf('?');
  return q >= 0 ? ref.slice(0, q) : ref;
}

/** 递归去掉对象里所有存储 URL 的读签名（用于写回数据库前「回正」） */
export function stripStorageSigsDeep<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return v.startsWith(`${BASE}/`) ? stripStorageReadSig(v) : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

/**
 * 递归把对象里所有「存储 URL 字符串」换成带签名的版本。
 * 只处理形如 `<BASE>/...` 的完整 URL，不动裸路径（`storagePath` 字段语义要保持）。
 */
export function signStorageDeep<T>(value: T): T {
  if (!SECRET) return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return v.startsWith(`${BASE}/`) ? signStorageReadUrl(v) : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return walk(value) as T;
}
