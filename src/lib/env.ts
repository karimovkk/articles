/** Brauzer va serverda xavfsiz o'qiladigan sozlamalar. */
export const env = {
  /** Bo'sh bo'lsa same-origin (/api/v1 → next.config rewrites). */
  apiBaseUrl: (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, ""),
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Articles365",
} as const;

export const API_PREFIX = "/api/v1";
