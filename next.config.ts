import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { formats: ["image/webp", "image/avif"] },
  compiler: { removeConsole: process.env.NODE_ENV === "production" },
  async headers() {
    return [
      { source: "/(.*)", headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
      ]},
    ];
  },
  poweredByHeader: false,
};

export default nextConfig;
