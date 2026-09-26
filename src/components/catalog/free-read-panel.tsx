"use client";

/**
 * 37: tekin kitob — "Bepul o'qing": maqolalar ro'yxati va "O'qishni boshlash" (mehmon ham). Maqolalar ro'yxati
 * `GET /reader/books/{id}/articles` — backend tekin kitoblarda uni kirishsiz ochadi (BACKEND_TASKS.md 4-qism).
 * Backend hali qo'llamasa: mehmon — "O'qish uchun tizimga kiring", kirgan foydalanuvchi — `fallback` (buyurtma paneli).
 */
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Spinner, buttonClass } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { readerApi, type ArticleListItem } from "@/lib/api";
import { useT } from "@/i18n";

export function FreeReadPanel({ bookId, guest, fallback }: { bookId: string; guest: boolean; fallback: ReactNode }) {
  const { t } = useT();
  const [articles, setArticles] = useState<ArticleListItem[] | null | undefined>(undefined); // null — ochilmadi

  useEffect(() => {
    let alive = true;
    readerApi
      .articles(bookId)
      .then((list) => alive && setArticles(list.filter((a) => a.processing_status === "READY").sort((a, b) => a.order_index - b.order_index)))
      .catch(() => alive && setArticles(null));
    return () => {
      alive = false;
    };
  }, [bookId]);

  if (articles === undefined) return <Spinner />;
  if (articles === null && !guest) return <>{fallback}</>;

  return (
    <div className="free-read" data-testid="free-read">
      <p className="free-read-title">
        <I.Sparkles size={16} />
        {t("catalog.freeTitle")}
      </p>
      <p className="text-sm text-text-2">{guest ? t("catalog.freeDesc") : t("catalog.freeDescUser")}</p>
      {articles === null ? (
        <Link href={`/login?next=${encodeURIComponent(`/catalog/${bookId}`)}`} className={buttonClass("primary")} data-testid="free-login">
          {t("catalog.freeLogin")}
        </Link>
      ) : articles.length > 0 ? (
        <>
          <Link href={`/reader/${articles[0].article_id}`} className={buttonClass("primary")} data-testid="free-start">
            <I.BookOpen size={16} />
            {t("catalog.startReading")}
          </Link>
          {articles.length > 1 && (
            <ol className="free-read-list">
              {articles.map((a, i) => (
                <li key={a.article_id}>
                  <Link href={`/reader/${a.article_id}`} className="free-read-item">
                    <span className="free-read-num">{i + 1}</span>
                    <span className="user-text">{a.title}</span>
                    {a.page_count ? <span className="free-read-pages">{t("common.pagesN", { n: a.page_count })}</span> : null}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <p className="text-sm text-muted" data-testid="free-no-articles">
          {t("catalog.freeNoArticles")}
        </p>
      )}
    </div>
  );
}
