import { NextRequest, NextResponse } from "next/server";

/**
 * 小说阅读服务转发层。
 *
 * 云端小说服务跑在首尔 VPS 的容器里（127.0.0.1:8850），nginx 挂在
 * https://storage.minitu.online/novel/ 上，需要 x-storage-key 密钥头。
 *
 * 这里由服务端（不是浏览器）带上密钥转发，所以：
 * - 密钥不会出现在前端代码/网络请求里；
 * - 只有登录过 minitu.online（middleware 已拦截）才能调用这些接口。
 */

const BASE = (process.env.NOVEL_API_URL || "https://storage.minitu.online/novel").replace(/\/+$/, "");
const KEY = process.env.VPS_STORAGE_KEY || "garden_storage_2026";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = `${BASE}/api/${(path || []).join("/")}${req.nextUrl.search}`;
  try {
    const init: RequestInit = {
      method: req.method,
      headers: { "x-storage-key": KEY, "Content-Type": "application/json" },
      cache: "no-store",
    };
    if (req.method === "POST") init.body = await req.text();
    const r = await fetch(url, init);
    const body = await r.arrayBuffer();
    return new NextResponse(body, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") || "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `云端阅读服务不可达：${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
