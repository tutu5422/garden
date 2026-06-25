import { NextResponse } from 'next/server';

/**
 * Unified API error response format.
 *
 * All API routes should use these helpers so clients get a consistent shape:
 *   { error: string, detail?: string, digest?: string }
 *
 * `error` is a short user-facing message (Chinese).
 * `detail` is an optional technical detail (English, safe to log — never
 *   include secrets/tokens).
 * `digest` is an optional correlation id for server-side log lookup.
 */

export interface ApiErrorBody {
  error: string;
  detail?: string;
  digest?: string;
}

/** 400 Bad Request — client sent an invalid payload. */
export function apiBadRequest(detail: string, digest?: string) {
  return NextResponse.json<ApiErrorBody>(
    { error: '请求参数错误', detail, digest },
    { status: 400 },
  );
}

/** 401 Unauthorized — no valid session. */
export function apiUnauthorized() {
  return NextResponse.json<ApiErrorBody>(
    { error: '未登录' },
    { status: 401 },
  );
}

/** 403 Forbidden — authenticated but not allowed. */
export function apiForbidden(detail?: string) {
  return NextResponse.json<ApiErrorBody>(
    { error: '无权限', detail },
    { status: 403 },
  );
}

/** 404 Not Found. */
export function apiNotFound(what = '资源') {
  return NextResponse.json<ApiErrorBody>(
    { error: `${what}不存在` },
    { status: 404 },
  );
}

/** 500 Internal Server Error — server-side failure. */
export function apiServerError(detail: string, digest?: string) {
  return NextResponse.json<ApiErrorBody>(
    { error: '服务器内部错误', detail, digest },
    { status: 500 },
  );
}

/**
 * Wrap an async route handler so any thrown Error becomes a uniform 500
 * response instead of an unstructured 500. The error is logged with a
 * generated digest that is also sent to the client for correlation.
 */
export async function withApiHandler(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e: any) {
    const digest = crypto.randomUUID().slice(0, 8);
    console.error(`[api:${digest}]`, e?.message || e);
    return apiServerError(e?.message || '未知错误', digest);
  }
}
