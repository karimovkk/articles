/**
 * Public katalog (FE-2, S-7) — auth YO'Q, rate-limit bor:
 *  GET /catalog, GET /catalog/{book_id}, GET /catalog/{book_id}/cover?size=, GET /categories
 * Kontent baribir himoyalangan — bu faqat sotuv ro'yxati.
 */
import { api, apiRaw, isApiError } from "./client";
import type { CatalogItem, Category, Paginated } from "./types";
import type { CoverSize } from "./reader";

export interface CatalogQuery {
  search?: string;
  category_id?: string;
  page?: number;
  page_size?: number;
}

export const catalogApi = {
  list(q: CatalogQuery = {}): Promise<Paginated<CatalogItem>> {
    return api<Paginated<CatalogItem>>("/catalog", { auth: false, query: { page: 1, page_size: 24, ...q } });
  },

  /** Bitta kitob; topilmasa (404) yoki nofaol bo'lsa null. */
  async find(bookId: string, signal?: AbortSignal): Promise<CatalogItem | null> {
    try {
      return await api<CatalogItem>(`/catalog/${bookId}`, { auth: false, signal });
    } catch (e) {
      if (isApiError(e) && e.status === 404) return null;
      throw e;
    }
  },

  /** Faol kategoriyalar (public) — katalog filtri uchun. */
  categories(): Promise<Category[]> {
    return api<Category[]>("/categories", { auth: false });
  },

  /** Public muqova — blob URL (chaqiruvchi URL.revokeObjectURL qilishi kerak). */
  async coverUrl(bookId: string, size: CoverSize = "thumb", signal?: AbortSignal): Promise<string | null> {
    const res = await apiRaw(`/catalog/${bookId}/cover`, { auth: false, query: { size }, headers: { Accept: "image/*" }, signal });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  },
};
