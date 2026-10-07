"use client";

/**
 * 60: "Buyurtmalar holati" — donut (dataviz qoidalari): qism–butun bir qarashda (≤ 6 bo'lak), bo'laklar orasida 2 px fon
 * bo'shlig'i. Rang — sayt belgilari bilan bir xil ma'no (holat ranglari; validator: yorug' — CVD PASS, qorong'i — 7.0,
 * yozuvlar bilan); "bekor qilingan" — ataylab neytral kulrang. Tartib shunday tanlangan: yashil va qizil, sariq va qizil
 * yonma-yon tushmaydi. Rang hech qachon yolg'iz emas — legend'da nom, son va foiz (jadval vazifasini ham bajaradi).
 * Markazda jami; bo'lak yoki legend qatori ustida (hover / klaviatura fokusi) — shu holat soni va ulushi.
 */
import { useEffect, useState } from "react";
import { cn } from "@/components/ui";
import { formatNumber, useT } from "@/i18n";
import type { OrderStatus } from "@/lib/api";

/** Aylana bo'ylab tartib (soat yo'nalishida, tepadan) — rang juftlari ajralib turishi uchun */
const ORDER: OrderStatus[] = ["APPROVED", "AWAITING_REVIEW", "REJECTED", "CANCELLED", "PENDING"];
const SIZE = 200;
const C = SIZE / 2;
const R = 92;
const INNER = 62;

const pt = (r: number, a: number) => `${(C + r * Math.cos(a)).toFixed(2)},${(C + r * Math.sin(a)).toFixed(2)}`;
/** Halqa bo'lagi (a0 → a1, radian; tepadan soat yo'nalishida) */
function arc(a0: number, a1: number, r1: number, r0: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${pt(r1, a0)} A${r1},${r1} 0 ${large} 1 ${pt(r1, a1)} L${pt(r0, a1)} A${r0},${r0} 0 ${large} 0 ${pt(r0, a0)} Z`;
}

/**
 * 70: aylanib chizilish — 0 → 1 (ease-out, ≈ 750 ms); ma'lumot o'zgarganda qayta. Animatsiyani kamaytirish
 * (`prefers-reduced-motion`) yoqilgan bo'lsa — darhol to'liq.
 */
function useSweep(key: string, ms = 750): number {
  const [s, setS] = useState({ key, p: 0 });
  // Ma'lumot o'zgardi — boshidan (render paytida; eski holat bir kadr ham to'liq ko'rinmaydi)
  if (s.key !== key) setS({ key, p: 0 });
  useEffect(() => {
    let raf = 0;
    let start = -1;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const tick = (now: number) => {
      if (start < 0) start = now;
      const x = reduce ? 1 : Math.min(1, (now - start) / ms);
      setS({ key, p: 1 - (1 - x) ** 3 });
      if (x < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, ms]);
  return s.key === key ? s.p : 0;
}

export function StatusDonut({ counts }: { counts: Partial<Record<OrderStatus, number>> }) {
  const { t, locale } = useT();
  const [active, setActive] = useState<OrderStatus | null>(null);
  const items = ORDER.map((s) => ({ s, n: counts[s] ?? 0 })).filter((x) => x.n > 0);
  const total = items.reduce((a, x) => a + x.n, 0);
  const sweep = useSweep(items.map((x) => `${x.s}:${x.n}`).join(","));
  if (!total) return null;
  const pct = (n: number) => Math.round((n / total) * 100);

  // Har bo'lak boshlanishi — oldingilar yig'indisi (tepadan, soat yo'nalishida)
  const angle = (v: number) => -Math.PI / 2 + (v / total) * Math.PI * 2;
  // Animatsiya: aylana tepadan `sweep` gacha ochiladi — bo'lak shu chegaragacha chiziladi (element doim joyida)
  const sweepEnd = -Math.PI / 2 + sweep * Math.PI * 2;
  const slices = items.map((x, i) => {
    const before = items.slice(0, i).reduce((a, y) => a + y.n, 0);
    const a0 = angle(before);
    return { ...x, a0, a1: Math.min(angle(before + x.n), sweepEnd) };
  });
  const ringR = (R + INNER) / 2;
  const circ = 2 * Math.PI * ringR;
  const cur = active ? items.find((x) => x.s === active) : null;
  const on = (s: OrderStatus | null) => () => setActive(s);

  return (
    <div className="status-donut" data-testid="status-donut">
      {/* 69: kartaning kengligiga moslashadi (container query): tor — donut tepada, legend ostida */}
      <div className="status-donut-in">
      <div className="donut-figure" onPointerLeave={on(null)}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="donut-svg" role="img" aria-label={t("admin.payments.byStatus")}>
          {slices.length === 1 ? (
            <circle
              cx={C}
              cy={C}
              r={ringR}
              fill="none"
              strokeWidth={R - INNER}
              strokeDasharray={`${circ * sweep} ${circ}`}
              transform={`rotate(-90 ${C} ${C})`}
              className={cn("donut-slice", `st-${slices[0].s}`, active === slices[0].s && "on")}
              data-testid="donut-slice"
              data-status={slices[0].s}
              onPointerEnter={on(slices[0].s)}
            />
          ) : (
            slices.map((x) => (
              <path
                key={x.s}
                d={x.a1 > x.a0 + 0.001 ? arc(x.a0, x.a1, active === x.s ? R + 5 : R, INNER) : ""}
                className={cn("donut-slice", `st-${x.s}`, active === x.s && "on", active && active !== x.s && "dim")}
                onPointerEnter={on(x.s)}
                data-testid="donut-slice"
                data-status={x.s}
              />
            ))
          )}
        </svg>
        <div className="donut-center" data-testid="donut-center" aria-live="polite">
          <strong>{formatNumber(cur ? cur.n : total, locale)}</strong>
          <span>{cur ? `${t(`orders.status.${cur.s}`)} · ${pct(cur.n)}%` : t("admin.payments.ordersTotal")}</span>
        </div>
      </div>
      <ul className="donut-legend">
        {items.map((x) => (
          <li key={x.s}>
            <button
              type="button"
              className={cn("donut-legend-row", active === x.s && "on")}
              onPointerEnter={on(x.s)}
              onPointerLeave={on(null)}
              onFocus={on(x.s)}
              onBlur={on(null)}
              data-testid="donut-legend-row"
              data-status={x.s}
            >
              <i className={cn("donut-swatch", `st-${x.s}`)} aria-hidden />
              <span className="donut-legend-name">{t(`orders.status.${x.s}`)}</span>
              <span className="donut-legend-n">{formatNumber(x.n, locale)}</span>
              <span className="donut-legend-pct">{pct(x.n)}%</span>
            </button>
          </li>
        ))}
      </ul>
      </div>
    </div>
  );
}
