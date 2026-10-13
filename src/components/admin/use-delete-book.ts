"use client";

/**
 * 97: kitobni butunlay o'chirish oqimi (kitob sahifasi va kitoblar ro'yxati uchun umumiy): tasdiq → DELETE;
 * buyurtmali kitob (409 `BOOK_HAS_ORDERS`) — ikkinchi tasdiq (buyurtmalar soni) → `force=true`.
 * Natija — o'chirilganlar soni; bekor qilinsa — null; xato — `error`.
 */
import { useState } from "react";
import { useConfirm } from "@/components/ui";
import { adminApi, errorMessage, isApiError } from "@/lib/api";
import { useT } from "@/i18n";

export function useDeleteBook() {
  const { t } = useT();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(book: { id: string; title: string }) {
    if (!(await confirm({ title: t("admin.books.deleteTitle"), message: t("admin.books.deleteBody", { title: book.title }), confirmLabel: t("admin.books.deleteConfirm"), tone: "danger" }))) return null;
    setBusyId(book.id);
    setError(null);
    try {
      try {
        return await adminApi.deleteBook(book.id);
      } catch (e) {
        if (!(isApiError(e) && e.code === "BOOK_HAS_ORDERS")) throw e;
        const n = Number((e.details as { order_count?: number } | null)?.order_count) || 0;
        if (!(await confirm({ title: t("admin.books.deleteOrdersTitle"), message: t("admin.books.deleteOrdersBody", { n }), confirmLabel: t("admin.books.deleteForce"), tone: "danger" }))) return null;
        return await adminApi.deleteBook(book.id, true);
      }
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setBusyId(null);
    }
  }
  return { remove, busyId, error };
}
