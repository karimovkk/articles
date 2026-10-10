"use client";

/**
 * Katalog (FE-2.1, dizayn 16.3; 45 — ikki sahifaga bo'lindi): `kind="free"` — "Kunlik kitoblar" (`/daily`, faqat tekin,
 * mehmon ham o'qiydi), `kind="paid"` — "Pullik kitoblar" (`/catalog`, savatcha aksiyasi bilan). Backend filtri:
 * `GET /catalog?is_free=true|false`. Hero (serif sarlavha, jonli qidiruv), ikki sahifa orasida almashtirgich,
 * kategoriya chip'lari, gorizontal kartalar, dumaloq pagination. URL — yagona manba: `?q=&category=&page=`.
 */
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookCardH } from "@/components/catalog/book-card";
import { HeroBrand } from "@/components/layout/year-progress";
import { AddToCartButton, PricingPromo } from "@/components/cart/cart-ui";
import { Price } from "@/components/catalog/price";
import { ShareMenu } from "@/components/share/share-menu";
import { Alert, EmptyState, Menu, MenuItem, RoundPagination, Spinner, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { catalogApi } from "@/lib/api";
import { useCatalogCategories } from "@/lib/catalog-categories";
import { env } from "@/lib/env";
import { isFreeBook } from "@/lib/free-books";
import { loadOwnedBookIds } from "@/lib/owned-books";
import { useAsync } from "@/lib/use-async";
import { useDebouncedCallback } from "@/lib/use-debounce";
import { useAuth } from "@/providers/auth-provider";
import { useT } from "@/i18n";

export type CatalogKind = "free" | "paid";
export const CATALOG_PATH: Record<CatalogKind, string> = { free: "/daily", paid: "/catalog" };

/** Chip qatorida ko'rinadigan kategoriyalar soni — qolganlari "Yana" menyusida */
const CHIPS = 5;

function CatalogList({ kind }: { kind: CatalogKind }) {
  const { t } = useT();
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [search, setSearch] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);
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

  const base = CATALOG_PATH[kind];
  const pathname = usePathname();
  const { data, loading, error, reload } = useAsync(
    () => catalogApi.list({ search: query || undefined, category_id: category || undefined, page, page_size: 24, is_free: kind === "free" }),
    [query, category, page, kind],
  );
  const categories = useCatalogCategories();
  // Kirgan foydalanuvchi: kutubxonadagi kitoblar — kartada "Kutubxonada" + "O'qish"
  const userId = user?.id;
  const { data: owned } = useAsync(() => (userId ? loadOwnedBookIds() : Promise.resolve(null)), [userId]);

  // Header'dagi qidiruv tugmasi: `/catalog#search` yoki shu sahifada — `a365:focus-search`
  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    if (window.location.hash === "#search") focus();
    window.addEventListener("a365:focus-search", focus);
    return () => window.removeEventListener("a365:focus-search", focus);
  }, []);

  const href = (q: string, cat: string, p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (cat) sp.set("category", cat);
    if (p > 1) sp.set("page", String(p));
    return `${base}${sp.size ? `?${sp}` : ""}`;
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

  const cats = categories ?? [];
  const shown = cats.slice(0, CHIPS);
  const activeHidden = cats.slice(CHIPS).find((c) => c.id === category);
  if (activeHidden) shown.push(activeHidden);
  const more = cats.slice(CHIPS).filter((c) => c !== activeHidden);

  return (
    <div>
      <section className="catalog-hero" data-testid="catalog-hero" data-kind={kind}>
        <div className="min-w-0">
          <p className="hero-eyebrow">{t(kind === "free" ? "catalog.dailyEyebrow" : "catalog.heroEyebrow")}</p>
          <h1 className="hero-title">
            {t(kind === "free" ? "catalog.dailyTitle" : "catalog.paidTitle")} <em>{t(kind === "free" ? "catalog.dailyAccent" : "catalog.paidAccent")}</em>
          </h1>
          <p className="hero-sub">{t(kind === "free" ? "catalog.dailySub" : "catalog.heroSub")}</p>
          <form
            className="hero-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (search.trim() === query) {
                live.cancel();
                reload();
              } else live.flush();
            }}
          >
            <I.Search size={18} />
            <input
              ref={inputRef}
              id="search"
              type="search"
              placeholder={t("catalog.searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                live.call(e.target.value.trim());
              }}
              aria-label={t("common.search")}
              autoComplete="off"
              data-testid="catalog-search"
            />
            {/* Qidiruv tugmasi yo'q (11.2) — yozilayotganda ishlaydi; Enter — kutmasdan */}
            {loading && data && <Spinner className="mr-3 size-4 shrink-0 text-[rgba(246,242,232,0.6)]" />}
          </form>
        </div>
        {/* 30: o'ng tomonda — katta brend (yozuv o'rniga) */}
        <HeroBrand name={env.appName} />
      </section>

      {/* 45: ikki sahifa — Kunlik (tekin) / Pullik */}
      <nav className="catalog-switch seg" aria-label={t("catalog.switch")} data-testid="catalog-switch">
        {(["free", "paid"] as const).map((k) => (
          <Link key={k} href={CATALOG_PATH[k]} className={cn(pathname === CATALOG_PATH[k] && "active")} aria-current={pathname === CATALOG_PATH[k] ? "page" : undefined}>
            {k === "free" ? <I.Sun size={15} /> : <I.Grid size={15} />}
            {t(k === "free" ? "nav.daily" : "nav.paid")}
          </Link>
        ))}
      </nav>

      {/* 35: ko'p kitobga chegirma (backend qo'llasa) — faqat pullik kitoblarda */}
      {kind === "paid" && <PricingPromo />}

      <div className="cat-chips" data-testid="catalog-categories">
        {cats.length > 0 && (
          <>
            <button type="button" className={cn("cat-chip", !category && "active")} aria-pressed={!category} data-value="" onClick={() => navigate(search.trim(), "", 1)}>
              <I.Grid size={16} />
              {t("catalog.allCategories")}
            </button>
            {shown.map((c) => (
              <button key={c.id} type="button" className={cn("cat-chip", category === c.id && "active")} aria-pressed={category === c.id} data-value={c.id} onClick={() => navigate(search.trim(), c.id, 1)}>
                <I.Tag size={15} />
                {c.name}
              </button>
            ))}
            {more.length > 0 && (
              <Menu
                align="start"
                aria-label={t("catalog.more")}
                trigger={(p) => (
                  <button {...p} type="button" className="cat-chip">
                    {t("catalog.more")}
                    <I.ChevronDown size={15} />
                  </button>
                )}
              >
                {more.map((c) => (
                  <MenuItem key={c.id} onSelect={() => navigate(search.trim(), c.id, 1)}>
                    {c.name}
                    {c.count !== null && <span className="ml-auto pl-3 text-xs text-muted">{c.count}</span>}
                  </MenuItem>
                ))}
              </Menu>
            )}
          </>
        )}
        {data && <span className="cat-chips-meta">{t("catalog.found", { n: data.total })}</span>}
      </div>

      {error && <Alert className="mb-4">{error}</Alert>}

      {loading && !data ? (
        <div className="flex justify-center py-16 text-muted">
          <Spinner />
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState title={t(kind === "free" && !query && !category ? "catalog.dailyEmpty" : "catalog.empty")} icon={<I.Search size={22} />} />
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          <div className="bgrid" data-testid="book-grid">
            {data.items.map((item) => {
              const has = !!owned?.has(item.book_id);
              const free = isFreeBook(item); // 37: tekin — sotilmaydi, mehmon ham o'qiydi
              return (
                <BookCardH
                  key={item.book_id}
                  bookId={item.book_id}
                  title={item.title}
                  hasCover={item.has_cover}
                  coverSource="catalog"
                  href={`/catalog/${item.book_id}`}
                  tags={
                    (item.category_name || has || free) && (
                      <>
                        {item.category_name && (
                          <span className="bcard-tag" title={item.category_name}>
                            <span className="chip-text">{item.category_name}</span>
                          </span>
                        )}
                        {free && !has && (
                          <span className="bcard-tag free" data-testid="free-tag">
                            {t("catalog.free")}
                          </span>
                        )}
                        {has && (
                          <span className="bcard-tag owned">
                            <I.Check size={11} />
                            {t("catalog.owned")}
                          </span>
                        )}
                      </>
                    )
                  }
                  description={item.description}
                  meta={
                    <>
                      {item.author && <span>{item.author}</span>}
                      {item.author && !!item.article_count && <span aria-hidden>·</span>}
                      {!!item.article_count && <span>{t("catalog.articles", { n: item.article_count })}</span>}
                    </>
                  }
                  footer={free ? <span className="bcard-price free">{t("catalog.free")}</span> : <Price value={item.price} className="bcard-price" />}
                  cta={
                    has
                      ? { href: `/books/${item.book_id}`, label: t("catalog.read"), icon: <I.BookOpen size={15} /> }
                      : free
                        ? { href: `/catalog/${item.book_id}`, label: t("catalog.read"), icon: <I.BookOpen size={15} /> }
                        : { href: `/catalog/${item.book_id}`, label: t("catalog.buy"), icon: <I.ShoppingBag size={15} /> }
                  }
                  ctaExtra={
                    free ? (
                      // 76: Daily Articles — ulashish (havola, Telegram, WhatsApp, …)
                      <ShareMenu compact url={`/catalog/${item.book_id}`} title={item.title} text={t("share.bookText", { title: item.title })} testid="card-share" />
                    ) : (
                      <AddToCartButton compact owned={has} book={{ book_id: item.book_id, title: item.title, author: item.author, price: item.price, has_cover: item.has_cover }} />
                    )
                  }
                />
              );
            })}
          </div>
          <RoundPagination page={data.page} pages={data.pages} onChange={(p) => navigate(query, category, p)} />
        </div>
      )}
    </div>
  );
}

/** Ikki katalog sahifasi uchun umumiy ko'rinish (`useSearchParams` — Suspense ichida) */
export function CatalogView({ kind }: { kind: CatalogKind }) {
  return (
    <Suspense>
      <CatalogList kind={kind} />
    </Suspense>
  );
}
