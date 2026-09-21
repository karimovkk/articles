/**
 * Ko'p tillilik (FE-7.2, S-6): uz (lotin) / ru / en.
 *
 * Ilova to'liq auth'langan SPA (noindex) — URL-prefiksli marshrutlash o'rniga
 * tanlangan til `localStorage` da saqlanadi va `useSyncExternalStore` orqali
 * o'qiladi (ThemeProvider bilan bir xil yondashuv). Serverda default `uz`;
 * hidratsiyada saqlangan til sinxron qo'llanadi.
 *
 *  - `t(key, params)`      — React'dan tashqarida (API klient, tekshiruvlar)
 *  - `useT()`              — komponentlarda; til o'zgarsa qayta render bo'ladi
 *  - `getLocaleTag()`      — Intl (sana) uchun BCP-47 teg
 */
import { useCallback, useSyncExternalStore } from "react";
import { uz } from "./dict/uz";
import { ru } from "./dict/ru";
import { en } from "./dict/en";
import type { Dict, DictKey } from "./dict/types";

export type { DictKey } from "./dict/types";
export type Locale = "uz" | "ru" | "en";

export const LOCALES: ReadonlyArray<{ code: Locale; label: string; tag: string }> = [
  { code: "uz", label: "O'zbekcha", tag: "uz-UZ" },
  { code: "ru", label: "Русский", tag: "ru-RU" },
  { code: "en", label: "English", tag: "en-GB" },
];
export const DEFAULT_LOCALE: Locale = "uz";
const STORAGE_KEY = "a365.locale";

const DICTS: Record<Locale, Dict> = { uz, ru, en };

export function isLocale(v: unknown): v is Locale {
  return v === "uz" || v === "ru" || v === "en";
}

/* ---------- store ---------- */
const listeners = new Set<() => void>();
let cached: Locale | null = null;

/** Saqlangan til; yo'q bo'lsa default `uz` (auditoriya mahalliy — brauzer tilidan taxmin qilinmaydi). */
function detect(): Locale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* localStorage mavjud emas */
  }
  return DEFAULT_LOCALE;
}

export function getLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  if (!cached) cached = detect();
  return cached;
}

export function setLocale(l: Locale) {
  cached = l;
  try {
    window.localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* private rejim */
  }
  document.documentElement.lang = l;
  listeners.forEach((cb) => cb());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getServerSnapshot = (): Locale => DEFAULT_LOCALE;

export function getLocaleTag(): string {
  return LOCALES.find((l) => l.code === getLocale())?.tag ?? "uz-UZ";
}

/**
 * Raqam formati — ICU'ga bog'liq emas (Chrome `uz-UZ` uchun "45,000", Node "45 000" beradi):
 * uz/ru → guruhlar bo'linmas bo'sh joy bilan, en → vergul. Kasr qismi 2 xonagacha.
 */
export function formatNumber(n: number, locale: Locale = getLocale()): string {
  if (!Number.isFinite(n)) return "";
  const [int, frac] = Math.abs(n).toFixed(Number.isInteger(n) ? 0 : 2).split(".");
  const sep = locale === "en" ? "," : "\u00a0";
  const dec = locale === "en" ? "." : ",";
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return `${n < 0 ? "-" : ""}${grouped}${frac ? dec + frac : ""}`;
}

/* ---------- tarjima ---------- */
export type Params = Record<string, string | number>;

function interpolate(s: string, params?: Params): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

export function translate(locale: Locale, key: DictKey, params?: Params): string {
  const s = DICTS[locale][key] ?? DICTS[DEFAULT_LOCALE][key] ?? key;
  return interpolate(s, params);
}

/** React'dan tashqarida: joriy til bo'yicha. */
export function t(key: DictKey, params?: Params): string {
  return translate(getLocale(), key, params);
}

export function hasKey(key: string): key is DictKey {
  return key in uz;
}

/** Komponentlar uchun: `{ t, locale, setLocale }` — til o'zgarsa qayta render. */
export function useT() {
  const locale = useSyncExternalStore(subscribe, getLocale, getServerSnapshot);
  const tt = useCallback((key: DictKey, params?: Params) => translate(locale, key, params), [locale]);
  return { t: tt, locale, setLocale };
}
