"use client";

/**
 * Kitob sahifasi (FE-3.3): kitob ma'lumoti `GET /library/{id}` (B12, ruxsat tekshiruvi bilan) +
 * maqolalar ro'yxati (`/reader/books/{id}/articles`), har birida holat, foiz, o'qilganlik;
 * "Davom ettirish" — oxirgi boshlangan maqola.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { Alert, Badge, Card, Spinner, buttonClass, cn, statusTone } from "@/components/ui";
import { clampPercent, errorMessage, isApiError, libraryApi, libraryCache, readerApi, type ArticleListItem } from "@/lib/api";
import { useT } from "@/i18n";

interface BookInfo {
  title: string;
  author: string | null;
  description: string | null;
  category_name: string | null;
  has_cover: boolean;
}

/** Davom ettiriladigan maqola: boshlangan-tugamagan → birinchi o'qilmagan → birinchi READY. */
export function pickContinue(items: ArticleListItem[]): ArticleListItem | null {
  const ready = items.filter((a) => a.processing_status === "READY");
  return ready.find((a) => a.current_page > 0 && !a.is_read) ?? ready.find((a) => !a.is_read) ?? ready[0] ?? null;
}

export function BookPage({ bookId }: { bookId: string }) {
  const { t } = useT();
  const [articles, setArticles] = useState<ArticleListItem[] | null>(null);
  const [info, setInfo] = useState<BookInfo | null>(() => libraryCache.get(bookId));
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    let alive = true;
    readerApi
      .articles(bookId)
      .then((a) => alive && setArticles(a))
      .catch((e: unknown) => alive && setError({ code: isApiError(e) ? e.code : "ERROR", message: errorMessage(e) }));
    // Kesh bo'lsa ham serverdan yangilanadi (nom/tavsif o'zgargan bo'lishi mumkin)
    libraryApi
      .get(bookId)
      .then((b) => {
        if (!alive) return;
        setInfo({ title: b.title, author: b.author, description: b.description, category_name: b.category_name, has_cover: b.has_cover });
        libraryCache.put(b);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [bookId]);

  const sorted = useMemo(() => (articles ?? []).slice().sort((a, b) => a.order_index - b.order_index), [articles]);
  const next = useMemo(() => pickContinue(sorted), [sorted]);
  const readCount = sorted.filter((a) => a.is_read).length;
  const overall = sorted.length ? sorted.reduce((s, a) => s + a.reading_percentage, 0) / sorted.length : 0;

  if (error) {
    const denied = error.code === "BOOK_ACCESS_DENIED";
    return (
      <div className="space-y-3">
        <Alert>{denied ? t("reader.accessDenied") : error.message}</Alert>
        <div className="flex gap-4">
          <Link href="/library" className="text-sm text-accent hover:underline">
            {t("common.backToLibrary")}
          </Link>
          {denied && (
            <Link href={`/catalog/${bookId}`} className="text-sm text-accent hover:underline">
              {t("book.viewInCatalog")}
            </Link>
          )}
        </div>
      </div>
    );
  }
  if (!articles) {
    return (
      <div className="flex justify-center py-16 text-muted">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/library" className="text-sm text-accent hover:underline">
        ← {t("nav.library")}
      </Link>
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <BookCover bookId={bookId} title={info?.title ?? ""} hasCover={info?.has_cover ?? true} size="medium" className="max-w-[200px]" />
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text">{info?.title ?? t("book.untitled")}</h1>
            {info?.author && <p className="mt-1 text-muted">{info.author}</p>}
            {info?.category_name && (
              <div className="mt-2">
                <Badge>{info.category_name}</Badge>
              </div>
            )}
          </div>
          {info?.description && <p className="whitespace-pre-wrap text-sm text-text">{info.description}</p>}
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>{t("library.articlesRead", { read: readCount, total: sorted.length })}</span>
              <span>{clampPercent(overall)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
              <div className="h-full rounded-full bg-accent" style={{ width: `${clampPercent(overall)}%` }} />
            </div>
          </div>
          {next && (
            <Link href={`/reader/${next.article_id}`} className={buttonClass()}>
              {next.current_page > 0 ? t("book.continue") : t("book.startReading")}: {next.title}
            </Link>
          )}
        </div>
      </div>

      <Card className="divide-y divide-border">
        <div className="px-4 py-3">
          <h2 className="text-base font-semibold text-text">
            {t("book.articles")} ({sorted.length})
          </h2>
        </div>
        {sorted.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">{t("book.noArticles")}</p>
        ) : (
          sorted.map((a, i) => {
            const ready = a.processing_status === "READY";
            const pct = clampPercent(a.reading_percentage);
            const row = (
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="w-6 shrink-0 text-right text-xs text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-medium", ready ? "text-text" : "text-muted")}>{a.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {a.page_count ? t("common.pagesN", { n: a.page_count }) : ""}
                    {ready && a.current_page > 0 && !a.is_read ? ` · ${t("common.pageN", { n: a.current_page })} · ${pct}%` : ""}
                  </p>
                  {ready && pct > 0 && (
                    <div className="mt-1.5 h-1 w-full max-w-xs overflow-hidden rounded-full bg-bg">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
                {a.is_read ? (
                  <Badge tone="success">✓ {t("book.read")}</Badge>
                ) : !ready ? (
                  <Badge tone={statusTone(a.processing_status)}>{a.processing_status === "FAILED" ? t("book.failed") : t("book.notReady")}</Badge>
                ) : null}
              </div>
            );
            return ready ? (
              <Link key={a.article_id} href={`/reader/${a.article_id}`} className="block hover:bg-bg/60">
                {row}
              </Link>
            ) : (
              <div key={a.article_id}>{row}</div>
            );
          })
        )}
      </Card>
    </div>
  );
}
