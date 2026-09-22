/** Buyurtmalar (PM S-16): yaratish → to'lov → chek yuborish → admin tasdiqlaydi → ruxsat. */
import { api, apiUpload, type UploadOptions } from "./client";
import type { Order } from "./types";

export const ordersApi = {
  mine(): Promise<Order[]> {
    return api<Order[]>("/orders");
  },
  create(bookId: string): Promise<Order> {
    return api<Order>("/orders", { method: "POST", body: { book_id: bookId } });
  },
  /**
   * "To'ladim" — chek **rasmi** (tavsiya) va ixtiyoriy izoh, `multipart/form-data` (buyurtma oqimi v1.0).
   * Adminlar chatiga rasm + izoh ketadi; holat AWAITING_REVIEW. Rasmsiz (faqat izoh) ham qabul qilinadi.
   * `Content-Type` qo'lda qo'yilmaydi — boundary'ni brauzer qo'yadi (XHR, yuklash progressi bilan).
   */
  submitReceipt(orderId: string, input: { file?: File | null; note?: string }, opts?: UploadOptions): Promise<Order> {
    const fd = new FormData();
    if (input.file) fd.append("file", input.file);
    const note = input.note?.trim();
    if (note) fd.append("receipt_note", note);
    return apiUpload<Order>(`/orders/${orderId}/receipt`, fd, opts);
  },
};
