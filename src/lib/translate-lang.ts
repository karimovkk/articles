"use client";

/**
 * 47: lug'atdagi avtomatik tarjima tili — o'quvchi o'zi tanlaydi (sayt interfeysi tili EMAS). Tanlov eslab qolinadi
 * (keyingi so'zlarda shu tilga avtomatik tarjima); hali tanlanmagan bo'lsa — `null` (tarjima so'ralmaydi).
 */
import { useSyncExternalStore } from "react";
import type { TranslateLang } from "@/lib/api";

const KEY = "a365.vocab.lang";
const LANGS: TranslateLang[] = ["uz", "ru", "en"];
const listeners = new Set<() => void>();

function read(): TranslateLang | null {
  try {
    const v = localStorage.getItem(KEY);
    return LANGS.includes(v as TranslateLang) ? (v as TranslateLang) : null;
  } catch {
    return null;
  }
}

export function setTranslateLang(lang: TranslateLang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* private rejim — shu sessiyada baribir ishlaydi */
  }
  memory = lang;
  listeners.forEach((l) => l());
}

let memory: TranslateLang | null | undefined;
const getSnapshot = () => (memory === undefined ? (memory = read()) : memory);
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useTranslateLang(): TranslateLang | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
