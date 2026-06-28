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
