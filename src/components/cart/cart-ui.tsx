"use client";

/**
 * 35: savatcha elementlari — "Savatga" tugmasi (katalog kartasi va kitob sahifasi), header'dagi savatcha ikonkasi,
 * aksiya banneri va narx zinapoyasi (1 / 2 / 3+). Backend chegirmani qo'llamasa (`GET /pricing` yo'q) — hech biri
 * ko'rsatilmaydi (eski "Sotib olish" oqimi o'zgarmaydi).
 */
import Link from "next/link";
import { useState } from "react";
import { Price } from "@/components/catalog/price";
import { buttonClass, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { cart, CART_MAX, useCart, type CartItem } from "@/lib/cart";
import { tierLadder } from "@/lib/pricing";
import { usePricing } from "@/lib/use-pricing";
import type { PricingConfig } from "@/lib/api";
import { isFreeBook } from "@/lib/free-books";
import { useT } from "@/i18n";

type Book = Omit<CartItem, "added_at">;

/** Savatga qo'shish mumkinmi: pullik (tekin emas — 37) va hali kutubxonada emas */
export function cartEligible(book: Pick<Book, "price"> & { is_free?: boolean }, owned?: boolean) {
  return !owned && !isFreeBook(book) && Number(book.price) > 0;
}

/**
 * "Savatga" / "Savatda" tugmasi. `compact` — katalog kartasi (ikonka + qisqa matn), aks holda kitob sahifasi.
 * Savatdagi kitob uchun — savatchaga havola.
 */
export function AddToCartButton({ book, owned, compact, className }: { book: Book; owned?: boolean; compact?: boolean; className?: string }) {
  const { t } = useT();
  const cfg = usePricing();
  const items = useCart();
  const [full, setFull] = useState(false);
  if (!cfg || !cartEligible(book, owned)) return null;
  const inCart = items.some((i) => i.book_id === book.book_id);
  if (inCart)
    return (
      <Link href="/cart" className={buttonClass("secondary", "sm", cn("cart-btn in-cart", className))} data-testid="in-cart" title={t("cart.view")}>
        <I.Check size={15} />
        <span className={cn(compact && "max-[400px]:hidden")}>{t("cart.inCart")}</span>
      </Link>
    );
  return (
    <button
      type="button"
      className={buttonClass("secondary", "sm", cn("cart-btn", className))}
      onClick={() => {
        setFull(!cart.add(book));
      }}
      data-testid="add-to-cart"
      title={full ? t("cart.full", { n: CART_MAX }) : t("cart.addLong")}
      aria-label={t("cart.addLong")}
    >
      <I.ShoppingBag size={15} />
      <span className={cn(compact && "max-[400px]:hidden")}>{compact ? t("cart.add") : t("cart.addLong")}</span>
    </button>
  );
}

/** Header: savatcha ikonkasi + soni (faqat chegirma yoqilgan bo'lsa) */
export function CartHeaderButton() {
  const { t } = useT();
  const cfg = usePricing();
  const items = useCart();
  if (!cfg) return null;
  const n = items.length;
  return (
    // ≤400px header'da joy yo'q (brend markazda) — u yerda savatcha yon menyuda va aksiya bannerida
    <Link href="/cart" className="icon-btn plain max-[400px]:hidden" aria-label={`${t("cart.title")}${n ? ` (${n})` : ""}`} title={t("cart.title")} data-testid="header-cart">
      <I.ShoppingBag size={19} />
      {n > 0 && (
        <span className="dot" data-testid="cart-count">
          {n}
        </span>
      )}
    </Link>
  );
}

/** Narx zinapoyasi: 1 ta — o'z narxi, 2 ta — …, 3+ — … ; `current` — joriy son (savatchada yoritiladi) */
export function TierLadder({ cfg, current, className }: { cfg: PricingConfig; current?: number; className?: string }) {
  const { t } = useT();
  const ladder = tierLadder(cfg);
  const active = current === undefined ? -1 : ladder.reduce((acc, s, i) => (s.min <= current ? i : acc), -1);
  return (
    <ol className={cn("tier-ladder", className)} data-testid="tier-ladder">
      <li className={cn("tier-step", current !== undefined && active === -1 && current > 0 && "active")}>
        <span className="tier-qty">{t("cart.ladder.one")}</span>
        <span className="tier-price">{t("cart.ladder.own")}</span>
      </li>
      {ladder.map((s, i) => (
        <li key={s.min} className={cn("tier-step", i === active && "active", s.plus && "best")}>
          <span className="tier-qty">{s.plus ? t("cart.ladder.nPlus", { n: s.min }) : t("cart.ladder.n", { n: s.min })}</span>
          <span className="tier-price">
            <Price value={s.price} /> <small>{t("cart.perBook")}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Katalog: aksiya banneri (chegirma yoqilgan bo'lsa) */
export function PricingPromo({ className }: { className?: string }) {
  const { t } = useT();
  const cfg = usePricing();
  const items = useCart();
  if (!cfg) return null;
  return (
    <section className={cn("pricing-promo", className)} data-testid="pricing-promo">
      <div className="pricing-promo-head">
        <span className="pricing-promo-icon">
          <I.Sparkles size={18} />
        </span>
        <p className="pricing-promo-title">{t("cart.promo.title")}</p>
      </div>
      <TierLadder cfg={cfg} className="pricing-promo-ladder" />
      <Link href="/cart" className={buttonClass("primary", "sm", "pricing-promo-cta")}>
        <I.ShoppingBag size={15} />
        {t("cart.promo.cta")}
        {items.length > 0 && <span className="pricing-promo-count">{items.length}</span>}
      </Link>
    </section>
  );
}

/** Yon menyu (sidebar) uchun: savatcha havolasi + soni (chegirma yoqilgan bo'lsa) */
export function useCartNav(): { enabled: boolean; count: number } {
  const cfg = usePricing();
  const items = useCart();
  return { enabled: !!cfg, count: items.length };
}
