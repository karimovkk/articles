"use client";

/**
 * Savatcha (35.3): kitoblar (asl narx ustidan chizilgan + chegirmali narx), narx zinapoyasi va keyingi pog'ona
 * maslahati, xulosa (server hisobi — `POST /orders/quote`), tavsiya kitoblar; "Buyurtma berish" →
 * `POST /orders/checkout` → bitta buyurtma → to'lov rekvizitlari + chek yuborish → holat kuzatiladi.
 * Kutubxonadagi kitoblar savatdan avtomatik olib tashlanadi. Alohida ochiq buyurtmasi bor kitob esa savatda qoladi
 * (jim o'chirilmaydi): sababi yoziladi, buyurtma hisobiga kirmaydi; bitta kitobli, to'lanmagan buyurtmani shu yerda
 * bekor qilib, kitobni savatdagi chegirma bilan olish mumkin.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { Price } from "@/components/catalog/price";
import { AddToCartButton, TierLadder } from "@/components/cart/cart-ui";
import { CheckoutOrder } from "@/components/cart/checkout-order";
import { Alert, Button, EmptyState, IconButton, PageHeader, Spinner, buttonClass, cn, useConfirm } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { catalogApi, errorMessage, isApiError, orderBookIds, ordersApi, type CatalogItem, type Order, type OrderQuote } from "@/lib/api";
import { cart, useCart } from "@/lib/cart";
import { loadOwnedBookIds } from "@/lib/owned-books";
import { quoteLocal } from "@/lib/pricing";
import { usePricing } from "@/lib/use-pricing";
import { useAuth } from "@/providers/auth-provider";
import { formatNumber, useT } from "@/i18n";

export default function CartPage() {
  const { t, locale } = useT();
  const { user, loading: authLoading } = useAuth();
  /** Narx matni (tarjima ichiga qo'yish uchun): "39 000 so'm" */
  const money = (v?: string | number | null) => t("catalog.price", { price: formatNumber(Number(v ?? 0), locale) });
  const cfg = usePricing();
  const items = useCart();
  const confirm = useConfirm();
  const [serverQuote, setServerQuote] = useState<{ key: string; quote: OrderQuote } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Order | null>(null);
  const [suggest, setSuggest] = useState<CatalogItem[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(() => new Set());
  // Savatdagi kitob → uning alohida ochiq buyurtmasi (PENDING / AWAITING_REVIEW)
  const [openOrders, setOpenOrders] = useState<Map<string, Order>>(() => new Map());
  const [ordersNonce, setOrdersNonce] = useState(0);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const allIds = useMemo(() => items.map((i) => i.book_id), [items]);
  const allKey = allIds.join(",");
  // Buyurtmaga kiradigan kitoblar — ochiq buyurtmasi borlari hisobga olinmaydi
  const ids = useMemo(() => allIds.filter((id) => !openOrders.has(id)), [allIds, openOrders]);
  const key = ids.join(",");

  // Kirgan foydalanuvchi: kutubxonadagi kitoblar savatdan olib tashlanadi; ochiq buyurtmadagilar belgilanadi
  const userId = user?.id;
  useEffect(() => {
    if (!userId || !allKey) return;
    let alive = true;
    void Promise.all([loadOwnedBookIds().catch(() => new Set<string>()), ordersApi.mine().catch(() => [] as Order[])]).then(([owned, orders]) => {
      if (!alive) return;
      setOwnedIds(owned);
      const current = allKey.split(",");
      const ownedNow = current.filter((id) => owned.has(id));
      const open = new Map<string, Order>();
      for (const id of current) {
        const o = orders.find((x) => (x.status === "PENDING" || x.status === "AWAITING_REVIEW") && orderBookIds(x).includes(id));
        if (o && !owned.has(id)) open.set(id, o);
      }
      setOpenOrders(open);
      if (ownedNow.length) {
        cart.removeMany(ownedNow);
        setNotice(t("cart.ownedRemoved"));
      }
    });
    return () => {
      alive = false;
    };
  }, [userId, allKey, ordersNonce, t]);

  /** Bitta kitobli, hali to'lanmagan alohida buyurtmani bekor qilish → kitob savatdagi chegirma bilan olinadi */
  const cancelSeparate = async (o: Order) => {
    const ok = await confirm({ title: t("orders.cancel"), message: t("cart.cancelSeparateConfirm"), confirmLabel: t("orders.cancel"), tone: "danger" });
    if (!ok) return;
    setCancelling(o.id);
    setError(null);
    try {
      await ordersApi.cancel(o.id);
      setOrdersNonce((n) => n + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCancelling(null);
    }
  };

  // Server hisobi (yakuniy summa) — savatcha o'zgarganda
  useEffect(() => {
    if (!cfg || !key) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      ordersApi
        .quote(key.split(","))
        .then((q) => {
          if (!alive) return;
          setServerQuote({ key, quote: q });
          // Savatga qo'shilgandan keyin tekin bo'lib qolgan kitob — sotib olish kerak emas, savatdan chiqariladi
          const free = (q.skipped ?? []).filter((x) => x.reason === "BOOK_IS_FREE").map((x) => x.book_id);
          if (free.length) {
            cart.removeMany(free);
            setNotice(t("cart.freeRemoved"));
          }
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [cfg, key, t]);

  // Tavsiya kitoblar: katalogdan, savatda yo'q, pullik
  useEffect(() => {
    if (!cfg) return;
    let alive = true;
    catalogApi
      .list({ page: 1, page_size: 24 })
      .then((r) => alive && setSuggest(r.items))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [cfg]);

  const local = useMemo(() => (cfg ? quoteLocal(items.filter((i) => !openOrders.has(i.book_id)).map((i) => ({ book_id: i.book_id, title: i.title, price: i.price })), cfg) : null), [items, openOrders, cfg]);
  const quote = serverQuote && serverQuote.key === key ? serverQuote.quote : local;
  const unitOf = (id: string) => quote?.items.find((i) => i.book_id === id);
  const saved = Number(quote?.discount ?? 0);

  const checkout = async () => {
    if (!ids.length) return;
    setBusy(true);
    setError(null);
    try {
      const order = await ordersApi.checkout(ids);
      cart.removeMany(orderBookIds(order));
      setCreated(order);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      // Konflikt — muammoli kitoblar savatdan olib tashlanadi, foydalanuvchi qayta bosadi
      const bad = isApiError(e) && Array.isArray((e.details as { book_ids?: unknown })?.book_ids) ? ((e.details as { book_ids: string[] }).book_ids ?? []) : [];
      const code = isApiError(e) ? e.code : "";
      if (bad.length && code === "ORDER_ALREADY_PENDING") {
        // Boshqa oynada alohida buyurtma ochilgan — kitoblar savatda qoladi, sababi bilan belgilanadi
        setOrdersNonce((n) => n + 1);
        setNotice(t("cart.pendingMarked"));
      } else if (bad.length) {
        cart.removeMany(bad);
        setNotice(t(code === "ALREADY_HAS_ACCESS" ? "cart.ownedRemoved" : "cart.unavailableRemoved"));
      } else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    const ok = await confirm({ title: t("cart.clear"), message: t("cart.clearConfirm"), confirmLabel: t("cart.clear"), tone: "danger" });
    if (ok) cart.clear();
  };

  const header = <PageHeader eyebrow={t("cart.eyebrow")} title={t("cart.title")} description={t("cart.sub")} icon={<I.ShoppingBag size={26} />} />;

  if (cfg === undefined)
    return (
      <div>
        {header}
        <div className="flex justify-center py-16 text-muted">
          <Spinner />
        </div>
      </div>
    );

  // Buyurtma yaratildi — to'lov bosqichi
  if (created)
    return (
      <div>
        {header}
        <Alert tone="success" className="mb-4">
          {t("cart.orderCreated")}
        </Alert>
        <CheckoutOrder order={created} onChange={setCreated} />
        <Link href="/catalog" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-accent-ink hover:underline">
          <I.ArrowLeft size={15} />
          {t("cart.continue")}
        </Link>
      </div>
    );

  if (!cfg || !items.length)
    return (
      <div>
        {header}
        {notice && <Alert tone="info" className="mb-4">{notice}</Alert>}
        <EmptyState
          icon={<I.ShoppingBag size={22} />}
          title={t("cart.empty.title")}
          description={t("cart.empty.desc")}
          action={
            <Link href="/catalog" className={buttonClass("primary")}>
              {t("cart.empty.cta")}
              <I.ArrowRight size={16} />
            </Link>
          }
        />
        {cfg && <TierLadder cfg={cfg} className="cart-empty-ladder" />}
      </div>
    );

  const inCart = new Set(ids);
  // Tavsiya: savatda yo'q, kutubxonada yo'q, pullik
  const suggestions = suggest.filter((b) => !inCart.has(b.book_id) && !ownedIds.has(b.book_id) && Number(b.price) > 0).slice(0, 3);

  return (
    <div>
      {header}
      {notice && (
        <Alert tone="info" className="mb-4">
          {notice}
        </Alert>
      )}
      {error && <Alert className="mb-4">{error}</Alert>}

      <div className="cart-layout">
        <div className="cart-main">
          <section className="cart-card cart-tiers" data-testid="cart-tiers">
            <p className="cart-tiers-title">
              <I.Sparkles size={16} />
              {t("cart.ladder.title")}
            </p>
            <TierLadder cfg={cfg} current={quote?.quantity ?? items.length} />
            <p className="cart-next" data-testid="cart-next">
              {quote?.next_tier ? (
                <>
                  <I.ArrowRight size={14} />
                  <span>{t("cart.nextTier", { n: quote.next_tier.add_count, price: money(quote.next_tier.unit_price) })}</span>
                </>
              ) : (
                <>
                  <I.CheckCircle size={14} />
                  <span>{t("cart.bestTier", { price: money(quote?.items[0]?.unit_price) })}</span>
                </>
              )}
            </p>
          </section>

          <ul className="cart-items" data-testid="cart-items">
            {items.map((it) => {
              const line = unitOf(it.book_id);
              const discounted = line && Number(line.unit_price) < Number(line.list_price);
              const sep = openOrders.get(it.book_id);
              const canCancel = sep?.status === "PENDING" && orderBookIds(sep).length === 1;
              return (
                <li key={it.book_id} className={cn("cart-item", sep && "has-order")} data-testid="cart-item" data-book={it.book_id} data-open-order={sep?.status}>
                  <Link href={`/catalog/${it.book_id}`} className="cart-item-cover" tabIndex={-1} aria-hidden>
                    <BookCover bookId={it.book_id} title={it.title} hasCover={it.has_cover} source="catalog" />
                  </Link>
                  <div className="cart-item-body">
                    <Link href={`/catalog/${it.book_id}`} className="cart-item-title user-text">
                      {it.title}
                    </Link>
                    {it.author && <p className="cart-item-author user-text">{it.author}</p>}
                    <p className="cart-item-price">
                      {discounted && (
                        <s className="cart-item-old" data-testid="cart-old-price">
                          <Price value={line!.list_price} />
                        </s>
                      )}
                      <strong data-testid="cart-unit-price">
                        <Price value={line?.unit_price ?? it.price} />
                      </strong>
                    </p>
                    {sep && (
                      <div className="cart-item-order" data-testid="cart-item-order">
                        <p>
                          <I.Info size={14} />
                          <span>{sep.status === "PENDING" ? t("cart.separatePending") : t("cart.separateReview")}</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {canCancel && (
                            <Button size="sm" variant="secondary" loading={cancelling === sep.id} onClick={() => void cancelSeparate(sep)} data-testid="cart-cancel-separate">
                              {t("cart.cancelSeparate")}
                            </Button>
                          )}
                          <Link href={`/catalog/${it.book_id}`} className={buttonClass("ghost", "sm")}>
                            {t("cart.viewOrder")}
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                  <IconButton size="sm" variant="plain" label={t("cart.remove")} onClick={() => cart.remove(it.book_id)} data-testid="cart-remove">
                    <I.Trash size={16} />
                  </IconButton>
                </li>
              );
            })}
          </ul>

          {suggestions.length > 0 && (
            <section className="cart-suggest" data-testid="cart-suggest">
              <h2 className="cart-suggest-title">{t("cart.suggest")}</h2>
              <div className="cart-suggest-grid">
                {suggestions.map((b) => (
                  <article key={b.book_id} className="cart-suggest-card">
                    <Link href={`/catalog/${b.book_id}`} className="cart-suggest-cover" tabIndex={-1} aria-hidden>
                      <BookCover bookId={b.book_id} title={b.title} hasCover={b.has_cover} source="catalog" />
                    </Link>
                    <div className="min-w-0">
                      <Link href={`/catalog/${b.book_id}`} className="cart-item-title user-text">
                        {b.title}
                      </Link>
                      <p className="cart-item-author">
                        <Price value={b.price} />
                      </p>
                      <AddToCartButton compact book={{ book_id: b.book_id, title: b.title, author: b.author, price: b.price, has_cover: b.has_cover }} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="cart-summary cart-card" data-testid="cart-summary">
          <h2 className="cart-summary-title">{t("cart.items", { n: quote?.quantity ?? items.length })}</h2>
          <dl className="cart-lines">
            <div>
              <dt>{t("cart.subtotal")}</dt>
              <dd>
                <Price value={quote?.subtotal} />
              </dd>
            </div>
            <div className={cn(saved > 0 && "is-discount")}>
              <dt>{t("cart.discount")}</dt>
              <dd data-testid="cart-discount">
                {saved > 0 ? "−" : ""}
                <Price value={quote?.discount} />
              </dd>
            </div>
            <div className="is-total">
              <dt>{t("cart.total")}</dt>
              <dd data-testid="cart-total">
                <Price value={quote?.total} />
              </dd>
            </div>
          </dl>
          {saved > 0 && (
            <p className="cart-savings" data-testid="cart-savings">
              <I.Sparkles size={15} />
              <span>{t("cart.savings", { amount: money(quote?.discount) })}</span>
            </p>
          )}
          {authLoading ? (
            <Spinner />
          ) : user ? (
            <Button className="w-full" size="lg" onClick={() => void checkout()} loading={busy} disabled={!ids.length} icon={<I.Check size={17} />} data-testid="cart-checkout">
              {t("cart.checkout")}
            </Button>
          ) : (
            <Link href={`/login?next=${encodeURIComponent("/cart")}`} className={buttonClass("primary", "lg", "w-full")} data-testid="cart-login">
              {t("cart.loginToCheckout")}
            </Link>
          )}
          <button type="button" className="cart-clear" onClick={() => void clearAll()}>
            <I.Trash size={14} />
            {t("cart.clear")}
          </button>
        </aside>
      </div>
    </div>
  );
}
