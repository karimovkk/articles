"use client";

/**
 * 44.4 / 52 / 64: tushum (yil / oy / kun / soat) — chiziqli grafik (dataviz qoidalari): bitta seriya, bitta rang (yorug'da #8a6400, qorong'ida
 * #b8890a — validatordan o'tgan), afsona yo'q (sarlavha aytadi). 2px silliq chiziq (monoton kubik — nuqtalar orasida
 * pastga/yuqoriga "sakramaydi", noldan tushmaydi), ostida ~10% yengil to'ldirish, ingichka to'r chiziqlari, toza Y
 * belgilari; faqat oxirgi nuqta va uning qiymati yoziladi (har nuqtaga raqam yozilmaydi).
 * Hover: eng yaqin oyga yopishadigan vertikal chiziq + nuqta + maslahat (qiymat qalin, oy · buyurtmalar), oy yozuvi
 * ajraladi. Har oy — klaviatura bilan ham (Tab, ← → Home End). "Jadval" ko'rinishi — hamma qiymat maslahatsiz ham ochiq.
 * SVG haqiqiy piksel o'lchamida chiziladi (ResizeObserver) — chiziq qalinligi va matn cho'zilmaydi.
 */
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { formatNumber, useT, type Locale } from "@/i18n";
import { cn } from "@/components/ui";

