/**
 * Buyurtmalar (PM S-16): yaratish → to'lov → admin tasdiqlaydi → ruxsat. 56: to'lov faqat Telegram bot orqali —
 * sayt `telegram-link` bilan botga yo'naltiradi (karta, chek, tasdiq — botda), holatni `GET /orders/{id}` bilan kuzatadi.
 */
import { api } from "./client";
import type { Order, OrderQuote, PricingConfig } from "./types";

/** 56: botda to'lovni boshlash havolasi (`deep_link` bo'sh — bot sozlanmagan) */
export interface TelegramLink {
  deep_link: string | null;
  token: string;
  bot_username: string | null;
}

export const ordersApi = {
  mine(): Promise<Order[]> {
    return api<Order[]>("/orders");
  },
  /** Bitta buyurtma (yengil — holatni kuzatish uchun) */
  get(orderId: string): Promise<Order> {
    return api<Order>(`/orders/${orderId}`);
  },
  /** Ochiq buyurtma (PENDING/AWAITING_REVIEW) bo'lsa 409 `ORDER_ALREADY_PENDING`, `details.order_id` bilan */
  create(bookId: string): Promise<Order> {
    return api<Order>("/orders", { method: "POST", body: { book_id: bookId } });
  },
  /**
   * 56: "To'lash" — botda to'lovni boshlash uchun deep-link (bot foydalanuvchi va buyurtmani o'zi taniydi). Faqat ochiq
   * buyurtma (PENDING/AWAITING_REVIEW), aks holda 409 `INVALID_ORDER_STATE`; begona — 404.
   */
  telegramLink(orderId: string): Promise<TelegramLink> {
    return api<TelegramLink>(`/orders/${orderId}/telegram-link`, { method: "POST" });
  },
  /** Ochiq buyurtmani bekor qilish → CANCELLED (ochiq bo'lmasa 409) */
  cancel(orderId: string): Promise<Order> {
    return api<Order>(`/orders/${orderId}/cancel`, { method: "POST" });
  },
  /** 35: savatcha narxi (server hisobi) — `book_ids` tartibi saqlanadi */
  quote(bookIds: string[]): Promise<OrderQuote> {
    return api<OrderQuote>("/orders/quote", { method: "POST", body: { book_ids: bookIds } });
  },
  /**
   * 35: savatchadan bitta buyurtma (chegirma bilan). Xatolar: 409 `ALREADY_HAS_ACCESS` / `ORDER_ALREADY_PENDING`
   * (`details.book_ids`), 422 `CART_EMPTY` / `CART_TOO_LARGE`.
   */
  checkout(bookIds: string[]): Promise<Order> {
    return api<Order>("/orders/checkout", { method: "POST", body: { book_ids: bookIds } });
  },
};

/**
 * 35: chegirma pog'onalari (public). Backend hali qo'llamasa (404) yoki tarmoq xatosi — `null`: savatcha umuman
 * ko'rsatilmaydi va eski "Sotib olish" oqimi ishlaydi (noto'g'ri narx ko'rsatilmasin).
 */
export const pricingApi = {
  async get(): Promise<PricingConfig | null> {
    try {
      const cfg = await api<PricingConfig>("/pricing", { auth: false });
      return Array.isArray(cfg?.tiers) ? cfg : null;
    } catch {
      return null;
    }
  },
};

/** 35: buyurtmadagi kitoblar — ko'p kitobli (`items`) yoki eski bitta kitobli (`book_id`) */
export function orderBookIds(o: Pick<Order, "book_id" | "items">): string[] {
  return o.items?.length ? o.items.map((i) => i.book_id) : [o.book_id];
}
