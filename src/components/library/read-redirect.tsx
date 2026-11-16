"use client";

/**
 * Kartadagi "O'qish" tugmasi: kitob sahifasini (tavsif) ko'rsatmasdan to'g'ridan-to'g'ri reader'ga o'tadi —
 * boshlangan maqola bo'lsa o'sha (reader saqlangan sahifadan ochadi), bo'lmasa birinchi o'qilmagani (`pickContinue`).
 * Maqolalar ochilmasa (kirish yo'q, mehmon, xato) yoki tayyor maqola bo'lmasa — `fallback` (kitob tavsifi sahifasi).
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";
import { readerApi } from "@/lib/api";
import { pickContinue } from "./book-page";

export function ReadRedirect({ bookId, fallback }: { bookId: string; fallback: string }) {
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    readerApi
      .articles(bookId)
      .then((items) => {
        if (!alive) return;
        const next = pickContinue(items.slice().sort((a, b) => a.order_index - b.order_index));
        router.replace(next ? `/reader/${next.article_id}` : fallback);
      })
      .catch(() => alive && router.replace(fallback));
    return () => {
      alive = false;
    };
  }, [bookId, fallback, router]);

  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center text-muted" data-testid="read-redirect">
      <Spinner />
    </div>
  );
}
