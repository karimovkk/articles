"use client";

import { cn } from "@/components/ui";
import { formatNumber, useT } from "@/i18n";

/** Narx: raqam bo'lsa mahalliy formatda, aks holda "so'rov bo'yicha". Valyuta — backend bilan aniqlashtiriladi. */
export function Price({ value, className }: { value?: number | string | null; className?: string }) {
  const { t, locale } = useT();
  const n = value === null || value === undefined || value === "" ? NaN : Number(value);
  if (!Number.isFinite(n)) return <span className={className}>{t("catalog.priceOnRequest")}</span>;
  return <span className={className}>{t("catalog.price", { price: formatNumber(n, locale) })}</span>;
}

/** 81: chegirma bor-yo'qligi — backend `has_discount`/`discount_percent` beradi; eski javobda (maydonlar yo'q) — o'zimiz */
export function discountOf(item: { price?: string | number | null; original_price?: string | number | null; has_discount?: boolean; discount_percent?: number | null }) {
  const price = Number(item.price);
  const orig = Number(item.original_price);
  const has = item.has_discount ?? (Number.isFinite(price) && Number.isFinite(orig) && price > 0 && orig > price);
  if (!has || !(orig > 0)) return null;
  const pct = item.discount_percent ?? Math.round((1 - price / orig) * 100);
  return { original: orig, percent: pct };
}

/**
 * 81: kitob narxi — chegirma bo'lsa: joriy (to'lanadigan) narx asosiy, asl narx ustidan chiziq bilan, `−N%` belgisi;
 * bo'lmasa — oddiy narx. Ekran o'quvchiga: "Asl narx … , N% chegirma".
 */
export function PriceTag({
  item,
  className,
  size = "md",
}: {
  item: { price?: string | number | null; original_price?: string | number | null; has_discount?: boolean; discount_percent?: number | null };
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const { t } = useT();
  const d = discountOf(item);
  if (!d) return <Price value={item.price} className={className} />;
  return (
    <span className={cn("price-tag", `pt-${size}`, className)} data-testid="price-tag">
      <Price value={item.price} className="pt-now" />
      <s className="pt-old" data-testid="price-old">
        <span className="sr-only">{t("catalog.oldPrice")}: </span>
        <Price value={d.original} />
      </s>
      <span className="pt-badge" data-testid="price-discount" aria-label={t("catalog.discountA11y", { n: d.percent })}>
        −{d.percent}%
      </span>
    </span>
  );
}
