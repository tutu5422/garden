import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, createToken, getPass, safeEqualStr, verifyToken } from "@/lib/auth";

const isDev = process.env.NODE_ENV === "development";

// General API rate limit: per-IP request timestamps within 60s
const RL = new Map<string, number[]>();
// Dedicated login rate limit: per-IP login attempts within 60s (max 5)
const LOGIN_RL = new Map<string, number[]>();
const LOGIN_MAX = 5;

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "x";
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = clientIp(req);

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  if (pathname === "/api/login" && req.method === "POST") {
    const pass = getPass();
    if (!pass) {
      return NextResponse.json({ ok: false, error: "服务端未配置站点密码" }, { status: 500 });
    }

    // Dedicated login rate limit: max LOGIN_MAX attempts per IP per minute
    const now = Date.now();
    const attempts = (LOGIN_RL.get(ip) || []).filter((t) => now - t < 60000);
    if (attempts.length >= LOGIN_MAX) {
      return NextResponse.json({ ok: false, error: "尝试过于频繁，请稍后再试" }, { status: 429 });
    }
    attempts.push(now);
    LOGIN_RL.set(ip, attempts);

    let bodyOk = false;
    try {
      const body = await req.json();
      if (safeEqualStr(String(body?.password || ""), pass)) {
        bodyOk = true;
      }
    } catch {
      return NextResponse.json({ ok: false, error: "请求无效" }, { status: 400 });
    }

    if (!bodyOk) {
      return NextResponse.json({ ok: false, error: "密码错误" }, { status: 401 });
    }

    // Issue a signed random-ish token (NOT the plaintext password)
    const token = await createToken(pass);
    const r = NextResponse.json({ ok: true });
    r.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: !isDev,
      sameSite: "lax",
      maxAge: 2592000,
      path: "/",
    });
    return r;
  }

  if (pathname.startsWith("/api/")) {
    const now = Date.now();
    const times = RL.get(ip) || [];
    const recent = times.filter((t) => now - t < 60000);
    if (recent.length >= 30) return NextResponse.json({ error: "Too many" }, { status: 429 });
    recent.push(now);
    RL.set(ip, recent);
    return NextResponse.next();
  }

  // Page protection: verify signed session token
  const pass = getPass();
  if (pass && (await verifyToken(req.cookies.get(AUTH_COOKIE)?.value, pass))) {
    if (pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (pathname !== "/login") return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|favicon.ico).*)"] };
