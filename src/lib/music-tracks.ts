/**
 * 曲库写入净化：标题规范化 + 存储路径前缀校验 + 去重
 *
 * 背景（2026-09-20 实测事故）：客户端把本地曲库推回云端时，会带上两类脏数据——
 *   ① 标题写成「歌手 - 歌名」（如 'Rileigh Grey - Hello, Goodbye'），与云端同曲条目
 *      按标题去重时对不上 → 云端出现重复歌曲；
 *   ② storagePath 缺 `music/` 前缀（历史导入写成 `<uuid>/<uuid>.mp3`），磁盘上根本
 *      没这个文件 → 曲库里出现"能看见、点不开"的僵尸条目（本站实测 6 条）。
 *
 * 这里只做**规则性**净化（服务端拿不到 VPS 磁盘，不能校验文件真实存在）：
 *   · 标题前缀只有在该前缀确实等于歌手名时才剥离，避免误伤 'A - B' 这类正常标题；
 *   · 路径缺已知前缀时补 `music/`（音乐资源的历史约定），已是 http(s) 链接的不动；
 *   · 按「路径」再按「归一化标题+歌手」去重，保留带正确前缀/扩展名的那条。
 *
 * 服务端写入路径（/api/db upsert、/api/sync 曲库行）与客户端合并都应过这一层。
 */

/** 与 nginx /storage/ 下的目录约定一致：只认这些前缀 */
export const STORAGE_PATH_PREFIXES = ['music/', 'patterns/', 'covers/', 'notes/', 'uploads/'] as const;

const AUDIO_EXT = /\.(mp3|flac|m4a|wav|ogg|opus|aac)$/i;
const SEPARATORS = [' - ', ' – ', ' — ', ' — ', ': ', '：'];

