import { NextRequest, NextResponse } from 'next/server';
import { dbFetch, dbUpsert, dbUpsertOwned } from '@/lib/vps-db';
import { configMissingResponse, getPass, isAuth } from '@/lib/auth';

/**
 * 通用数据库代理 API
 *
 * 客户端组件（'use client'）无法直接调用 dbFetch/dbUpsert，
 * 因为那些函数依赖服务端环境变量（VPS_DB_URL 等）。
 * 本路由作为代理，在服务端执行真正的数据库操作。
 *
 * POST /api/db
 * Body: { table: string, action: 'fetch'|'upsert'|'delete', data?: any, filters?: any, owned?: boolean }
 */
export async function POST(req: NextRequest) {
  if (!getPass()) return configMissingResponse();
  if (!(await isAuth(req))) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { table, action, data, owned } = body;

    if (!table || !action) {
      return NextResponse.json({ error: '缺少 table 或 action 参数' }, { status: 400 });
    }

    // 表白名单：只允许访问指定的表
    const ALLOWED_TABLES = new Set([
      'resources', 'collections', 'tags', 'categories',
      'pattern_notes', 'collection_resources', 'resource_tags',
    ]);
    const baseTable = (table as string).split('?')[0];
    if (!ALLOWED_TABLES.has(baseTable)) {
      return NextResponse.json({ error: '不允许的表' }, { status: 403 });
    }

    let result;

    switch (action) {
      case 'fetch': {
        // table 形如 "resources?select=...&order=..."
        const method = data?.method || 'GET';
        const fetchOptions: RequestInit = { method };
        if (data?.body && method !== 'GET') {
          fetchOptions.body = JSON.stringify(data.body);
        }
        if (data?.headers) {
          fetchOptions.headers = { ...fetchOptions.headers, ...data.headers };
        }
        result = await dbFetch(table, fetchOptions);
        break;
      }

      case 'upsert':
        result = owned
          ? await dbUpsertOwned(table, data || {})
          : await dbUpsert(table, data || {});
        break;

      case 'delete':
        result = await dbFetch(table, { method: 'DELETE' });
        break;

      default:
        return NextResponse.json({ error: `未知操作: ${action}` }, { status: 400 });
    }

    if (!result.ok) {
      const status = 'status' in result ? (result as any).status : 500;
      return NextResponse.json(
        { error: result.error || `数据库操作失败: ${status}` },
        { status },
      );
    }

    return NextResponse.json({ data: 'body' in result ? result.body : null, ok: true });
  } catch (e: any) {
    console.error('API /api/db 错误:', e?.message || e);
    return NextResponse.json({ error: e?.message || '代理请求失败' }, { status: 500 });
  }
}
