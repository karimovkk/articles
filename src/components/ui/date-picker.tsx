"use client";

/**
 * Qo'lbola DatePicker (native `<input type="date">` o'rniga): kun / oy / yil ko'rinishlari,
 * "Bugun" va "Tozalash", klaviatura (← → ↑ ↓ Enter Esc), uz/ru/en oy-hafta nomlari.
 * Qiymat — `YYYY-MM-DD` yoki bo'sh string. Vaqt zonasi — mahalliy (sana matn sifatida saqlanadi).
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "./cn";
import { DropdownPanel, useOutsideClose } from "./dropdown";
import * as I from "./icons";
import { useT, type Locale } from "@/i18n";

export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** `YYYY-MM-DD` chegaralari (ixtiyoriy) */
  min?: string;
  max?: string;
  className?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

const UZ_MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const UZ_WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const TAG: Record<Locale, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-GB" };

function monthNames(locale: Locale): string[] {
  if (locale === "uz") return UZ_MONTHS;
  const f = new Intl.DateTimeFormat(TAG[locale], { month: "long" });
  return Array.from({ length: 12 }, (_, m) => {
    const s = f.format(new Date(2024, m, 1));
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
}
const WEEKDAYS: Record<Locale, string[]> = {
  uz: UZ_WEEKDAYS,
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
};

export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function parseISODate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
/** Ko'rsatish formati: uz — "21 sen 2026", ru/en — Intl medium */
export function formatISODate(v: string | null | undefined, locale: Locale): string {
  const d = parseISODate(v);
  if (!d) return "";
  if (locale === "uz") return `${d.getDate()} ${UZ_MONTHS[d.getMonth()].slice(0, 3).toLowerCase()} ${d.getFullYear()}`;
  return d.toLocaleDateString(TAG[locale], { dateStyle: "medium" });
}

type View = "days" | "months" | "years";

export function DatePicker({ value, onChange, placeholder, disabled, min, max, className, id, name, "aria-label": ariaLabel, "data-testid": testId }: DatePickerProps) {
  const { t, locale } = useT();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("days");
  const selected = parseISODate(value);
  const today = new Date();
  const [cursor, setCursor] = useState<Date>(() => selected ?? today); // ko'rsatilayotgan oy + klaviatura fokus kuni
  const [yearBase, setYearBase] = useState(() => Math.floor((selected ?? today).getFullYear() / 12) * 12);

  const close = useCallback(() => {
    setOpen(false);
    setView("days");
  }, []);
  // Ochilganda kursor — tanlangan sana (yoki bugun)
  function openPicker() {
    const base = parseISODate(value) ?? new Date();
    setCursor(base);
    setYearBase(Math.floor(base.getFullYear() / 12) * 12);
    setView("days");
    setOpen(true);
  }
  useOutsideClose(open, [triggerRef, panelRef], close);

  // Ochilganda fokus — kursor kuniga
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>("[data-focus='1']")?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const minD = parseISODate(min);
  const maxD = parseISODate(max);
  const inRange = (d: Date) => (!minD || d >= minD) && (!maxD || d <= maxD);

  function pick(d: Date) {
    if (!inRange(d)) return;
    onChange(toISODate(d));
    close();
    triggerRef.current?.focus();
  }

  function shiftMonth(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, Math.min(c.getDate(), 28)));
  }

  function onGridKey(e: KeyboardEvent) {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) {
      e.preventDefault();
      const n = new Date(cursor);
      n.setDate(n.getDate() + step[e.key]);
      setCursor(n);
      requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>("[data-focus='1']")?.focus());
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      shiftMonth(e.key === "PageUp" ? -1 : 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(cursor);
    } else if (e.key === "Tab") {
      close();
    }
  }

  const months = monthNames(locale);
  const weekdays = WEEKDAYS[locale];
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  // Dushanbadan boshlanadigan 6×7 to'r
  const first = new Date(y, m, 1);
  const lead = (first.getDay() + 6) % 7;
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => new Date(y, m, i + 1 - lead));
  const sameDay = (a: Date | null, b: Date) => !!a && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        data-testid={testId}
        data-value={value}
        disabled={disabled}
        className={cn("select-trigger", open && "open", className)}
        onClick={() => (open ? close() : openPicker())}
        onKeyDown={(e) => {
          if ((e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") && !open) {
            e.preventDefault();
            openPicker();
          }
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <I.Calendar size={16} className="shrink-0 text-muted" />
          {value ? <span className="truncate">{formatISODate(value, locale)}</span> : <span className="ph truncate">{placeholder ?? t("ui.date.placeholder")}</span>}
        </span>
        {value && !disabled ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label={t("ui.date.clear")}
            className="-mr-1 grid size-6 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          >
            <I.X size={14} />
          </span>
        ) : (
          <I.ChevronDown size={16} />
        )}
      </button>
      {name && <input type="hidden" name={name} value={value} />}
      {open && (
        <DropdownPanel triggerRef={triggerRef} panelRef={panelRef} minWidth={296} variant="plain" role="dialog" aria-label={ariaLabel ?? t("ui.date.placeholder")} className="cal-pop" style={{ width: 296, overflow: "visible" }}>
          <div className="cal-head">
            <button type="button" className="cal-nav" aria-label={t("common.prev")} onClick={() => (view === "days" ? shiftMonth(-1) : view === "months" ? setCursor(new Date(y - 1, m, 1)) : setYearBase((b) => b - 12))}>
              <I.ChevronLeft size={16} />
            </button>
            <button type="button" className="cal-label" onClick={() => setView(view === "days" ? "months" : view === "months" ? "years" : "days")} aria-live="polite">
              {view === "days" && `${months[m]} ${y}`}
              {view === "months" && y}
              {view === "years" && `${yearBase} – ${yearBase + 11}`}
            </button>
            <button type="button" className="cal-nav" aria-label={t("common.next")} onClick={() => (view === "days" ? shiftMonth(1) : view === "months" ? setCursor(new Date(y + 1, m, 1)) : setYearBase((b) => b + 12))}>
              <I.ChevronRight size={16} />
            </button>
          </div>

          {view === "days" && (
            <div ref={gridRef} role="grid" onKeyDown={onGridKey}>
              <div className="cal-grid cal-wd" role="row">
                {weekdays.map((w) => (
                  <span key={w} role="columnheader">
                    {w}
                  </span>
                ))}
              </div>
              <div className="cal-grid" role="rowgroup">
                {cells.map((d) => {
                  const isCur = sameDay(cursor, d);
                  const isSel = sameDay(selected, d);
                  const off = d.getMonth() !== m;
                  const dis = !inRange(d);
                  return (
                    <button
                      key={d.toISOString()}
                      type="button"
                      role="gridcell"
                      tabIndex={isCur ? 0 : -1}
                      data-focus={isCur ? "1" : undefined}
                      data-date={toISODate(d)}
                      aria-selected={isSel}
                      aria-disabled={dis || undefined}
                      disabled={dis}
                      className={cn("cal-cell", off && "muted", sameDay(today, d) && "today", isSel && "selected", dis && "opacity-30")}
                      onClick={() => pick(d)}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {view === "months" && (
            <div className="cal-mgrid">
              {months.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  className={cn("cal-mcell", selected && selected.getFullYear() === y && selected.getMonth() === i && "selected")}
                  onClick={() => {
                    setCursor(new Date(y, i, 1));
                    setView("days");
                  }}
                >
                  {name.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          {view === "years" && (
            <div className="cal-mgrid">
              {Array.from({ length: 12 }, (_, i) => yearBase + i).map((yy) => (
                <button
                  key={yy}
                  type="button"
                  className={cn("cal-mcell", selected?.getFullYear() === yy && "selected")}
                  onClick={() => {
                    setCursor(new Date(yy, m, 1));
                    setView("months");
                  }}
                >
                  {yy}
                </button>
              ))}
            </div>
          )}

          <div className="cal-foot">
            <button type="button" className="btn ghost sm" onClick={() => pick(new Date())}>
              {t("ui.date.today")}
            </button>
            <button
              type="button"
              className="btn ghost sm"
              disabled={!value}
              onClick={() => {
                onChange("");
                close();
              }}
            >
              {t("ui.date.clear")}
            </button>
          </div>
        </DropdownPanel>
      )}
    </>
  );
}
