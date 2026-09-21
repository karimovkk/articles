/** Brauzer va serverda xavfsiz o'qiladigan sozlamalar. */
export const env = {
  /** Bo'sh bo'lsa same-origin (/api/v1 → next.config rewrites). */
  apiBaseUrl: (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, ""),
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Articles365",
  /** Klient tomonidagi yuklash limitlari (MB) — backend `MAX_BOOK_UPLOAD_SIZE` / `MAX_COVER_UPLOAD_SIZE` ga mos qo'yiladi. */
  maxPdfMb: Number(process.env.NEXT_PUBLIC_MAX_PDF_MB) || 500,
  maxCoverMb: Number(process.env.NEXT_PUBLIC_MAX_COVER_MB) || 5,
  /**
   * "Sotib olish" havolasi (FE-2.3): Telegram bot va h.k.; `{book_id}` o'rniga kitob id qo'yiladi.
   * Bo'sh bo'lsa "administrator bilan bog'laning" ko'rsatiladi. Aniq oqim — PM Q2.
   */
  purchaseUrl: process.env.NEXT_PUBLIC_PURCHASE_URL ?? "",
} as const;

/** Sotib olish havolasini kitob uchun quradi; sozlanmagan bo'lsa null. */
export function purchaseLink(bookId: string): string | null {
  if (!env.purchaseUrl) return null;
  return env.purchaseUrl.includes("{book_id}") ? env.purchaseUrl.replace("{book_id}", encodeURIComponent(bookId)) : env.purchaseUrl;
}

export const API_PREFIX = "/api/v1";
