"use client";

/** Public katalog (FE-2.1): GET /catalog — qidiruv, pagination. Kategoriya filtri — public kategoriyalar endpointi so'ralgan. */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { BookCover } from "@/components/book-cover";
import { Price } from "@/components/catalog/price";
import { Alert, Badge, Button, EmptyState, Input, PageHeader, Pagination, Spinner } from "@/components/ui";
import { catalogApi, catalogCache } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { useT } from "@/i18n";

function CatalogList() {
  const { t } = useT();
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [search, setSearch] = useState(query);

  const { data, loading, error } = useAsync(() => catalogApi.list({ search: query || undefined, page, page_size: 24 }), [query, page]);

  const navigate = (q: string, p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    router.push(`/catalog${sp.size ? `?${sp}` : ""}`);
  };

  return (
    <div>
      <PageHeader title={t("catalog.title")} description={t("catalog.description")} />
      <form
        className="mb-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(search.trim(), 1);
        }}
      >
        <Input placeholder={t("catalog.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
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
              <Link key={item.book_id} href={`/catalog/${item.book_id}`} onClick={() => catalogCache.put(item)} className="group block">
                {/* Muqova: public endpoint yo'q — faqat kirgan foydalanuvchi uchun urinib ko'riladi (ruxsat bo'lsa ko'rinadi) */}
                <BookCover bookId={item.book_id} title={item.title} hasCover={!!user && item.has_cover !== false} />
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
            <Pagination page={data.page} pages={data.pages} onChange={(p) => navigate(query, p)} />
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
