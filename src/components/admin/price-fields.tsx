"use client";

/**
 * 81: admin — kitob narxi: "Sotuv narxi" (to'lanadigan, majburiy) va "Asl narx" (chegirmagacha, ixtiyoriy). Asl narx
 * sotuv narxidan katta bo'lsa — saytda chegirma (oldindan ko'rish: −N%); kichik/teng bo'lsa — ogohlantirish (backend 422).
 */
import { Field, Input } from "@/components/ui";
import { useT } from "@/i18n";

export function PriceFields({ price, original, onPrice, onOriginal, required }: { price: string; original: string; onPrice: (v: string) => void; onOriginal: (v: string) => void; required?: boolean }) {
  const { t } = useT();
  const p = Number(price);
  const o = Number(original);
  const hasOriginal = original.trim() !== "";
  const bad = hasOriginal && p > 0 && !(o > p);
  const pct = hasOriginal && p > 0 && o > p ? Math.round((1 - p / o) * 100) : null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t("admin.books.salePrice")}>
        <Input type="number" min={1} step="any" inputMode="decimal" value={price} onChange={(e) => onPrice(e.target.value)} required={required} data-testid="book-price" />
      </Field>
      <Field label={t("admin.books.originalPrice")} hint={bad ? undefined : t("admin.books.originalHint")}>
        <Input type="number" min={1} step="any" inputMode="decimal" value={original} onChange={(e) => onOriginal(e.target.value)} aria-invalid={bad || undefined} data-testid="book-original-price" />
        {bad && (
          <p className="mt-1 text-xs font-semibold text-danger" data-testid="book-original-error">
            {t("admin.books.originalTooLow")}
          </p>
        )}
        {pct !== null && (
          <p className="mt-1 text-xs font-semibold text-success" data-testid="book-discount-preview">
            {t("admin.books.discountPreview", { n: pct })}
          </p>
        )}
      </Field>
    </div>
  );
}
