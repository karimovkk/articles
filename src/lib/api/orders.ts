/** Buyurtmalar (PM S-16): yaratish → to'lov → chek yuborish → admin tasdiqlaydi → ruxsat. */
import { api } from "./client";
import type { Order } from "./types";

export const ordersApi = {
  mine(): Promise<Order[]> {
    return api<Order[]>("/orders");
  },
  create(bookId: string): Promise<Order> {
    return api<Order>("/orders", { method: "POST", body: { book_id: bookId } });
  },
  /** "To'ladim" — adminlarga Telegram xabari ketadi; holat AWAITING_REVIEW */
  submitReceipt(orderId: string, note?: string): Promise<Order> {
    return api<Order>(`/orders/${orderId}/receipt`, { method: "POST", body: { receipt_note: note || null } });
  },
};
