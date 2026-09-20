import { NextRequest, NextResponse } from 'next/server';
import { dbFetch, dbUpsert, dbUpsertOwned, LOCAL_USER_ID } from '@/lib/vps-db';
import { configMissingResponse, getPass, isAuth } from '@/lib/auth';
import { errMsg } from '@/lib/api-error';
import { signStorageDeep, stripStorageSigsDeep } from '@/lib/storage-sign';
import { sanitizeMusicTracksDeep } from '@/lib/music-tracks';

/**
 * 通用数据库代理 API
 *
 * 客户端组件（'use client'）无法直接调用 dbFetch/dbUpsert，
 * 因为那些函数依赖服务端环境变量（VPS_DB_URL 等）。
 * 本路由作为代理，在服务端执行真正的数据库操作。
 *
 * POST /api/db
 * Body: { table: string, action: 'fetch'|'upsert'|'delete', data?: any }
 *
 * 安全规则：
 * - owned 表（resources/collections）的所有操作强制注入 user_id 作用域
 * - delete 必须带白名单过滤字段（id / resource_id / pattern_id+note_id / collection_id）
 * - 拒绝 # 等危险字符，防止 fragment 绕过
 * - 不再信任客户端传入的 owned 参数，由服务端按表名决定
 */

// Tables that contain user-scoped data (server enforces user_id on all ops)
const OWNED_TABLES = new Set(['resources', 'collections']);

// Allowed tables
const ALLOWED_TABLES = new Set([
  'resources', 'collections', 'tags', 'categories',
  'pattern_notes', 'collection_resources', 'resource_tags',
]);

// Delete filter rules: each listed field must use eq. or in. operator
const DELETE_FILTERS: Record<string, string[]> = {
  'resources': ['id'],
  'collections': ['id'],
  'categories': ['id'],
  'tags': ['id'],
  'resource_tags': ['resource_id'],
  'pattern_notes': ['pattern_id', 'note_id'],
  'collection_resources': ['collection_id'],
};

/** Parse query string; reject # (fragment) and control chars */
function parseParams(qs: string): URLSearchParams {
  if (/[#\x00-\x1f]/.test(qs)) {
    throw new Error('查询串包含非法字符');
  }
  return new URLSearchParams(qs);
}

export async function POST(req: NextRequest) {
  if (!getPass()) return configMissingResponse();
  if (!(await isAuth(req))) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { table: tableRaw, action, data } = body;

    if (!tableRaw || !action) {
      return NextResponse.json({ error: '缺少 table 或 action 参数' }, { status: 400 });
    }

    const tableStr = tableRaw as string;

    // Reject dangerous chars in the whole table string
    if (/[#\x00-\x1f<>]/.test(tableStr)) {
      return NextResponse.json({ error: 'table 参数包含非法字符' }, { status: 400 });
    }

    // Split base table name and query string (only split on first ?)
    const qIdx = tableStr.indexOf('?');
    const baseTable = qIdx === -1 ? tableStr : tableStr.slice(0, qIdx);
    const queryString = qIdx === -1 ? '' : tableStr.slice(qIdx + 1);

    if (!ALLOWED_TABLES.has(baseTable)) {
      return NextResponse.json({ error: '不允许的表' }, { status: 403 });
    }

    const isOwned = OWNED_TABLES.has(baseTable);

    let result;

    switch (action) {
      case 'fetch': {
        // Owned tables: inject user_id scope (service key bypasses RLS)
        const fetchPath = isOwned
          ? `${tableStr}${queryString ? '&' : '?'}user_id=eq.${LOCAL_USER_ID}`
          : tableStr;
        result = await dbFetch(fetchPath, { method: 'GET' });
        break;
      }

      case 'upsert':
        // 客户端可能把带读签名的 URL 回写 → 入库前去掉签名（否则签名过期后变死链）
        // 曲库数据额外过一层净化：标题剥离「歌手 - 」前缀 + storagePath 补齐 music/ 前缀 + 同曲去重，
        // 防止客户端把「僵尸条目（路径缺前缀、磁盘无文件）」和重复歌曲推回云端。
        {
          const clean = sanitizeMusicTracksDeep(stripStorageSigsDeep(data || {}));
          result = isOwned ? await dbUpsertOwned(baseTable, clean) : await dbUpsert(baseTable, clean);
        }
        break;

      case 'delete': {
        // Parse and validate delete filters (reject fragments)
        let params: URLSearchParams;
        try {
          params = parseParams(queryString);
        } catch (e) {
          return NextResponse.json({ error: errMsg(e) }, { status: 400 });
        }

        const allowed = DELETE_FILTERS[baseTable];
        if (!allowed) {
          return NextResponse.json(
            { error: `不允许对表 ${baseTable} 执行删除` },
            { status: 400 },
          );
        }

        // At least one allowed filter field must use eq. or in.
        const hasFilter = allowed.some((field) => {
          const val = params.get(field);
          return val && /^(eq|in)\./.test(val);
        });
        if (!hasFilter) {
          return NextResponse.json(
            { error: `删除必须带过滤条件: ${allowed.join('、')}` },
            { status: 400 },
          );
        }

        // Owned tables: also inject user_id scope
        const deletePath = isOwned
          ? `${tableStr}&user_id=eq.${LOCAL_USER_ID}`
          : tableStr;
        result = await dbFetch(deletePath, { method: 'DELETE' });
        break;
      }

      default:
        return NextResponse.json({ error: `未知操作: ${action}` }, { status: 400 });
    }

    if (!result.ok) {
      const status = 'status' in result ? (result as { status?: number }).status : 500;
      return NextResponse.json(
        { error: result.error || `数据库操作失败: ${status}` },
        { status },
      );
    }

    // 读签名：经代理出去的存储 URL（封面/PDF/文件）统一换成带签名的版本
    return NextResponse.json({ data: signStorageDeep('body' in result ? result.body : null), ok: true });
  } catch (e) {
    console.error('API /api/db 错误:', errMsg(e));
    return NextResponse.json({ error: errMsg(e) || '代理请求失败' }, { status: 500 });
  }
}
