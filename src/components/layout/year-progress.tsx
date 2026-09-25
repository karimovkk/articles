"use client";

/**
 * Yil kuni ko'rsatkichi (25): "266 / 365" nishoni va emblema atrofidagi to'ldiriladigan halqa.
 * Qiymat mount'dan keyin hisoblanadi (SSR bilan farq bo'lmasligi uchun) va yarim tunda o'zi yangilanadi.
 */
import { useEffect, useState } from "react";
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
 * Emblema + yil davomiyligini ko'rsatuvchi halqa (to'lib boradi).
 * 30: `.ring-spark` — vaqti-vaqti bilan halqa bo'ylab aylanib o'tadigan oltin nur (CSS animatsiya, reduced-motion'da yo'q).
 */
export function YearEmblem({ text = "365" }: { text?: string }) {
  const { t } = useT();
  const day = useYearDay();
  return (
    <span className="year-ring" style={yearStyle(day)} title={day ? t("client.dayOfYear", { n: day.n, total: day.total }) : undefined} data-testid="year-ring">
      <span className="ring-spark" aria-hidden />
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
        <span className="ring-spark" />
        <span className="hero-brand-emblem">365</span>
      </span>
      <span className="hero-brand-name" aria-hidden>
        {name}
      </span>
      <span className="hero-brand-day">{day ? t("client.dayOfYear", { n: day.n, total: day.total }) : "\u00a0"}</span>
    </div>
  );
}
