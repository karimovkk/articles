/**
 * Reader (himoyalangan kontent) — maqola bo'yicha (OpenAPI):
 *  GET /reader/books/{book_id}/articles     → maqolalar ro'yxati (holat, %, o'qilgan)
 *  GET /reader/books/{book_id}/cover?size=  → muqova (original|thumb|medium)
 *  GET /reader/articles/{id}                → metadata (page_count, processing_status, features)
 *  GET /reader/articles/{id}/content        → Range (206 / 416 {details.size})
 *  GET /reader/articles/{id}/watermark      → HMAC-imzolangan watermark
 *
 * Fayl hech qachon to'liq yuklab olinmaydi: barcha baytlar Bearer + ruxsat tekshiruvi bilan keladi.
 * Backend hozircha 206 javobda `Content-Range` bermaydi (B1) — hajm 416 `details.size` orqali olinadi.
 */
import { api, apiRaw, ApiError } from "./client";
import type { ArticleListItem, ReaderMeta, WatermarkPayload } from "./types";

export type CoverSize = "original" | "thumb" | "medium";

export interface RangeChunk {
  status: 200 | 206;
  start: number;
  end: number; // inclusive
  total: number;
  bytes: Uint8Array;
}

function parseContentRange(h: string | null): { start: number; end: number; total: number } | null {
  // "bytes 0-1048575/5242880"
  const m = h?.match(/bytes\s+(\d+)-(\d+)\/(\d+|\*)/);
  if (!m) return null;
  return { start: Number(m[1]), end: Number(m[2]), total: m[3] === "*" ? NaN : Number(m[3]) };
}

async function errorFromResponse(res: Response): Promise<ApiError> {
  let code = `HTTP_${res.status}`;
  let message = res.statusText;
  let details: unknown;
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string; details?: unknown } };
    code = body.error?.code ?? code;
    message = body.error?.message ?? message;
    details = body.error?.details;
  } catch {
    /* body JSON emas */
  }
  return new ApiError(res.status, code, message, details);
}

const content = (articleId: string) => `/reader/articles/${articleId}/content`;

export const readerApi = {
  articles(bookId: string): Promise<ArticleListItem[]> {
    return api<ArticleListItem[]>(`/reader/books/${bookId}/articles`);
  },

  meta(articleId: string): Promise<ReaderMeta> {
    return api<ReaderMeta>(`/reader/articles/${articleId}`);
  },

  watermark(articleId: string): Promise<WatermarkPayload> {
    return api<WatermarkPayload>(`/reader/articles/${articleId}/watermark`);
  },

  /** Muqova — blob URL (chaqiruvchi URL.revokeObjectURL qilishi kerak). Ruxsat talab qiladi. */
  async coverUrl(bookId: string, size: CoverSize = "thumb", signal?: AbortSignal): Promise<string | null> {
    const res = await apiRaw(`/reader/books/${bookId}/cover`, { query: { size }, headers: { Accept: "image/*" }, signal });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  },

  /**
   * Bayt oralig'ini oladi: `Range: bytes=start-end` (end inclusive).
   * 206 → so'ralgan bo'lak (Content-Range bo'lmasa so'ralgan qiymatlar ishlatiladi);
   * 200 → server Range'ni qo'llamadi (butun fayl); 416 → RANGE_NOT_SATISFIABLE (ApiError).
   */
  async fetchRange(articleId: string, start: number, end: number, signal?: AbortSignal): Promise<RangeChunk> {
    const res = await apiRaw(content(articleId), { headers: { Range: `bytes=${start}-${end}`, Accept: "application/pdf, */*" }, signal });
    if (res.status === 206) {
      const cr = parseContentRange(res.headers.get("Content-Range"));
      const bytes = new Uint8Array(await res.arrayBuffer());
      return {
        status: 206,
        start: cr?.start ?? start,
        end: cr?.end ?? start + bytes.byteLength - 1,
        total: cr && Number.isFinite(cr.total) ? cr.total : NaN,
        bytes,
      };
    }
    if (res.status === 200) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      return { status: 200, start: 0, end: bytes.byteLength - 1, total: bytes.byteLength, bytes };
    }
    throw await errorFromResponse(res);
  },

  /**
   * Fayl hajmi va Range qo'llab-quvvatlanishi.
   *  1) `Range: bytes=0-0` → 206 + Content-Range → total;
   *  2) Content-Range bo'lmasa (B1) → ataylab yaroqsiz Range → 416 `details.size`;
   *  3) 200 → server Range'siz butun faylni berdi (head qaytariladi).
   */
  async size(articleId: string, signal?: AbortSignal): Promise<{ total: number; supportsRange: boolean; head?: Uint8Array }> {
    const res = await apiRaw(content(articleId), { headers: { Range: "bytes=0-0", Accept: "application/pdf, */*" }, signal });
    if (res.status === 206) {
      const cr = parseContentRange(res.headers.get("Content-Range"));
      await res.arrayBuffer();
      if (cr && Number.isFinite(cr.total)) return { total: cr.total, supportsRange: true };
      const total = await readerApi.sizeVia416(articleId, signal);
      if (total !== null) return { total, supportsRange: true };
      // hajm aniqlanmadi — butun faylni olish (oxirgi chora)
      const full = await apiRaw(content(articleId), { headers: { Accept: "application/pdf, */*" }, signal });
      if (!full.ok) throw await errorFromResponse(full);
      const buf = new Uint8Array(await full.arrayBuffer());
      return { total: buf.byteLength, supportsRange: false, head: buf };
    }
    if (res.status === 200) {
      const buf = new Uint8Array(await res.arrayBuffer());
      return { total: buf.byteLength, supportsRange: false, head: buf };
    }
    throw await errorFromResponse(res);
  },

  /** Backend 416 javobida `details.size` qaytaradi — Content-Range bo'lmaganda hajm manbai. */
  async sizeVia416(articleId: string, signal?: AbortSignal): Promise<number | null> {
    const res = await apiRaw(content(articleId), { headers: { Range: "bytes=9007199254740000-", Accept: "application/pdf, */*" }, signal });
    if (res.status !== 416) {
      await res.arrayBuffer().catch(() => undefined);
      return null;
    }
    const err = await errorFromResponse(res);
    const size = (err.details as { size?: unknown } | undefined)?.size;
    return typeof size === "number" && size > 0 ? size : null;
  },
};
