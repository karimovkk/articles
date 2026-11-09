import type { NextConfig } from "next";

/**
 * Backend manzili (server tomonda ishlatiladi).
 * Brauzer so'rovlari /api/v1/* → shu manzilga rewrite qilinadi, shu sababli
 * dev rejimida CORS sozlash shart emas. Agar NEXT_PUBLIC_API_URL berilsa,
 * brauzer backendga to'g'ridan-to'g'ri murojaat qiladi (CORS kerak bo'ladi).
 */
// Oxiridagi `/` va `/api/v1` olib tashlanadi — rewrite `/api/v1/:path*` ni o'zi qo'shadi.
// BACKEND_URL berilmasa — NEXT_PUBLIC_API_URL (brauzer ishlatadigan backend) olinadi: `/api/v1/auth/*` doim shu rewrite
// orqali ketadi, Vercel'da BACKEND_URL unutilsa `localhost` ga rewrite 404 (DNS_HOSTNAME_RESOLVED_PRIVATE) berib,
// login/refresh butunlay ishlamay qolardi (2026-11-09 hodisasi).
const BACKEND_URL = (process.env.BACKEND_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8001")
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/i, "")
  .replace(/\/+$/, "");

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
        // Barcha sahifalar: asosiy xavfsizlik header'lari (TZ §4 — clickjacking, MIME sniffing, referrer, sensorlar).
        // 106: Telegram Web (web.telegram.org) Mini App'ni iframe'da ochadi — faqat shu manbaga ruxsat (frame-ancestors;
        // X-Frame-Options ro'yxatni qo'llamaydi). Admin — hech qayerga (pastda)
        source: "/((?!admin).*)",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self' https://web.telegram.org" }],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        source: "/:path*",
        headers: [
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
