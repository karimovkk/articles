/** Kutubxona kartasidan kitob sahifasiga o'tishda kitob ma'lumotini uzatish (alohida `GET /library/{id}` yo'q — B12). */
import type { LibraryItem } from "./types";

const PREFIX = "a365.lib.";

export const libraryCache = {
  put(item: LibraryItem) {
    try {
      window.sessionStorage.setItem(PREFIX + item.book_id, JSON.stringify(item));
    } catch {
      /* sessionStorage yo'q */
    }
  },
  get(bookId: string): LibraryItem | null {
    try {
      const raw = window.sessionStorage.getItem(PREFIX + bookId);
      return raw ? (JSON.parse(raw) as LibraryItem) : null;
    } catch {
      return null;
    }
  },
};
