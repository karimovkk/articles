"use client";

/** Public katalog (FE-2.1): GET /catalog — qidiruv, kategoriya filtri (`GET /categories`), pagination, public muqova. */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookCover } from "@/components/book-cover";
import { Price } from "@/components/catalog/price";
import { Alert, Badge, EmptyState, PageHeader, Pagination, SearchInput, Select, Spinner } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { catalogApi } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { useDebouncedCallback } from "@/lib/use-debounce";
import { useT } from "@/i18n";

function CatalogList() {
  const { t } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [search, setSearch] = useState(query);
  // O'zimiz URL'ga yozgan oxirgi q — tashqi o'zgarish (orqaga/oldinga, havola) dan farqlash uchun
  const [pushed, setPushed] = useState(query);
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    if (query !== pushed) {
      setSearch(query);
      setPushed(query);
    }
  }

  const { data, loading, error, reload } = useAsync(() => catalogApi.list({ search: query || undefined, category_id: category || undefined, page, page_size: 24 }), [query, category, page]);
  const { data: categories } = useAsync(() => catalogApi.categories().catch(() => []), []);

  const href = (q: string, cat: string, p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (cat) sp.set("category", cat);
    if (p > 1) sp.set("page", String(p));
    return `/catalog${sp.size ? `?${sp}` : ""}`;
  };
  const navigate = (q: string, cat: string, p: number) => {
    // Bir xil so'rov qayta yuborilsa (masalan, tarmoq xatosidan keyin) — URL o'zgarmaydi, shuning uchun qayta so'raymiz
    if (q === query && cat === category && p === page) reload();
    else router.push(href(q, cat, p));
  };
  // Jonli qidiruv: yozilayotganda (300 ms) URL `?q=` `replace` bilan yangilanadi (tarix ifloslanmaydi), sahifa 1 ga qaytadi
  const live = useDebouncedCallback((q: string) => {
    if (q === query) return;
    setPushed(q);
    router.replace(href(q, category, 1));
  }, 300);

  return (
    <div>
      <PageHeader eyebrow={t("nav.catalog")} title={t("catalog.title")} description={t("catalog.description")} icon={<I.Grid size={26} />} />
      <form
        className="table-toolbar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (search.trim() === query) {
            live.cancel();
            reload();
          } else live.flush();
        }}
      >
        <SearchInput
          placeholder={t("catalog.searchPlaceholder")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            live.call(e.target.value.trim());
          }}
          className="w-full max-w-sm"
          aria-label={t("common.search")}
          data-testid="catalog-search"
        />
        {categories && categories.length > 0 && (
          <Select
            value={category}
            onChange={(v) => navigate(search.trim(), v, 1)}
            options={[{ value: "", label: t("catalog.allCategories") }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            className="w-52"
            aria-label={t("admin.books.category")}
            data-testid="catalog-category"
          />
        )}
        {loading && data && <Spinner className="size-4 text-muted" />}
        {data && <div className="toolbar-meta">{t("common.total")}: {data.total}</div>}
      </form>

      {error && <Alert className="mb-4">{error}</Alert>}

      {loading && !data ? (
        <div className="flex justify-center py-16 text-muted">
          <Spinner />
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState title={t("catalog.empty")} icon={<I.Search size={22} />} />
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          <div className="book-grid" data-testid="book-grid">
            {data.items.map((item) => (
              <Link key={item.book_id} href={`/catalog/${item.book_id}`} className="book-card">
                <BookCover bookId={item.book_id} title={item.title} hasCover={item.has_cover} source="catalog">
                  {!!item.article_count && (
                    <span className="badge-tr">
                      <Badge className="bg-[rgba(15,20,18,0.72)] text-white backdrop-blur-sm">{t("catalog.articles", { n: item.article_count })}</Badge>
                    </span>
                  )}
                </BookCover>
                <div className="min-w-0">
                  <p className="book-title">{item.title}</p>
                  {item.author && <p className="book-meta">{item.author}</p>}
                  <p className="mt-1.5 text-[13.5px] font-extrabold text-text">
                    <Price value={item.price} />
                  </p>
                  {item.category_name && (
                    <div className="mt-1.5">
                      <Badge>{item.category_name}</Badge>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-6">
            <Pagination page={data.page} pages={data.pages} onChange={(p) => navigate(query, category, p)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense>
      <CatalogList />
    </Suspense>
  );
}
