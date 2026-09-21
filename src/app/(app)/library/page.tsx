"use client";

/**
 * Kutubxona (foydalanuvchi): page-head + statistika, "Davom ettirish" bloki (oxirgi o'qilgan kitob),
 * muqova kartalari (progress, o'qilgan maqolalar), qo'lbola Select bilan saralash.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { Alert, Badge, EmptyState, PageHeader, Pagination, SearchInput, Select, Spinner, buttonClass } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { clampPercent, libraryApi, libraryCache, type LibraryItem } from "@/lib/api";
import type { LibrarySort } from "@/lib/api/library";
import { useAsync } from "@/lib/use-async";
import { useDebounced } from "@/lib/use-debounce";
import { formatDateTime, useT } from "@/i18n";

export default function LibraryPage() {
  const { t } = useT();
  const [search, setSearch] = useState("");
  const [debounced, flush] = useDebounced(search.trim(), 300); // jonli qidiruv: yozilayotganda so'raladi
  const query = debounced;
  const [sort, setSort] = useState<LibrarySort>("recent");
  // Sahifa filtrga bog'langan: qidiruv/saralash o'zgarsa 1-sahifaga qaytadi
  const filterKey = `${query}|${sort}`;
  const [pageState, setPageState] = useState({ page: 1, filterKey });
  const page = pageState.filterKey === filterKey ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ page: p, filterKey });

  const { data, loading, error, reload } = useAsync(() => libraryApi.list({ search: query || undefined, sort, page, page_size: 24 }), [query, sort, page]);

  // "Davom ettirish": boshlangan, tugallanmagan, eng so'nggi o'qilgan kitob (faqat filtrsiz 1-sahifada)
  const continueItem = useMemo<LibraryItem | null>(() => {
    if (!data || query || page !== 1) return null;
    const started = data.items.filter((b) => b.last_read_at && clampPercent(b.overall_percentage) < 100);
    started.sort((a, b) => (b.last_read_at ?? "").localeCompare(a.last_read_at ?? ""));
    return started[0] ?? null;
  }, [data, query, page]);

  const totalBooks = data?.total ?? 0;
  const items = data?.items ?? [];
  const readArticles = items.reduce((s, b) => s + b.read_count, 0);
  const totalArticles = items.reduce((s, b) => s + b.article_count, 0);
  const finished = items.filter((b) => clampPercent(b.overall_percentage) >= 100).length;

  const sortOptions = [
    { value: "recent", label: t("library.sort.recent") },
    { value: "granted", label: t("library.sort.granted") },
    { value: "title", label: t("library.sort.title") },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={t("nav.library")}
        title={t("library.title")}
        description={t("library.description")}
        icon={<I.Library size={26} />}
        actions={
          data && (
            <div className="flex flex-wrap gap-2" data-testid="library-stats">
              <Badge tone="accent">
                <I.Book size={13} /> {t("library.stats.books", { n: totalBooks })}
              </Badge>
              <Badge tone="success">
                <I.CheckCircle size={13} /> {t("library.stats.finished", { n: finished })}
              </Badge>
              <Badge>
                <I.FileText size={13} /> {t("library.articlesRead", { read: readArticles, total: totalArticles })}
              </Badge>
            </div>
          )
        }
      />

      {continueItem && (
        <Link href={`/books/${continueItem.book_id}`} onClick={() => libraryCache.put(continueItem)} className="card mb-5 flex items-center gap-4 p-4 transition-shadow hover:shadow-md" data-testid="continue-card">
          <BookCover bookId={continueItem.book_id} title={continueItem.title} hasCover={continueItem.has_cover} className="w-16 shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1">
            <span className="section-label mb-1">{t("book.continue")}</span>
            <p className="truncate text-[15px] font-extrabold text-text">{continueItem.title}</p>
            <p className="truncate text-xs font-semibold text-muted">
              {continueItem.author ? `${continueItem.author} · ` : ""}
              {continueItem.last_read_at ? formatDateTime(new Date(continueItem.last_read_at)) : ""}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <div className="progress max-w-xs">
                <i style={{ width: `${clampPercent(continueItem.overall_percentage)}%` }} />
              </div>
              <span className="text-xs font-bold tabular-nums text-text-2">{clampPercent(continueItem.overall_percentage)}%</span>
            </div>
          </div>
          <span className={buttonClass("primary", "md", "shrink-0 max-[640px]:hidden")}>
            <I.Play size={14} />
            {t("book.continue")}
          </span>
        </Link>
      )}

      <form
        className="table-toolbar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          // Enter — kutmasdan; bir xil so'rov (masalan, xatodan keyin) — qo'lda qayta so'raymiz
          if (search.trim() === query) reload();
          else flush();
        }}
      >
        <SearchInput placeholder={t("library.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full max-w-sm" aria-label={t("common.search")} data-testid="library-search" />
        <Select value={sort} onChange={(v) => setSort(v as LibrarySort)} options={sortOptions} className="w-48" aria-label={t("library.sortLabel")} data-testid="library-sort" />
        {loading && data && <Spinner className="size-4 text-muted" />}
      </form>

      {error && <Alert className="mb-4">{error}</Alert>}

      {loading && !data ? (
        <div className="flex justify-center py-16 text-muted">
          <Spinner />
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<I.Library size={22} />}
          title={t("library.emptyTitle")}
          description={t("library.emptyDescription")}
          action={
            <Link href="/catalog" className={buttonClass("primary")}>
              {t("nav.catalog")}
              <I.ArrowRight size={16} />
            </Link>
          }
        />
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          <div className="book-grid" data-testid="book-grid">
            {data.items.map((item) => {
              const pct = clampPercent(item.overall_percentage);
              return (
                <Link key={item.book_id} href={`/books/${item.book_id}`} onClick={() => libraryCache.put(item)} className="book-card">
                  <BookCover bookId={item.book_id} title={item.title} hasCover={item.has_cover}>
                    {pct >= 100 && (
                      <span className="badge-tl">
                        <Badge tone="success">
                          <I.Check size={12} /> {t("book.read")}
                        </Badge>
                      </span>
                    )}
                    {item.article_count > 0 && (
                      <span className="badge-tr">
                        <Badge className="bg-[rgba(15,20,18,0.72)] text-white backdrop-blur-sm">
                          {item.read_count}/{item.article_count}
                        </Badge>
                      </span>
                    )}
                  </BookCover>
                  <div className="min-w-0">
                    <p className="book-title">{item.title}</p>
                    {item.author && <p className="book-meta">{item.author}</p>}
                    <div className="progress thin mt-2">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11.5px] font-semibold text-muted">
                      {pct > 0 ? t("library.readPercent", { n: pct }) : t("library.notStarted")}
                      {item.article_count ? ` · ${t("library.articlesRead", { read: item.read_count, total: item.article_count })}` : ""}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-6">
            <Pagination page={data.page} pages={data.pages} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
