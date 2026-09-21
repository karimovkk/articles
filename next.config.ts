import type { NextConfig } from "next";

/**
 * Backend manzili (server tomonda ishlatiladi).
 * Brauzer so'rovlari /api/v1/* → shu manzilga rewrite qilinadi, shu sababli
 * dev rejimida CORS sozlash shart emas. Agar NEXT_PUBLIC_API_URL berilsa,
 * brauzer backendga to'g'ridan-to'g'ri murojaat qiladi (CORS kerak bo'ladi).
 */
// Oxiridagi `/` va `/api/v1` olib tashlanadi — rewrite `/api/v1/:path*` ni o'zi qo'shadi
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8001").trim().replace(/\/+$/, "").replace(/\/api\/v1$/i, "");

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
        // Barcha sahifalar: asosiy xavfsizlik header'lari (TZ §4 — clickjacking, MIME sniffing, referrer, sensorlar)
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
      {
        // Reader va kitob sahifalari: himoyalangan kontent keshlanmasin
        source: "/reader/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
      {
        source: "/books/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
