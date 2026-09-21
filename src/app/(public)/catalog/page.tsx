"use client";

/** Public katalog (FE-2.1): GET /catalog — qidiruv, kategoriya filtri (`GET /categories`), pagination, public muqova. */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookCover } from "@/components/book-cover";
import { Price } from "@/components/catalog/price";
import { Alert, Badge, Button, EmptyState, Input, PageHeader, Pagination, Select, Spinner } from "@/components/ui";
import { catalogApi } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { useT } from "@/i18n";

function CatalogList() {
  const { t } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [search, setSearch] = useState(query);

  const { data, loading, error, reload } = useAsync(() => catalogApi.list({ search: query || undefined, category_id: category || undefined, page, page_size: 24 }), [query, category, page]);
  const { data: categories } = useAsync(() => catalogApi.categories().catch(() => []), []);

  const navigate = (q: string, cat: string, p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (cat) sp.set("category", cat);
    if (p > 1) sp.set("page", String(p));
    // Bir xil so'rov qayta yuborilsa (masalan, tarmoq xatosidan keyin) — URL o'zgarmaydi, shuning uchun qayta so'raymiz
    if (q === query && cat === category && p === page) reload();
    else router.push(`/catalog${sp.size ? `?${sp}` : ""}`);
  };

  return (
    <div>
      <PageHeader title={t("catalog.title")} description={t("catalog.description")} />
      <form
        className="mb-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(search.trim(), category, 1);
        }}
      >
        <Input placeholder={t("catalog.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {categories && categories.length > 0 && (
          <Select value={category} onChange={(e) => navigate(search.trim(), e.target.value, 1)} className="w-52" aria-label={t("admin.books.category")}>
            <option value="">{t("catalog.allCategories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
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
        <EmptyState title={t("catalog.empty")} />
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {data.items.map((item) => (
              <Link key={item.book_id} href={`/catalog/${item.book_id}`} className="group block">
                <BookCover bookId={item.book_id} title={item.title} hasCover={item.has_cover} source="catalog" />
                <div className="mt-2">
                  <p className="line-clamp-2 text-sm font-medium text-text group-hover:text-accent">{item.title}</p>
                  {item.author && <p className="truncate text-xs text-muted">{item.author}</p>}
                  <p className="mt-1 text-sm font-semibold text-text">
                    <Price value={item.price} />
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.category_name && <Badge>{item.category_name}</Badge>}
                    {!!item.article_count && <span className="text-[11px] text-muted">{t("catalog.articles", { n: item.article_count })}</span>}
                  </div>
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
