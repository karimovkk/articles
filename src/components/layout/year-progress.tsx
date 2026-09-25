"use client";

/**
 * Yil kuni ko'rsatkichi (25): "266 / 365" nishoni va emblema atrofidagi to'ldiriladigan halqa.
 * Qiymat mount'dan keyin hisoblanadi (SSR bilan farq bo'lmasligi uchun) va yarim tunda o'zi yangilanadi.
 */
import { useEffect, useMemo, useState } from "react";
import { dayOfYear, daysInYear, msUntilMidnight } from "@/lib/year-day";
import { cn } from "@/components/ui";
import { useT } from "@/i18n";

export function useYearDay() {
  const [day, setDay] = useState<{ n: number; total: number } | null>(null);
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const now = new Date();
      setDay({ n: dayOfYear(now), total: daysInYear(now) });
      timer = window.setTimeout(tick, msUntilMidnight(now));
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);
  return day;
}

export function YearDayChip({ className }: { className?: string }) {
  const { t } = useT();
  const day = useYearDay();
  if (!day) return null;
  return (
    <span className={cn("year-chip", className)} title={t("client.dayOfYear", { n: day.n, total: day.total })} data-testid="year-day">
      <b>{day.n}</b>
      <span className="sep">/</span>
      {day.total}
    </span>
  );
}

const yearStyle = (day: { n: number; total: number } | null) => ({ ["--year" as string]: day ? (day.n / day.total).toFixed(4) : "0" });

/**
 * 32A: halqa chizig'idagi mahalliy bo'rtiq — Gauss shaklida tashqariga chiqqan yoy (viewBox 0–100, tepada).
 * CSS uni tepadan boshlab soat yo'nalishida bir marta aylantiradi; uchlari konus niqob bilan so'nadi.
 */
function bulgePath(r: number, amp: number, sigma = 15, span = 64) {
  const pts: string[] = [];
  for (let a = -span; a <= span; a += 2) {
    const rad = ((a - 90) * Math.PI) / 180;
    const rr = r + amp * Math.exp(-(a * a) / (2 * sigma * sigma));
    pts.push(`${(50 + rr * Math.cos(rad)).toFixed(2)} ${(50 + rr * Math.sin(rad)).toFixed(2)}`);
  }
  return `M${pts.join(" L")}`;
}

const BULGE = {
  // header: halqa 56px, chiziq 3px → markaziy radius 47.3, qalinlik ≈5.4 (viewBox birligida)
  sm: { r: 47.3, stroke: 4.6, amp: 8 },
  // hero: halqa ≈176–224px, chiziq 6px
  lg: { r: 48.6, stroke: 2.6, amp: 6 },
} as const;

function RingBulge({ size }: { size: keyof typeof BULGE }) {
  const { r, stroke, amp } = BULGE[size];
  const d = useMemo(() => bulgePath(r, amp), [r, amp]);
  return (
    <svg className="ring-bulge" viewBox="0 0 100 100" aria-hidden focusable="false">
      <path className="glow" d={d} strokeWidth={stroke * 2.6} />
      <path d={d} strokeWidth={stroke} />
    </svg>
  );
}

/**
 * Emblema + yil davomiyligini ko'rsatuvchi halqa (to'lib boradi).
 * 32A: `RingBulge` — vaqti-vaqti bilan halqa chizig'idagi bo'rtiq tepadan boshlab soat yo'nalishida aylanib o'tadi
 * (CSS animatsiya, reduced-motion'da yo'q).
 */
export function YearEmblem({ text = "365" }: { text?: string }) {
  const { t } = useT();
  const day = useYearDay();
  return (
    <span className="year-ring" style={yearStyle(day)} title={day ? t("client.dayOfYear", { n: day.n, total: day.total }) : undefined} data-testid="year-ring">
      <RingBulge size="sm" />
      <span className="client-emblem" aria-hidden>
        {text}
      </span>
    </span>
  );
}

/**
 * 30: katalog hero'ning o'ng tomonidagi katta brend — katta "365" halqa (oy belgilari bilan), nom va yil kuni.
 * Bezak: ekran o'quvchilarga faqat "Yilning N-kuni" matni o'qiladi.
 */
export function HeroBrand({ name }: { name: string }) {
  const { t } = useT();
  const day = useYearDay();
  return (
    <div className="hero-brand" data-testid="hero-brand">
      <span className="year-ring year-ring-lg" style={yearStyle(day)} aria-hidden>
        <span className="ring-months" />
        <RingBulge size="lg" />
        <span className="hero-brand-emblem">365</span>
      </span>
      <span className="hero-brand-name" aria-hidden>
        {name}
      </span>
      <span className="hero-brand-day">{day ? t("client.dayOfYear", { n: day.n, total: day.total }) : "\u00a0"}</span>
    </div>
  );
}
