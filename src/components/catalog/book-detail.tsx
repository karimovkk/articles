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
import { Badge, Card, EmptyState, Spinner, buttonClass } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { OrderPanel } from "@/components/orders/order-panel";
import { AddToCartButton, TierLadder } from "@/components/cart/cart-ui";
import { usePricing } from "@/lib/use-pricing";
import { catalogApi, readerApi, type CatalogItem } from "@/lib/api";
import { useT } from "@/i18n";

export function CatalogBookDetail({ bookId }: { bookId: string }) {
  const pricing = usePricing();
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
      <EmptyState
        icon={<I.Search size={22} />}
        title={t("catalog.notFound")}
        action={
          <Link href="/catalog" className={buttonClass("secondary")}>
            <I.ArrowLeft size={16} />
            {t("catalog.back")}
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <nav className="crumbs" aria-label="breadcrumb">
        <Link href="/catalog">{t("nav.catalog")}</Link>
        <I.ChevronRight size={14} />
        <span className="current">{item.title}</span>
      </nav>
      <div className="book-hero">
        <BookCover bookId={item.book_id} title={item.title} hasCover={item.has_cover} size="medium" source="catalog" />
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {item.category_name && <Badge>{item.category_name}</Badge>}
            {!!item.article_count && <Badge tone="accent">{t("catalog.articles", { n: item.article_count })}</Badge>}
          </div>
          <div>
            <h1 className="book-hero-title">{item.title}</h1>
            {item.author && <p className="mt-1 text-[15px] font-semibold text-muted">{item.author}</p>}
          </div>
          <p className="max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-text-2">{item.description || t("catalog.noDescription")}</p>
          <p className="font-display text-2xl font-semibold tracking-tight text-text">
            <Price value={item.price} />
          </p>

          <Card className="mt-auto" padded>
            {hasAccess ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-muted">
                  <I.CheckCircle size={16} className="text-success" />
                  {t("catalog.inLibrary")}
                </span>
                <Link href={`/books/${item.book_id}`} className={buttonClass()}>
                  <I.BookOpen size={16} />
                  {t("catalog.read")}
                </Link>
              </div>
            ) : (
              <>
                <OrderPanel bookId={item.book_id} />
                {/* 35: savatcha — bir nechta kitob birga olinsa arzonroq */}
                {pricing && Number(item.price) > 0 && (
                  <div className="book-cart-row" data-testid="book-cart">
                    <AddToCartButton book={{ book_id: item.book_id, title: item.title, author: item.author, price: item.price, has_cover: item.has_cover }} />
                    <TierLadder cfg={pricing} className="compact" />
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
