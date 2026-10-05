"use client";

/**
 * 44.4: oylik tushum — bitta qatorli ustunli grafik (dataviz qoidalari): bitta rang (yorug'da #8a6400, qorong'ida
 * #b8890a — validatordan o'tgan), afsona yo'q (sarlavha aytadi), ustun ≤ 24px, tepasi 4px yumaloq va asosda to'g'ri,
 * ingichka to'r chiziqlari, toza Y belgilari. Har ustun — hover va klaviatura fokusida maslahat oynasi (qiymat birinchi);
 * "Jadval" ko'rinishi — hamma qiymat maslahatsiz ham ochiq.
 */
import { useState } from "react";
import { formatNumber, useT, type Locale } from "@/i18n";
import { cn } from "@/components/ui";

export interface MonthRevenue {
  month: string; // "YYYY-MM"
  revenue: number;
  orders: number;
}

/** Toza yuqori chegara va qadam (0 · 1 · 2 · 2.5 · 5 × 10ⁿ) */
function niceScale(max: number, ticks = 4): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 1 };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return { top: Math.ceil(max / step) * step, step };
}

/** "YYYY-MM" → "Okt" / "Okt 2026". Oy nomlari lug'atda (brauzer `Intl` da o'zbekcha qisqa oylar yo'q — "M10" chiqardi) */
export function monthLabel(month: string, t: ReturnType<typeof useT>["t"], withYear = false): string {
  const [y, m] = month.split("-").map(Number);
  const names = t("chart.months").split(",");
  if (!y || !m || !names[m - 1]) return month;
  return withYear ? `${names[m - 1]} ${y}` : names[m - 1];
}

/** O'q belgisi uchun ixcham: 640 000 → "640 ming", 1 200 000 → "1,2 mln" */
function compact(n: number, locale: Locale, t: ReturnType<typeof useT>["t"]): string {
  if (n >= 1_000_000) return t("chart.million", { n: formatNumber(Math.round((n / 1_000_000) * 10) / 10, locale) });
  if (n >= 1_000) return t("chart.thousand", { n: formatNumber(Math.round(n / 1_000), locale) });
  return formatNumber(n, locale);
}

export function RevenueChart({ data, money }: { data: MonthRevenue[]; money: (n: number) => string }) {
  const { t, locale } = useT();
  const [active, setActive] = useState<number | null>(null);
  const { top, step } = niceScale(Math.max(0, ...data.map((d) => d.revenue)));
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const tip = active !== null ? data[active] : null;

  return (
    <div className="rev-chart" data-testid="revenue-chart">
      <div className="rev-plot">
        {/* Y o'qi va to'r chiziqlari */}
        <div className="rev-grid" aria-hidden>
          {ticks.map((v) => (
            <div key={v} className="rev-gridline" style={{ bottom: `${(v / top) * 100}%` }}>
              <span>{compact(v, locale, t)}</span>
            </div>
          ))}
        </div>
        <div className="rev-cols" role="list" aria-label={t("admin.payments.byMonth")}>
          {data.map((d, i) => {
            const label = monthLabel(d.month, t, true);
            return (
              <div
                key={d.month}
                role="listitem"
                tabIndex={0}
                className={cn("rev-col", active === i && "active")}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((a) => (a === i ? null : a))}
                aria-label={`${label}: ${money(d.revenue)}, ${t("admin.payments.ordersN", { n: d.orders })}`}
                data-testid="revenue-col"
              >
                <span className="rev-bar" style={{ height: `${(d.revenue / top) * 100}%` }} />
                {tip && active === i && (
                  <span className={cn("rev-tip", i > data.length / 2 && "left")} role="tooltip" data-testid="revenue-tip">
                    <strong>{money(d.revenue)}</strong>
                    <span>
                      {label} · {t("admin.payments.ordersN", { n: d.orders })}
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="rev-xaxis" aria-hidden>
        {data.map((d) => (
          <span key={d.month}>{monthLabel(d.month, t, d.month.endsWith("-01"))}</span>
        ))}
      </div>
    </div>
  );
}
