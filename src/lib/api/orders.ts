/** Buyurtmalar (PM S-16): yaratish → to'lov → chek yuborish → admin tasdiqlaydi → ruxsat. */
import { api, apiUpload, type UploadOptions } from "./client";
import type { Order, OrderQuote, PaymentInfo, PricingConfig } from "./types";

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
   * "To'ladim" — chek **rasmi yoki PDF** (tavsiya) va ixtiyoriy izoh, `multipart/form-data` (buyurtma oqimi v1.0).
   * Adminlar chatiga fayl + izoh ketadi; holat AWAITING_REVIEW. Rasmsiz (faqat izoh) ham qabul qilinadi.
   * PENDING va AWAITING_REVIEW'da yuboriladi (qayta yuborish = almashtirish), boshqasida 409 `INVALID_ORDER_STATE`.
   * `Content-Type` qo'lda qo'yilmaydi — boundary'ni brauzer qo'yadi (XHR, yuklash progressi bilan).
   */
  submitReceipt(orderId: string, input: { file?: File | null; note?: string }, opts?: UploadOptions): Promise<Order> {
    const fd = new FormData();
    if (input.file) fd.append("file", input.file);
    const note = input.note?.trim();
    if (note) fd.append("receipt_note", note);
    return apiUpload<Order>(`/orders/${orderId}/receipt`, fd, opts);
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
  /** To'lov rekvizitlari (karta, qabul qiluvchi, ko'rsatma) */
  paymentInfo(): Promise<PaymentInfo> {
    return api<PaymentInfo>("/payment-info");
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
