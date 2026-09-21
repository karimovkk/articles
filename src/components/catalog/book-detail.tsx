"use client";

/**
 * Kitob batafsil (public, FE-2.2) + "Sotib olish" (FE-2.3).
 * Kirgan foydalanuvchi uchun ruxsat tekshiriladi (GET /reader/{id}): bor bo'lsa "O'qish".
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { BookCover } from "@/components/book-cover";
import { Price } from "@/components/catalog/price";
import { Alert, Badge, Card, Spinner, buttonClass } from "@/components/ui";
import { OrderPanel } from "@/components/orders/order-panel";
import { catalogApi, readerApi, type CatalogItem } from "@/lib/api";
import { useT } from "@/i18n";

export function CatalogBookDetail({ bookId }: { bookId: string }) {
  const { t } = useT();
  const { user, loading: authLoading } = useAuth();
  const [item, setItem] = useState<CatalogItem | null | undefined>(undefined); // undefined = yuklanmoqda
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    catalogApi
      .find(bookId, ac.signal)
      .then((i) => setItem(i))
      .catch(() => setItem(null));
    return () => ac.abort();
  }, [bookId]);

  // Kirgan foydalanuvchi: ruxsat bormi? (403 → yo'q; boshqa xato → yo'q deb hisoblanadi)
  useEffect(() => {
    if (authLoading || !user) return;
    let alive = true;
    readerApi
      .articles(bookId)
      .then(() => alive && setHasAccess(true))
      .catch(() => alive && setHasAccess(false));
    return () => {
      alive = false;
    };
  }, [bookId, user, authLoading]);

  if (item === undefined) {
    return (
      <div className="flex justify-center py-16 text-muted">
        <Spinner />
      </div>
    );
  }
  if (item === null) {
    return (
      <div className="space-y-3">
        <Alert>{t("catalog.notFound")}</Alert>
        <Link href="/catalog" className="text-sm text-accent hover:underline">
          {t("catalog.back")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/catalog" className="text-sm text-accent hover:underline">
        {t("catalog.back")}
      </Link>
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <BookCover bookId={item.book_id} title={item.title} hasCover={item.has_cover} size="medium" source="catalog" className="max-w-[220px]" />
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text">{item.title}</h1>
            {item.author && <p className="mt-1 text-muted">{item.author}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {item.category_name && <Badge>{item.category_name}</Badge>}
              {!!item.article_count && <span className="text-xs text-muted">{t("catalog.articles", { n: item.article_count })}</span>}
            </div>
          </div>
          <p className="text-xl font-semibold text-text">
            <Price value={item.price} />
          </p>
          <p className="whitespace-pre-wrap text-sm text-text">{item.description || t("catalog.noDescription")}</p>

          <Card className="p-4">
            {hasAccess ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted">{t("catalog.inLibrary")}</span>
                <Link href={`/books/${item.book_id}`} className={buttonClass()}>
                  {t("catalog.read")}
                </Link>
              </div>
            ) : (
              <OrderPanel bookId={item.book_id} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
