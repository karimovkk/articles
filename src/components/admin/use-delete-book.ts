"use client";

/**
 * 97 → 99: kitobni o'chirish oqimi (kitob sahifasi va kitoblar ro'yxati uchun umumiy): tasdiq → DELETE.
 * Buyurtmalar va o'quvchi ma'lumotlari backend'da saqlanadi (kitobdan uziladi) — 409 / `force` endi yo'q.
 * Natija — o'chirilgan va saqlangan yozuvlar soni; bekor qilinsa — null; xato — `error`.
 */
import { useState } from "react";
import { useConfirm } from "@/components/ui";
import { adminApi, errorMessage, type BookDeleteResult } from "@/lib/api";
import { useT } from "@/i18n";

/** Natija xabari uchun (`/admin/books?deleted=…`): saqlangan yozuvlar — qisqa kalitlar bilan */
export const KEPT_PARAMS = { o: "orders_detached", n: "annotations_detached", p: "progress_detached", q: "quiz_attempts_detached", v: "vocabulary_detached" } as const;

export function deletedUrl(title: string, res: BookDeleteResult): string {
  const sp = new URLSearchParams({ deleted: title, a: String(res.articles_deleted ?? 0) });
  for (const [k, f] of Object.entries(KEPT_PARAMS)) if (Number(res[f]) > 0) sp.set(k, String(res[f]));
  return `/admin/books?${sp}`;
}

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
      return await adminApi.deleteBook(book.id);
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setBusyId(null);
    }
  }
  return { remove, busyId, error };
}
