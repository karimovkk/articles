"use client";

/**
 * Katalogda "Kutubxonada" belgisi uchun foydalanuvchining kitob id'lari.
 * 26.4 tezlik: har katalog ochilganda `GET /library?page_size=100` yuborilmasin — javob qisqa muddatga
 * sessiya keshida saqlanadi (sotib olish/kirish-chiqishda `clearOwnedBooks()` bilan tozalanadi).
 */
import { libraryApi } from "@/lib/api";
import { sessionGet, sessionSet } from "@/lib/session-cache";

const KEY = "a365.owned";
const TTL = 60 * 1000;

export async function loadOwnedBookIds(): Promise<Set<string>> {
  const cached = sessionGet<string[]>(KEY, TTL);
  if (cached) return new Set(cached);
  const r = await libraryApi.list({ page_size: 100 });
  const ids = r.items.map((i) => i.book_id);
  sessionSet(KEY, ids);
  return new Set(ids);
}

export function clearOwnedBooks(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* kesh yo'q — muammo emas */
  }
}
