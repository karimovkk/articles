"use client";

import { useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { Alert, Button, EmptyState, Input, PageHeader, Pagination, Select, Spinner } from "@/components/ui";
import { libraryApi, progressPercent } from "@/lib/api";
import type { LibrarySort } from "@/lib/api/library";
import { useAsync } from "@/lib/use-async";
import { useT } from "@/i18n";

export default function LibraryPage() {
  const { t } = useT();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("recent");
  const [page, setPage] = useState(1);

  const { data, loading, error } = useAsync(
    () => libraryApi.list({ search: query || undefined, sort, page, page_size: 24 }),
    [query, sort, page],
  );

  return (
    <div>
      <PageHeader title={t("library.title")} description={t("library.description")} />

      <form
        className="mb-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <Input placeholder={t("library.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Select
          value={sort}
          onChange={(e) => {
            setPage(1);
            setSort(e.target.value as LibrarySort);
          }}
          className="w-44"
        >
          <option value="recent">{t("library.sort.recent")}</option>
          <option value="granted">{t("library.sort.granted")}</option>
          <option value="title">{t("library.sort.title")}</option>
        </Select>
        <Button type="submit" variant="secondary">
          {t("common.search")}
        </Button>
      </form>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-16 text-muted">
          <Spinner />
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState title={t("library.emptyTitle")} description={t("library.emptyDescription")} />
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {data.items.map((item) => {
              const pct = progressPercent(item.progress, item.book.page_count);
              return (
                <Link key={item.id} href={`/reader/${item.book.id}`} className="group block">
                  <BookCover bookId={item.book.id} title={item.book.title} hasCover={item.book.has_cover !== false} />
                  <div className="mt-2">
                    <p className="line-clamp-2 text-sm font-medium text-text group-hover:text-accent">{item.book.title}</p>
                    {item.book.author && <p className="truncate text-xs text-muted">{item.book.author}</p>}
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-bg">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      {pct > 0 ? t("library.readPercent", { n: pct }) : t("library.notStarted")}
                      {item.book.page_count ? ` · ${t("common.pagesN", { n: item.book.page_count })}` : ""}
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
