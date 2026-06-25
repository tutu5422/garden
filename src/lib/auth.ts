import { NextRequest, NextResponse } from 'next/server';

/**
 * Shared auth helpers.
 *
 * Security model:
 * - SITE_PASSWORD must be set via env. No default fallback — if missing, all
 *   auth checks fail and routes return 500.
 * - On successful login we issue a signed stateless token (NOT the plaintext
 *   password). Token = `<expiry>.<hmac-sha256(pass, expiry)>`.
 * - Token verification uses constant-time comparison to resist timing attacks.
 * - Uses Web Crypto API so it works in both edge (middleware) and nodejs
 *   (route handler) runtimes.
 */

export const AUTH_COOKIE = 'minitu_auth';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Returns the configured password, or null if SITE_PASSWORD is unset/empty. */
export function getPass(): string | null {
  const p = process.env.SITE_PASSWORD;
  return p && p.length > 0 ? p : null;
}

/** Constant-time string comparison. Returns false for unequal lengths. */
export function safeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // burn a little time to reduce length-based timing leakage
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ a.charCodeAt(i);
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(msg));
  const bytes = new Uint8Array(sig);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

/** Create a signed session token bound to the configured password. */
export async function createToken(pass: string): Promise<string> {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const sig = await hmacHex(pass, String(expiry));
  return `${expiry}.${sig}`;
}

/** Verify a token against the configured password (constant-time). */
export async function verifyToken(token: string | undefined, pass: string): Promise<boolean> {
  if (!token) return false;
  const idx = token.indexOf('.');
  if (idx <= 0) return false;
  const expiryStr = token.substring(0, idx);
  const sig = token.substring(idx + 1);
  const expected = await hmacHex(pass, expiryStr);
  if (!safeEqualStr(sig, expected)) return false;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  return true;
}

/** Authenticate a request by verifying its session cookie. */
export async function isAuth(req: NextRequest): Promise<boolean> {
  const pass = getPass();
  if (!pass) return false;
  return verifyToken(req.cookies.get(AUTH_COOKIE)?.value, pass);
}

/** Standard 500 response for missing SITE_PASSWORD config. */
export function configMissingResponse() {
  return NextResponse.json({ error: '服务端配置缺失（SITE_PASSWORD 未设置）' }, { status: 500 });
}

/**
 * Reject paths that could escape their intended directory.
 * Disallows: leading `/`, and any `../` or `..\` segments.
 */
export function isSafePath(p: string): boolean {
  if (typeof p !== 'string' || p.length === 0) return false;
  if (p.startsWith('/')) return false;
  if (p.includes('../') || p.includes('..\\')) return false;
  if (p === '..' || p === '.') return false;
  return true;
}
