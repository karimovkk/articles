import { api } from "./client";
import type { LibraryItem, Paginated } from "./types";

/** `recent` — oxirgi o'qilgan bo'yicha (backend 2026-09-21, B11). */
export type LibrarySort = "granted" | "title" | "recent";

export interface LibraryQuery {
  search?: string;
  category_id?: string;
  sort?: LibrarySort;
  page?: number;
  page_size?: number;
}

/** GET /library — ruxsat berilgan kitoblar (kitob darajasida; maqolalar alohida). */
export const libraryApi = {
  list(q: LibraryQuery = {}): Promise<Paginated<LibraryItem>> {
    return api<Paginated<LibraryItem>>("/library", { query: { page: 1, page_size: 24, ...q } });
  },
  /** Bitta kitob (ruxsat tekshiruvi bilan; ruxsatsiz → 403 BOOK_ACCESS_DENIED) — B12. */
  get(bookId: string): Promise<LibraryItem> {
    return api<LibraryItem>(`/library/${bookId}`);
  },
};

/** 0–100 oralig'ida butun foiz. */
export function clampPercent(p?: number | null): number {
  if (typeof p !== "number" || !Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(100, Math.round(p)));
}
