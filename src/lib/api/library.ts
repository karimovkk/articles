import { api } from "./client";
import type { Book, LibraryItem, Paginated, ReadingProgress } from "./types";

export type LibrarySort = "granted" | "title" | "recent";

export interface LibraryQuery {
  search?: string;
  category_id?: string;
  sort?: LibrarySort;
  page?: number;
  page_size?: number;
}

/** Backend elementni `book` ichida yoki tekis qaytarishi mumkin — ikkalasini ham qo'llab-quvvatlaymiz. */
export function normalizeLibraryItem(raw: unknown): LibraryItem {
  const r = raw as Record<string, unknown>;
  const book = (r.book as Book | undefined) ?? (r as unknown as Book);
  const bookId = (r.book_id as string | undefined) ?? book.id;
  return {
    id: String(r.id ?? bookId),
    book: { ...book, id: bookId },
    progress: (r.progress as ReadingProgress | null | undefined) ?? null,
    granted_at: (r.granted_at as string | null | undefined) ?? null,
    access_status: r.access_status as string | undefined,
  };
}

export const libraryApi = {
  async list(q: LibraryQuery = {}): Promise<Paginated<LibraryItem>> {
    const res = await api<Paginated<unknown>>("/library", { query: { page: 1, page_size: 24, ...q } });
    return { ...res, items: (res.items ?? []).map(normalizeLibraryItem) };
  },
};

/** Foiz: backend bergan bo'lsa shu, aks holda sahifadan hisoblanadi. */
export function progressPercent(p?: ReadingProgress | null, pageCount?: number | null): number {
  if (!p) return 0;
  if (typeof p.percent === "number") return Math.max(0, Math.min(100, Math.round(p.percent)));
  const total = p.total_pages ?? pageCount ?? 0;
  if (!total || !p.current_page) return 0;
  return Math.max(0, Math.min(100, Math.round((p.current_page / total) * 100)));
}
