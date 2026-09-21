"use client";

import { formatNumber, useT } from "@/i18n";

/** Narx: raqam bo'lsa mahalliy formatda, aks holda "so'rov bo'yicha". Valyuta — backend bilan aniqlashtiriladi. */
export function Price({ value, className }: { value?: number | string | null; className?: string }) {
  const { t, locale } = useT();
  const n = value === null || value === undefined || value === "" ? NaN : Number(value);
  if (!Number.isFinite(n)) return <span className={className}>{t("catalog.priceOnRequest")}</span>;
  return <span className={className}>{t("catalog.price", { price: formatNumber(n, locale) })}</span>;
}
