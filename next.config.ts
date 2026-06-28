import type { NextConfig } from "next";

// Build the list of allowed remote image hostnames from env vars so next/image
// can optimize images served from the active storage backend (VPS or Supabase).
function remoteImagePatterns(): { protocol: "https"; hostname: string }[] {
  const patterns: { protocol: "https"; hostname: string }[] = [];
  const vpsUrl = process.env.NEXT_PUBLIC_VPS_STORAGE_URL;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  for (const raw of [vpsUrl, supaUrl]) {
    if (!raw) continue;
    try {
      const host = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`).hostname;
      if (host && !patterns.some((p) => p.hostname === host)) {
        patterns.push({ protocol: "https", hostname: host });
      }
    } catch { /* invalid URL, skip */ }
  }
  return patterns;
}

const nextConfig: NextConfig = {
  images: {
    formats: ["image/webp", "image/avif"],
    remotePatterns: remoteImagePatterns(),
  },
  compiler: { removeConsole: false }, // temporarily disabled for debugging
  async headers() {
    return [
      // Allow PDF viewer to be embedded in iframe (must come before catch-all)
      {
        source: "/pdf-viewer.html",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      // Security headers applied to every response.
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            // 'unsafe-eval' 是因为 PDF.js worker 使用 eval；
            // cdnjs/unpkg 用于 PDF.js viewer 与导入封面渲染；
            // worker-src 显式放开两个 CDN 以兼容 PDF.js worker 加载。
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://unpkg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; frame-src 'self'; media-src 'self' https:; object-src 'self'; worker-src 'self' https://cdnjs.cloudflare.com https://unpkg.com blob:",
          },
        ],
      },
      // Next.js build artifacts (JS/CSS chunks, fonts, static images). These
      // paths are content-hashed by filename, so they can be cached forever.
      // `immutable` tells browsers never to revalidate on navigation.
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // HTML pages and everything else: never cache — users should always see
      // the latest response so navigation updates and auth changes take effect
      // immediately. (Listed last so it acts as the default for non-static.)
      {
        source: "/((?!_next/static).*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, must-revalidate" },
        ],
      },
    ];
  },
  poweredByHeader: false,
};

export default nextConfig;
