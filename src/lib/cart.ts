"use client";

/**
 * 35: savatcha — brauzerda (localStorage), tablar orasida sinxron (`storage` hodisasi). Mehmon ham qo'sha oladi;
 * buyurtma berish uchun kirish kerak. Chiqishda tozalanadi (boshqa foydalanuvchi). Server savatchasi — keyingi
 * bosqich (BACKEND_TASKS.md §2.8), shunda qurilmalar orasida ham sinxron bo'ladi.
 */
import { useSyncExternalStore } from "react";

export interface CartItem {
  book_id: string;
  title: string;
  author: string | null;
  /** Kitobning asl narxi (katalogdan), masalan "49000.00" */
  price: string;
  has_cover: boolean;
  added_at: string;
}

const KEY = "a365.cart";
export const CART_MAX = 20;
export const CART_EVENT = "a365:cart-changed";

let items: CartItem[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const EMPTY: CartItem[] = [];

function read(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as CartItem[]) : [];
    return Array.isArray(v) ? v.filter((x) => x && typeof x.book_id === "string") : [];
  } catch {
    return [];
  }
}

function ensure() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  items = read();
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    items = read();
    listeners.forEach((l) => l());
  });
}

function write(next: CartItem[]) {
  items = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* saqlab bo'lmadi — joriy sahifada baribir ishlaydi */
  }
  listeners.forEach((l) => l());
  window.dispatchEvent(new Event(CART_EVENT));
}

function subscribe(l: () => void) {
  ensure();
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export const cart = {
  items(): CartItem[] {
    ensure();
    return items;
  },
  has(bookId: string) {
    ensure();
    return items.some((i) => i.book_id === bookId);
  },
  /** `false` — savatcha to'lgan (CART_MAX) */
  add(item: Omit<CartItem, "added_at">): boolean {
    ensure();
    if (items.some((i) => i.book_id === item.book_id)) return true;
    if (items.length >= CART_MAX) return false;
    write([...items, { ...item, added_at: new Date().toISOString() }]);
    return true;
  },
  remove(bookId: string) {
    ensure();
    write(items.filter((i) => i.book_id !== bookId));
  },
  removeMany(bookIds: string[]) {
    ensure();
    const set = new Set(bookIds);
    write(items.filter((i) => !set.has(i.book_id)));
  },
  clear() {
    ensure();
    if (items.length) write([]);
  },
};

/** Savatchadagi kitoblar (hidratatsiyada — bo'sh; keyin localStorage'dan) */
export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribe, cart.items, () => EMPTY);
}
