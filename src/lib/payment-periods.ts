/**
 * 64: to'lovlar dashboardi — davrlar (yil / oy / kun / soat). Backend `revenue_by_period` ni eng yangisidan beradi va
 * faqat to'lovi bor davrlarni qaytaradi; grafik vaqt o'qi to'g'ri bo'lishi uchun bo'sh davrlar 0 bilan to'ldiriladi.
 * Soat davri UTC (`"2026-10-07 14:00"`) — ko'rsatishda Toshkent vaqti (UTC+5, yozgi vaqt yo'q).
 */

export type Granularity = "year" | "month" | "day" | "hour";
export const GRANULARITIES: Granularity[] = ["year", "month", "day", "hour"];
export interface PeriodPoint {
  period: string;
  revenue: number;
  orders: number;
}

const TZ_OFFSET_H = 5; // Toshkent
const MAX_POINTS = 400;
const pad = (n: number) => String(n).padStart(2, "0");

/** Davr kaliti → UTC vaqt (davr boshi) */
function keyToDate(key: string, g: Granularity): Date | null {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?(?: (\d{2}):00)?$/.exec(key.trim());
  if (!m) return null;
  const [, y, mo = "01", d = "01", h = "00"] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), g === "hour" ? Number(h) : 0));
  return Number.isNaN(date.getTime()) ? null : date;
}
function dateToKey(d: Date, g: Granularity): string {
  const y = d.getUTCFullYear();
  if (g === "year") return String(y);
  const mo = `${y}-${pad(d.getUTCMonth() + 1)}`;
  if (g === "month") return mo;
  const day = `${mo}-${pad(d.getUTCDate())}`;
  return g === "day" ? day : `${day} ${pad(d.getUTCHours())}:00`;
}
function step(d: Date, g: Granularity): Date {
  const n = new Date(d);
  if (g === "year") n.setUTCFullYear(n.getUTCFullYear() + 1);
  else if (g === "month") n.setUTCMonth(n.getUTCMonth() + 1);
  else if (g === "day") n.setUTCDate(n.getUTCDate() + 1);
  else n.setUTCHours(n.getUTCHours() + 1);
  return n;
}
/** `YYYY-MM-DD` (oraliq chegarasi) → shu davr kaliti */
function boundKey(date: string | undefined, g: Granularity, end: boolean): string | null {
  if (!date) return null;
  const d = keyToDate(date, "day");
  if (!d) return null;
  if (g === "hour" && end) d.setUTCHours(23);
  return dateToKey(d, g);
}

/**
 * Eskidan yangiga, bo'sh davrlar 0 bilan. Chegara — oraliq (berilgan bo'lsa) yoki ma'lumotning birinchi/oxirgisi;
 * juda ko'p nuqta chiqsa (> 400) — faqat ma'lumot oralig'i.
 */
export function fillPeriods(rows: PeriodPoint[], g: Granularity, from?: string, to?: string): PeriodPoint[] {
  const byKey = new Map(rows.map((r) => [r.period, r]));
  const keys = rows.map((r) => r.period).sort();
  const build = (startKey: string | null, endKey: string | null): PeriodPoint[] | null => {
    const s = startKey ? keyToDate(startKey, g) : null;
    const e = endKey ? keyToDate(endKey, g) : null;
    if (!s || !e || s > e) return null;
    const out: PeriodPoint[] = [];
    for (let d = s; d <= e; d = step(d, g)) {
      const k = dateToKey(d, g);
      out.push(byKey.get(k) ?? { period: k, revenue: 0, orders: 0 });
      if (out.length > MAX_POINTS) return null;
    }
    return out;
  };
  const first = keys[0] ?? null;
  const last = keys[keys.length - 1] ?? null;
  const withRange = build(boundKey(from, g, false) ?? first, boundKey(to, g, true) ?? last);
  if (withRange) return withRange;
  return build(first, last) ?? [...rows].sort((a, b) => a.period.localeCompare(b.period));
}

type T = (key: "chart.months", params?: Record<string, string | number>) => string;
/**
 * Davr yozuvi. `long` — maslahat va jadval uchun to'liq ("7 okt 2026", "7 okt, 19:00").
 * Soat — Toshkent vaqtiga o'tkaziladi (kun ham o'zgarishi mumkin).
 */
export function periodLabel(period: string, g: Granularity, t: T, long = false): string {
  const d = keyToDate(period, g);
  if (!d) return period;
  const months = t("chart.months").split(",");
  if (g === "hour") d.setUTCHours(d.getUTCHours() + TZ_OFFSET_H);
  const y = d.getUTCFullYear();
  const mon = months[d.getUTCMonth()] ?? "";
  if (g === "year") return String(y);
  if (g === "month") return long || d.getUTCMonth() === 0 ? `${mon} ${y}` : mon;
  const day = `${d.getUTCDate()} ${mon.toLowerCase()}`;
  if (g === "day") return long ? `${day} ${y}` : day;
  const hh = `${pad(d.getUTCHours())}:00`;
  return long ? `${day}, ${hh}` : hh;
}

/** Tayyor oraliqlar (mahalliy sana bo'yicha) va ularga mos davr */
export type RangePreset = "all" | "today" | "7d" | "30d" | "month" | "year" | "custom";
export const RANGE_PRESETS: RangePreset[] = ["all", "today", "7d", "30d", "month", "year", "custom"];
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function presetRange(p: RangePreset, now = new Date()): { from?: string; to?: string; g: Granularity } {
  const today = localDay(now);
  const back = (n: number) => localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
  switch (p) {
    case "today":
      return { from: today, to: today, g: "hour" };
    case "7d":
      return { from: back(6), to: today, g: "day" };
    case "30d":
      return { from: back(29), to: today, g: "day" };
    case "month":
      return { from: localDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: today, g: "day" };
    case "year":
      return { from: `${now.getFullYear()}-01-01`, to: today, g: "month" };
    default:
      return { g: "month" };
  }
}
