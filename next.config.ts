import type { NextConfig } from "next";

/**
 * Backend manzili (server tomonda ishlatiladi).
 * Brauzer so'rovlari /api/v1/* → shu manzilga rewrite qilinadi, shu sababli
 * dev rejimida CORS sozlash shart emas. Agar NEXT_PUBLIC_API_URL berilsa,
 * brauzer backendga to'g'ridan-to'g'ri murojaat qiladi (CORS kerak bo'ladi).
 */
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8001").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${BACKEND_URL}/api/v1/:path*` },
      { source: "/backend/docs", destination: `${BACKEND_URL}/docs` },
      { source: "/backend/openapi.json", destination: `${BACKEND_URL}/openapi.json` },
    ];
  },
  async headers() {
    return [
      {
        // Reader sahifasi: himoyalangan kontent keshlanmasin
        source: "/reader/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
