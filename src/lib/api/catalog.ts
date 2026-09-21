/**
 * Public katalog (FE-2, S-7): GET /catalog — auth YO'Q, rate-limit bor.
 * Kontent baribir himoyalangan — bu faqat sotuv ro'yxati.
 * `GET /catalog/{id}` hozircha yo'q (backend'dan so'ralgan): batafsil sahifa uchun
 * ro'yxatdan sessionStorage kesh → sahifalab qidirish.
 */
import { api } from "./client";
import type { CatalogItem, Paginated } from "./types";

export interface CatalogQuery {
  search?: string;
  category_id?: string;
  page?: number;
  page_size?: number;
}

const CACHE_PREFIX = "a365.catalog.";
const SCAN_PAGE_SIZE = 100;
const SCAN_MAX_PAGES = 10;

export const catalogCache = {
  put(item: CatalogItem) {
    try {
      window.sessionStorage.setItem(CACHE_PREFIX + item.book_id, JSON.stringify(item));
    } catch {
      /* sessionStorage yo'q */
    }
  },
  get(bookId: string): CatalogItem | null {
    try {
      const raw = window.sessionStorage.getItem(CACHE_PREFIX + bookId);
      return raw ? (JSON.parse(raw) as CatalogItem) : null;
    } catch {
      return null;
    }
  },
};

export const catalogApi = {
  list(q: CatalogQuery = {}): Promise<Paginated<CatalogItem>> {
    return api<Paginated<CatalogItem>>("/catalog", { auth: false, query: { page: 1, page_size: 24, ...q } });
  },

  /** Bitta kitob: kesh, bo'lmasa ro'yxatni sahifalab qidirish (katalog kichik). */
  async find(bookId: string, signal?: AbortSignal): Promise<CatalogItem | null> {
    const cached = catalogCache.get(bookId);
    if (cached) return cached;
    for (let page = 1; page <= SCAN_MAX_PAGES; page++) {
      const res = await api<Paginated<CatalogItem>>("/catalog", { auth: false, query: { page, page_size: SCAN_PAGE_SIZE }, signal });
      const hit = res.items.find((i) => i.book_id === bookId);
      if (hit) {
        catalogCache.put(hit);
        return hit;
      }
      if (page >= res.pages) break;
    }
    return null;
  },
};
