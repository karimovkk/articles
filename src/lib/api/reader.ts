/**
 * Reader (himoyalangan kontent) — STORAGE.md / API.md:
 *  GET /reader/{id}            → metadata
 *  GET /reader/{id}/content    → Range (200/206/416), Content-Range, Accept-Ranges
 *  GET /reader/{id}/cover      → muqova (blob)
 *  GET /reader/{id}/watermark  → HMAC-imzolangan watermark payload
 *
 * Kitob fayliga doimiy URL yo'q: barcha baytlar Bearer + access tekshiruvi bilan keladi.
 */
import { api, apiRaw, ApiError } from "./client";
import type { ReaderMeta, WatermarkPayload } from "./types";

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

async function throwFromResponse(res: Response): Promise<never> {
  let code = `HTTP_${res.status}`;
  let message = res.statusText;
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    code = body.error?.code ?? code;
    message = body.error?.message ?? message;
  } catch {
    /* body JSON emas */
  }
  throw new ApiError(res.status, code, message);
}

export const readerApi = {
  meta(bookId: string): Promise<ReaderMeta> {
    return api<ReaderMeta>(`/reader/${bookId}`);
  },

  watermark(bookId: string): Promise<WatermarkPayload> {
    return api<WatermarkPayload>(`/reader/${bookId}/watermark`);
  },

  /** Muqova — blob URL (chaqiruvchi URL.revokeObjectURL qilishi kerak). */
  async coverUrl(bookId: string, signal?: AbortSignal): Promise<string | null> {
    const res = await apiRaw(`/reader/${bookId}/cover`, { headers: { Accept: "image/*" }, signal });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  },

  /**
   * Bayt oralig'ini oladi: `Range: bytes=start-end` (end inclusive).
   * 206 → so'ralgan bo'lak; 200 → server Range'ni qo'llamadi (butun fayl);
   * 416 → RANGE_NOT_SATISFIABLE (ApiError).
   */
  async fetchRange(bookId: string, start: number, end: number, signal?: AbortSignal): Promise<RangeChunk> {
    const res = await apiRaw(`/reader/${bookId}/content`, {
      headers: { Range: `bytes=${start}-${end}`, Accept: "application/pdf, */*" },
      signal,
    });
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
    return throwFromResponse(res);
  },

  /** Fayl hajmi (HEAD o'rniga 0-0 Range → Content-Range'dan total). */
  async size(bookId: string, signal?: AbortSignal): Promise<{ total: number; supportsRange: boolean; head?: Uint8Array }> {
    const res = await apiRaw(`/reader/${bookId}/content`, {
      headers: { Range: "bytes=0-0", Accept: "application/pdf, */*" },
      signal,
    });
    if (res.status === 206) {
      const cr = parseContentRange(res.headers.get("Content-Range"));
      await res.arrayBuffer();
      if (cr && Number.isFinite(cr.total)) return { total: cr.total, supportsRange: true };
    }
    if (res.status === 200) {
      const buf = new Uint8Array(await res.arrayBuffer());
      return { total: buf.byteLength, supportsRange: false, head: buf };
    }
    return throwFromResponse(res);
  },
};
