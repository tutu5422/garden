import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PASS = process.env.SITE_PASSWORD || "123";
const COOKIE = "minitu_auth";
const RL = new Map<string, number[]>();
const isDev = process.env.NODE_ENV === "development";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = req.headers.get("x-forwarded-for") || "x";

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  if (pathname === "/api/login" && req.method === "POST") {
    // Validate password from request body
    try {
      const body = await req.json();
      if (body.password !== PASS) {
        return NextResponse.json({ ok: false, error: "密码错误" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "请求无效" }, { status: 400 });
    }
    const r = NextResponse.json({ ok: true });
    r.cookies.set(COOKIE, PASS, {
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

  if (req.cookies.get(COOKIE)?.value === PASS) {
    if (pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (pathname !== "/login") return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|favicon.ico).*)"] };
