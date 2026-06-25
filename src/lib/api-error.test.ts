import { describe, it, expect } from 'vitest';
import {
  apiBadRequest,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
  withApiHandler,
} from './api-error';
import { NextResponse } from 'next/server';

describe('api-error helpers', () => {
  it('apiBadRequest returns 400 with Chinese error', async () => {
    const res = apiBadRequest('missing field');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('请求参数错误');
    expect(body.detail).toBe('missing field');
  });

  it('apiUnauthorized returns 401', async () => {
    const res = apiUnauthorized();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('未登录');
  });

  it('apiForbidden returns 403', async () => {
    const res = apiForbidden('not owner');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('无权限');
    expect(body.detail).toBe('not owner');
  });

  it('apiNotFound returns 404 with custom resource name', async () => {
    const res = apiNotFound('歌词');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('歌词不存在');
  });

  it('apiNotFound defaults to "资源"', async () => {
    const res = apiNotFound();
    const body = await res.json();
    expect(body.error).toBe('资源不存在');
  });

  it('apiServerError returns 500 with digest', async () => {
    const res = apiServerError('DB down', 'abc123');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('服务器内部错误');
    expect(body.detail).toBe('DB down');
    expect(body.digest).toBe('abc123');
  });
});

describe('withApiHandler', () => {
  it('passes through successful responses', async () => {
    const result = await withApiHandler(async () =>
      NextResponse.json({ ok: true }, { status: 200 }),
    );
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.ok).toBe(true);
  });

  it('catches thrown errors and returns 500 with digest', async () => {
    const result = await withApiHandler(async () => {
      throw new Error('unexpected failure');
    });
    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body.error).toBe('服务器内部错误');
    expect(body.detail).toBe('unexpected failure');
    expect(body.digest).toBeTruthy();
    expect(body.digest).toHaveLength(8);
  });

  it('handles non-Error throws', async () => {
    const result = await withApiHandler(async () => {
      throw 'string error';
    });
    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body.error).toBe('服务器内部错误');
  });
});
