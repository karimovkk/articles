"use client";

/**
 * Kitob sahifasi (FE-3.3): kitob ma'lumoti `GET /library/{id}` (B12, ruxsat tekshiruvi bilan) +
 * maqolalar ro'yxati (`/reader/books/{id}/articles`) "playlist" ko'rinishida: raqam, holat, foiz, o'qilganlik;
 * "Davom ettirish" — oxirgi boshlangan maqola.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { Badge, Card, EmptyState, Spinner, buttonClass, cn, statusTone } from "@/components/ui";
import * as I from "@/components/ui/icons";
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
  const totalPages = sorted.reduce((s, a) => s + (a.page_count ?? 0), 0);

  if (error) {
    const denied = error.code === "BOOK_ACCESS_DENIED";
    return (
      <EmptyState
        icon={<I.Lock size={22} />}
        title={denied ? t("reader.accessDenied") : t("common.errorTitle")}
        description={denied ? undefined : error.message}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/library" className={buttonClass("secondary")}>
              <I.ArrowLeft size={16} />
              {t("common.backToLibrary")}
            </Link>
            {denied && (
              <Link href={`/catalog/${bookId}`} className={buttonClass("primary")}>
                {t("book.viewInCatalog")}
                <I.ArrowRight size={16} />
              </Link>
            )}
          </div>
        }
      />
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
    <div className="space-y-5">
      <nav className="crumbs" aria-label="breadcrumb">
        <Link href="/library">{t("nav.library")}</Link>
        <I.ChevronRight size={14} />
        <span className="current">{info?.title ?? t("book.untitled")}</span>
      </nav>

      <div className="book-hero" data-testid="book-hero">
        <BookCover bookId={bookId} title={info?.title ?? ""} hasCover={info?.has_cover ?? true} size="medium" />
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {info?.category_name && <Badge>{info.category_name}</Badge>}
            {readCount === sorted.length && sorted.length > 0 && (
              <Badge tone="success" dot>
                {t("book.read")}
              </Badge>
            )}
          </div>
          <div>
            <h1 className="book-hero-title">{info?.title ?? t("book.untitled")}</h1>
            {info?.author && <p className="mt-1 text-[15px] font-semibold text-muted">{info.author}</p>}
          </div>
          {info?.description && <p className="max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-text-2">{info.description}</p>}

          <div className="mt-auto grid gap-3 sm:grid-cols-3" data-testid="book-stats">
            <div className="rounded-[14px] bg-surface-2 px-4 py-3">
              <div className="stat-label">{t("book.articles")}</div>
              <div className="mt-1 font-display text-xl font-semibold tabular-nums">{sorted.length}</div>
            </div>
            <div className="rounded-[14px] bg-surface-2 px-4 py-3">
              <div className="stat-label">{t("admin.books.pages")}</div>
              <div className="mt-1 font-display text-xl font-semibold tabular-nums">{totalPages || "—"}</div>
            </div>
            <div className="rounded-[14px] bg-surface-2 px-4 py-3">
              <div className="stat-label">{t("book.progress")}</div>
              <div className="mt-1 font-display text-xl font-semibold tabular-nums">{clampPercent(overall)}%</div>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex justify-between text-xs font-bold text-muted">
              <span>{t("library.articlesRead", { read: readCount, total: sorted.length })}</span>
              <span className="tabular-nums">{clampPercent(overall)}%</span>
            </div>
            <div className="progress">
              <i style={{ width: `${clampPercent(overall)}%` }} />
            </div>
          </div>

          {next && (
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <Link href={`/reader/${next.article_id}`} className={buttonClass("primary", "lg")} data-testid="continue-reading">
                <I.Play size={15} />
                {next.current_page > 0 ? t("book.continue") : t("book.startReading")}: {next.title}
              </Link>
            </div>
          )}
        </div>
      </div>

      <Card title={`${t("book.articles")} (${sorted.length})`} padded={false}>
        {sorted.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t("book.noArticles")}</p>
        ) : (
          <div className="tracklist" data-testid="article-list">
            {sorted.map((a, i) => {
              const ready = a.processing_status === "READY";
              const pct = clampPercent(a.reading_percentage);
              const current = next?.article_id === a.article_id;
              const inner = (
                <>
                  <span className="track-num">{a.is_read ? <I.Check size={15} /> : current ? <I.Play size={13} /> : i + 1}</span>
                  <span className="min-w-0">
                    <span className="track-title">{a.title}</span>
                    <span className="track-sub">
                      {a.page_count ? t("common.pagesN", { n: a.page_count }) : ""}
                      {ready && a.current_page > 0 && !a.is_read ? ` · ${t("common.pageN", { n: a.current_page })} · ${pct}%` : ""}
                    </span>
                    {ready && pct > 0 && !a.is_read && (
                      <span className="progress thin mt-1.5 block max-w-xs">
                        <i style={{ width: `${pct}%` }} />
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    {a.is_read ? (
                      <Badge tone="success">✓ {t("book.read")}</Badge>
                    ) : !ready ? (
                      <Badge tone={statusTone(a.processing_status)}>{a.processing_status === "FAILED" ? t("book.failed") : t("book.notReady")}</Badge>
                    ) : (
                      <I.ChevronRight size={16} className="text-muted" />
                    )}
                  </span>
                </>
              );
              const cls = cn("track", a.is_read && "done", current && "current", !ready && "disabled");
              return ready ? (
                <Link key={a.article_id} href={`/reader/${a.article_id}`} prefetch={false} className={cls}>
                  {inner}
                </Link>
              ) : (
                <div key={a.article_id} className={cls}>
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
