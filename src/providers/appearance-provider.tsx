"use client";

/**
 * 44.8: global ko'rinish — ilova (va login sahifasi) yuklanganda public `GET /app-settings` o'qiladi, `appearance`
 * CSS o'zgaruvchilarga aylantirilib qo'yiladi va keshlanadi (keyingi ochilishda layout skripti uni birinchi
 * chizishdan oldin qo'yadi). Backend endpointi bo'lmasa yoki xato bo'lsa — standart dizayn, hech narsa buzilmaydi.
 */
import { useEffect, useSyncExternalStore } from "react";
import { appApi } from "@/lib/api";
import { applyAppearanceCss, appearanceCss, parseAppearance, APPEARANCE_STYLE_ID, type Appearance } from "@/lib/appearance";

let settings: Appearance | null = null;
let loaded = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** CSS'ni qo'yish; `persist: false` — faqat oldindan ko'rish (keshga yozilmaydi) */
export function applyAppearance(css: string, opts: { persist?: boolean } = {}) {
  if (opts.persist === false) {
    if (typeof document === "undefined") return;
    let el = document.getElementById(APPEARANCE_STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = APPEARANCE_STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = css;
    return;
  }
  applyAppearanceCss(css);
}

export function loadAppearance(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = appApi
    .settings()
    .then((r) => {
      settings = parseAppearance(r.settings);
      applyAppearance(appearanceCss(settings));
    })
    .catch(() => undefined) // endpoint yo'q / tarmoq — keshdagi (yoki standart) ko'rinish qoladi
    .finally(() => {
      loaded = true;
      inFlight = null;
      emit();
    });
  return inFlight;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
let snapshot: { settings: Appearance | null; loaded: boolean } = { settings, loaded };
const getSnapshot = () => {
  if (snapshot.settings !== settings || snapshot.loaded !== loaded) snapshot = { settings, loaded };
  return snapshot;
};
const serverSnapshot: { settings: Appearance | null; loaded: boolean } = { settings: null, loaded: false };

/** Admin "Ko'rinish" sahifasi uchun: serverdagi sozlamalar va qayta yuklash */
export function useAppearanceSettings() {
  const s = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  return { settings: s.settings, loaded: s.loaded, reload: loadAppearance };
}

/** Root layout'da bir marta: sozlamalarni yuklab qo'llaydi (hech narsa chizmaydi) */
export function AppearanceProvider() {
  useEffect(() => {
    void loadAppearance();
  }, []);
  return null;
}
