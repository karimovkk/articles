"use client";

/**
 * 78: chap pastki karta — "Buy Real Books": Uzum Market'dagi do'konimizga (yangi oynada) olib boradi. Rasm o'rniga
 * kitoblarimiz muqovalari 3D halqada aylanib turadi (katalogdan, avval muqovali pullik kitoblar; reduced-motion —
 * harakatsiz). Muqovalar bir marta yuklanadi (sahifalar orasida qayta so'ralmaydi).
 */
import { useEffect, useState } from "react";
import { BookCover } from "@/components/book-cover";
import * as I from "@/components/ui/icons";
import { catalogApi, type CatalogItem } from "@/lib/api";
import { useShopUrl } from "@/providers/appearance-provider";
import { useT } from "@/i18n";

const RING = 8;
type Cover = Pick<CatalogItem, "book_id" | "title" | "has_cover">;

let coversPromise: Promise<Cover[]> | null = null;
function loadCovers(): Promise<Cover[]> {
  coversPromise ??= catalogApi
    .list({ page_size: 24 })
    .then((r) => {
      const items = r.items.map(({ book_id, title, has_cover }) => ({ book_id, title, has_cover }));
      // Muqovalilari oldinda; halqa to'lishi uchun kerak bo'lsa takrorlanadi
      const sorted = [...items.filter((b) => b.has_cover), ...items.filter((b) => !b.has_cover)];
      if (!sorted.length) return [];
      return Array.from({ length: RING }, (_, i) => sorted[i % sorted.length]);
    })
    .catch(() => {
      coversPromise = null; // tarmoq xatosi — keyingi safar qayta urinadi
      return [];
    });
  return coversPromise;
}

export function BuyRealBooks({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useT();
  const { url } = useShopUrl();
  const [covers, setCovers] = useState<Cover[] | null>(null);
  useEffect(() => {
    let off = false;
    void loadCovers().then((c) => !off && setCovers(c));
    return () => {
      off = true;
    };
  }, []);

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className="buy-books" aria-label={`${t("client.buyBooksTitle")} — ${t("client.buyBooksSub")}`} data-testid="buy-books">
      <span className="bb-stage" aria-hidden>
        <span className="bb-ring" style={{ ["--n" as string]: RING }} data-testid="buy-books-ring">
          {Array.from({ length: RING }, (_, i) => {
            const c = covers?.[i];
            return (
              <span key={i} className="bb-item" style={{ ["--i" as string]: i }} data-testid="buy-books-cover">
                {c ? <BookCover bookId={c.book_id} title={c.title} hasCover={c.has_cover} source="catalog" className="bb-cover" /> : <span className="bb-cover bb-ph" />}
              </span>
            );
          })}
        </span>
      </span>
      <span className="bb-title">{t("client.buyBooksTitle")}</span>
      <span className="bb-sub">{t("client.buyBooksSub")}</span>
      <span className="bb-uzum">
        <span className="bb-uzum-dot" aria-hidden />
        Uzum Market
        <I.ArrowUpRight size={14} />
      </span>
    </a>
  );
}