/** 64: bitta davr nuqtasi (yil / oy / kun / soat) — `period` kaliti, yozuvini sahifa beradi */
export interface PeriodRevenue {
  period: string;
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


/** O'q belgisi uchun ixcham: 640 000 → "640 ming", 1 200 000 → "1,2 mln" */
function compact(n: number, locale: Locale, t: ReturnType<typeof useT>["t"]): string {
  if (n >= 1_000_000) return t("chart.million", { n: formatNumber(Math.round((n / 1_000_000) * 10) / 10, locale) });
  if (n >= 1_000) return t("chart.thousand", { n: formatNumber(Math.round(n / 1_000), locale) });
  return formatNumber(n, locale);
}

/** Monoton kubik egri (Fritsch–Carlson): har oraliqda qiymatlar orasida qoladi — "sakrash" va manfiy tushish yo'q */
function monotonePath(pts: ReadonlyArray<readonly [number, number]>): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1));
  }
  const tg: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) tg.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  tg.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      tg[i] = 0;
      tg[i + 1] = 0;
      continue;
    }
    const a = tg[i] / m[i];
    const b = tg[i + 1] / m[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      tg[i] = k * a * m[i];
      tg[i + 1] = k * b * m[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + tg[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - tg[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

const HEIGHT = 260;
const TOP = 26; // oxirgi qiymat yozuvi uchun joy
const BOTTOM = 30; // oy yozuvlari
const EDGE = 18; // chekka nuqtalar karta chetiga yopishmasin

export function RevenueChart({
  data,
  money,
  label,
  title,
}: {
  data: PeriodRevenue[];
  money: (n: number) => string;
  /** Davr yozuvi: `long` — maslahat va ekran o'quvchi uchun to'liq sana */
  label: (period: string, long: boolean) => string;
  title: string;
}) {
  const { t, locale } = useT();
  const gid = useId().replace(/:/g, "");
  const boxRef = useRef<HTMLDivElement>(null);
  const hitRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = width > 0 && width < 520;
  const axis = narrow ? 46 : 60;
  const n = data.length;
  const { top, step } = niceScale(Math.max(0, ...data.map((d) => d.revenue)));
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const base = HEIGHT - BOTTOM;
  const plotH = base - TOP;
  const x0 = axis + EDGE;
  const x1 = Math.max(x0, width - EDGE);
  const xAt = (i: number) => (n <= 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (n - 1));
  const yAt = (v: number) => TOP + (1 - v / top) * plotH;
  const pts = data.map((d, i) => [xAt(i), yAt(d.revenue)] as const);
  const line = monotonePath(pts);
  const area = n > 1 ? `${line} L${pts[n - 1][0]},${base} L${pts[0][0]},${base} Z` : "";
  // Oy yozuvlari ko'p bo'lsa — siyraklashtiriladi (oxirgisi va faol oy doim)
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((x1 - x0 + 2 * EDGE) / (narrow ? 44 : 56)))));
  const showX = (i: number) => i === active || i === n - 1 || (i % every === 0 && n - 1 - i >= every);
  const last = n - 1;
  const tip = active !== null ? data[active] : null;
  // Kesishuv chiziqlari oralig'i: har oy uchun nuqtalar orasidagi o'rtagacha (eng yaqin oyga yopishadi)
  const band = (i: number) => {
    const l = i === 0 ? axis : (xAt(i - 1) + xAt(i)) / 2;
    const r = i === n - 1 ? width : (xAt(i) + xAt(i + 1)) / 2;
    return { left: l, width: Math.max(0, r - l) };
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (to === null || to < 0 || to > last) return;
    e.preventDefault();
    hitRefs.current[to]?.focus();
  };
  // Oxirgi qiymat yozuvi chiziq kelgan tomonga emas: chiziq yuqoridan tushsa — nuqta ostida, aks holda ustida
  const endBelow = n > 1 && pts[last - 1][1] < pts[last][1] && pts[last][1] + 20 < base;
  const tipLeft = tip && active !== null ? xAt(active) : 0;
  const tipAlign = tipLeft < 110 ? "start" : tipLeft > width - 110 ? "end" : "center";

  return (
    <div className="rev-chart" data-testid="revenue-chart" ref={boxRef} onPointerLeave={() => setActive(null)}>
      {width > 0 && (
        <>
          <svg className="rev-svg" width={width} height={HEIGHT} aria-hidden>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--rev-line)" stopOpacity="0.16" />
                <stop offset="1" stopColor="var(--rev-line)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {ticks.map((v) => (
              <g key={v}>
                <line className="rev-grid" x1={axis} x2={width} y1={Math.round(yAt(v)) + 0.5} y2={Math.round(yAt(v)) + 0.5} />
                <text className="rev-y" x={axis - 10} y={yAt(v) + 4} textAnchor="end">
                  {compact(v, locale, t)}
                </text>
              </g>
            ))}
            {area && <path className="rev-area" d={area} fill={`url(#${gid})`} />}
            {n > 1 && <path className="rev-line" d={line} pathLength={1} />}
            {active !== null && <line className="rev-cross" x1={Math.round(xAt(active)) + 0.5} x2={Math.round(xAt(active)) + 0.5} y1={TOP - 6} y2={base} />}
            {/* Oxirgi nuqta (va qiymati) doim; faol nuqta — hover/fokusda */}
            {n > 0 && <circle className="rev-dot" cx={pts[last][0]} cy={pts[last][1]} r={4} />}
            {active !== null && <circle className="rev-dot active" cx={pts[active][0]} cy={pts[active][1]} r={5.5} data-testid="revenue-active-dot" />}
            {n > 0 && active !== last && (
              <text className="rev-end" x={pts[last][0] - (n > 1 ? 6 : 0)} y={endBelow ? pts[last][1] + 20 : pts[last][1] - 12} textAnchor={n > 1 ? "end" : "middle"} data-testid="revenue-end-label">
                {compact(data[last].revenue, locale, t)}
              </text>
            )}
            {data.map((d, i) =>
              showX(i) ? (
                <text key={d.period} className={cn("rev-x", i === active && "on")} x={xAt(i)} y={HEIGHT - 8} textAnchor={i === 0 && n > 1 ? "start" : i === last && n > 1 ? "end" : "middle"} dx={i === 0 && n > 1 ? -EDGE + 4 : i === last && n > 1 ? EDGE - 4 : 0}>
                  {label(d.period, false)}
                </text>
              ) : null,
            )}
          </svg>
          {/* Hover/fokus nishonlari — nuqtadan katta (butun oy oralig'i), ekran o'quvchi uchun qiymat bilan */}
          <div className="rev-hits" role="list" aria-label={title}>
            {data.map((d, i) => {
              const full = label(d.period, true);
              return (
                <div
                  key={d.period}
                  ref={(el) => {
                    hitRefs.current[i] = el;
                  }}
                  role="listitem"
                  tabIndex={i === (active ?? last) ? 0 : -1}
                  className="rev-hit"
                  style={{ left: band(i).left, width: band(i).width, height: base }}
                  onPointerEnter={() => setActive(i)}
                  onPointerMove={() => active !== i && setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((a) => (a === i ? null : a))}
                  onKeyDown={(e) => onKey(e, i)}
                  aria-label={`${full}: ${money(d.revenue)}, ${t("admin.payments.ordersN", { n: d.orders })}`}
                  data-testid="revenue-point"
                />
              );
            })}
          </div>
          {tip && active !== null && (
            <div className={cn("rev-tip", tipAlign)} style={{ left: tipLeft, top: pts[active][1] - 14 }} role="tooltip" data-testid="revenue-tip">
              <strong>{money(tip.revenue)}</strong>
              <span>
                {label(tip.period, true)} · {t("admin.payments.ordersN", { n: tip.orders })}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
