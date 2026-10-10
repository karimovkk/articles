"use client";

/**
 * 44.8: global ko'rinish — ilova (va login sahifasi) yuklanganda public `GET /app-settings` o'qiladi, `appearance`
 * CSS o'zgaruvchilarga aylantirilib qo'yiladi va keshlanadi (keyingi ochilishda layout skripti uni birinchi
 * chizishdan oldin qo'yadi). Backend endpointi bo'lmasa yoki xato bo'lsa — standart dizayn, hech narsa buzilmaydi.
 */
import { useEffect, useSyncExternalStore } from "react";
import { appApi } from "@/lib/api";
import { applyAppearanceCss, appearanceCss, netTier, parseAppearance, APPEARANCE_STYLE_ID, BG_FULL_CACHED_KEY, type Appearance } from "@/lib/appearance";
import { DEFAULT_SHOP_URL, parseShopUrl } from "@/lib/shop";

let settings: Appearance | null = null;
/** 78: Uzum Market do'kon havolasi (admin bergan; yo'q — null) */
let shopUrl: string | null = null;
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

/**
 * 72: tez internetda asl fon rasmi fonda yuklanadi va tayyor bo'lgach o'rtacha nusxa o'rniga qo'yiladi (`data-net=full`);
 * sekin/o'rtacha internetda — yo'q. Faqat ko'tariladi (yuklangan rasm pastroq sifatga almashtirilmaydi).
 */
let upgrading = false;
function upgradeBackground(a: Appearance | null) {
  if (typeof document === "undefined" || upgrading) return;
  const root = document.documentElement;
  if (root.dataset.net === "full" || netTier() !== "full") return;
  const theme = root.classList.contains("dark") ? "dark" : "light";
  const full = a?.images?.[theme];
  if (!full || !a?.variants?.[theme]?.md || a[`background_${theme}`] !== "upload") return;
  upgrading = true;
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    upgrading = false;
    root.dataset.net = "full";
    try {
      localStorage.setItem(BG_FULL_CACHED_KEY, "1");
    } catch {
      /* private rejim */
    }
  };
  img.onerror = () => {
    upgrading = false;
  };
  img.src = full;
}

export function loadAppearance(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = appApi
    .settings()
    .then((r) => {
      settings = parseAppearance(r.settings, r.images);
      shopUrl = parseShopUrl(r.settings);
      applyAppearance(appearanceCss(settings));
      upgradeBackground(settings);
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
type Snapshot = { settings: Appearance | null; shopUrl: string | null; loaded: boolean };
let snapshot: Snapshot = { settings, shopUrl, loaded };
const getSnapshot = () => {
  if (snapshot.settings !== settings || snapshot.shopUrl !== shopUrl || snapshot.loaded !== loaded) snapshot = { settings, shopUrl, loaded };
  return snapshot;
};
const serverSnapshot: Snapshot = { settings: null, shopUrl: null, loaded: false };

/** Admin "Ko'rinish" sahifasi uchun: serverdagi sozlamalar va qayta yuklash */
export function useAppearanceSettings() {
  const s = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  return { settings: s.settings, loaded: s.loaded, reload: loadAppearance };
}

/** 78: "Buy Real Books" — do'kon havolasi (admin bergan yoki standart — Uzum'da qidiruv) */
export function useShopUrl() {
  const s = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  return { url: s.shopUrl ?? DEFAULT_SHOP_URL, custom: s.shopUrl, reload: loadAppearance };
}

/** Root layout'da bir marta: sozlamalarni yuklab qo'llaydi (hech narsa chizmaydi) */
export function AppearanceProvider() {
  useEffect(() => {
    void loadAppearance();
    // 72: internet tezlashsa — asl rasm (sekinlashsa hech narsa qilinmaydi: yuklangani qoladi)
    const conn = (navigator as Navigator & { connection?: EventTarget }).connection;
    const onChange = () => upgradeBackground(settings);
    conn?.addEventListener?.("change", onChange);
    return () => conn?.removeEventListener?.("change", onChange);
  }, []);
  return null;
}
