import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PASS = process.env.SITE_PASSWORD || "minitu2026";
const COOKIE = "minitu_auth";
const RL = new Map<string, number[]>();

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = req.headers.get("x-forwarded-for") || "x";

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
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

  if (pathname === "/api/login" && req.method === "POST") {
    const r = NextResponse.json({ ok: true });
    r.cookies.set(COOKIE, PASS, { httpOnly: true, secure: true, sameSite: "strict", maxAge: 2592000, path: "/" });
    return r;
  }

  if (req.cookies.get(COOKIE)?.value === PASS) {
    if (pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (pathname !== "/login") return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|favicon.ico).*)"] };