export type MusicTrackLike = {
  id?: string;
  title?: string;
  artist?: string;
  album?: string;
  storagePath?: string;
  url?: string;
  [key: string]: unknown;
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** 标题/歌手归一（比对用）：去空白、去常见标点、转小写 */
export function trackKeyText(s: unknown): string {
  return str(s)
    .toLowerCase()
    .replace(/[\s\u3000\-_·，,。、:：;；!！?？'"“”‘’()（）[\]【】]/g, '');
}

/**
 * 标题规范化：「歌手 - 歌名」→「歌名」。
 * 仅当分隔符前的内容与歌手名一致（归一后）时才剥离，否则原样返回。
 */
export function normalizeTrackTitle(title: unknown, artist: unknown): string {
  const t = str(title);
  const a = str(artist);
  if (!t || !a) return t;
  const keyA = trackKeyText(a);
  for (const sep of SEPARATORS) {
    const i = t.indexOf(sep);
    if (i <= 0) continue;
    const head = t.slice(0, i);
    if (trackKeyText(head) === keyA) {
      const rest = t.slice(i + sep.length).trim();
      if (rest) return rest;
    }
  }
  return t;
}

/**
 * 存储路径规范化：去首尾空白、去开头 `/`、缺已知前缀时补 `music/`。
 * http(s):// 开头（外部直链）与空值原样返回。
 */
export function normalizeTrackPath(raw: unknown): string {
  let p = str(raw);
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  while (p.startsWith('/')) p = p.slice(1);
  if (STORAGE_PATH_PREFIXES.some((pre) => p.startsWith(pre))) return p;
  // 裸 `<uuid>/<uuid>.mp3` 这类历史写法 → 回归音乐目录约定
  if (/^[^/]+\/[^/]+$/.test(p)) return `music/${p}`;
  return p;
}

/** 一条曲目的去重键：优先用路径，没有路径才用「标题+歌手」 */
export function trackDedupeKey(t: MusicTrackLike): string {
  const p = normalizeTrackPath(t.storagePath);
  if (p) return `p:${p.toLowerCase()}`;
  return `n:${trackKeyText(t.title)}|${trackKeyText(t.artist)}`;
}

/** 播放器解析用键（同一首歌的不同写法归一到一起） */
function songKey(t: MusicTrackLike): string {
  return `${trackKeyText(t.title)}|${trackKeyText(t.artist)}`;
}

export type SanitizeStats = {
  total: number;
  kept: number;
  removed: number;
  titleFixed: number;
  pathFixed: number;
};

/** 挑一条更好的保留：原本就带正确前缀 > 带音频扩展名 > 条目更"厚"（字段多） */
function scoreOf(t: MusicTrackLike, rawPath: string): number {
  const p = normalizeTrackPath(t.storagePath);
  return (
    (STORAGE_PATH_PREFIXES.some((pre) => rawPath.startsWith(pre)) ? 8 : 0) + // 自己的原路径本来就是规范的
    (STORAGE_PATH_PREFIXES.some((pre) => p.startsWith(pre)) ? 4 : 0) +
    (AUDIO_EXT.test(p) ? 2 : 0) +
    (typeof t.id === 'string' && t.id ? 1 : 0)
  );
}

/**
 * 净化一整个曲库数组：规范化标题/路径 + 去重。
 * 输入不是数组时返回空数组；非对象元素被丢弃。
 * 泛型只为调用方免去断言——本函数不做字段完整性校验（缺字段原样保留）。
 */
export function sanitizeMusicTracks<T extends MusicTrackLike = MusicTrackLike>(
  input: unknown,
): { tracks: T[]; stats: SanitizeStats } {
  const stats: SanitizeStats = { total: 0, kept: 0, removed: 0, titleFixed: 0, pathFixed: 0 };
  if (!Array.isArray(input)) return { tracks: [], stats };
  stats.total = input.length;

  const byPath = new Map<string, number>();
  const bySong = new Map<string, number>();
  const out: MusicTrackLike[] = [];
  const scores: number[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const t = raw as MusicTrackLike;
    const rawTitle = str(t.title);
    const rawPath = str(t.storagePath);
    const title = normalizeTrackTitle(rawTitle, t.artist);
    const storagePath = normalizeTrackPath(rawPath);
    if (title !== rawTitle) stats.titleFixed += 1;
    if (storagePath !== rawPath) stats.pathFixed += 1;
    const next: MusicTrackLike = { ...t, title, storagePath };
    const score = scoreOf(next, rawPath);

    const pk = storagePath ? `p:${storagePath.toLowerCase()}` : '';
    const sk = songKey(next);
    let dupAt: number | undefined;
    if (pk && byPath.has(pk)) dupAt = byPath.get(pk);
    else if (bySong.has(sk)) dupAt = bySong.get(sk);

    if (dupAt !== undefined) {
      stats.removed += 1;
      // 同曲重复：留下更规范的那条（原路径已带前缀 / 带扩展名 / 字段更全）
      if (score > scores[dupAt]) {
        out[dupAt] = next;
        scores[dupAt] = score;
        if (pk) byPath.set(pk, dupAt);
        bySong.set(sk, dupAt);
      }
      continue;
    }

    const idx = out.length;
    out.push(next);
    scores.push(score);
    if (pk) byPath.set(pk, idx);
    bySong.set(sk, idx);
  }

  stats.kept = out.length;
  return { tracks: out as T[], stats };
}

/**
 * 深度净化：对象里只要有 `metadata.tracks` 数组就替换成净化后的（服务端写库前调用）。
 * 不含曲库的对象原样返回（同一引用），避免动到其它表的写入。
 */
export function sanitizeMusicTracksDeep<T>(data: T): T {
  if (!data || typeof data !== 'object') return data;
  const obj = data as Record<string, unknown>;
  const meta = obj.metadata;
  if (!meta || typeof meta !== 'object' || !Array.isArray((meta as Record<string, unknown>).tracks)) {
    return data;
  }
  const { tracks } = sanitizeMusicTracks((meta as Record<string, unknown>).tracks);
  return { ...obj, metadata: { ...(meta as Record<string, unknown>), tracks } } as T;
}
