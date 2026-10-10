/**
 * 44.8: global ko'rinish sozlamalari (admin → `PUT /admin/app-settings`, hamma → public `GET /app-settings`).
 * Server qiymatni erkin JSON sifatida saqlaydi — sxema shu yerda (`settings.appearance`):
 *   primary_color   "#rrggbb" — asosiy (aksent) rang; qolganlari avtomatik: tugma matni (qora/oq), yorug' fondagi
 *                   matn varianti (≥ 4.5:1), qorong'i mavzu varianti (qorong'i fonda ≥ 4.5:1)
 *   background_light / background_dark — "default" | "#rrggbb" | "upload" (46: yuklangan rasm — `images.background[theme]`)
 *                   | "https://…" (eski: rasm havolasi). 49: rang faqat shu mavzuning `BG_PRESETS` to'plamidan — boshqasi
 *                   standart fon sifatida ko'rsatiladi (matn ko'rinmay qolmasin)
 *   font            "manrope" | "system"
 * Natija — `<style id="a365-appearance">` dagi CSS o'zgaruvchilar; birinchi chizishda "sakrash" bo'lmasligi uchun
 * localStorage'da keshlanadi va layout'dagi inline skript uni hydration'dan oldin qo'yadi.
 */

export interface Appearance {
  primary_color?: string | null;
  background_light?: string | null;
  background_dark?: string | null;
  font?: "manrope" | "system" | null;
  /** 46: serverdagi yuklangan fon rasmlari URL'lari (sozlamaga yozilmaydi — `GET /app-settings` `images` dan) */
  images?: { light?: string | null; dark?: string | null };
  /** 72: sekin internet uchun yengil nusxalar (asl rasm o'zgarmaydi): md ≤ 1920 px, sm ≤ 960 px */
  variants?: Partial<Record<AppearanceTheme, { md?: string | null; sm?: string | null }>>;
}

/** 46: fon rasmi nomi (`/admin/app-settings/images/{name}`) — 72: asl holida (siqilmaydi) */
export const BACKGROUND_IMAGE = "background";
/** 72: fon rasmining yengil nusxalari (yuklashda brauzerda tayyorlanadi) */
export const BACKGROUND_VARIANTS = { md: "background_md", sm: "background_sm" } as const;
export const BACKGROUND_VARIANT_SIZES = { md: { maxWidth: 1920, maxHeight: 1920, quality: 0.86 }, sm: { maxWidth: 960, maxHeight: 960, quality: 0.78 } } as const;

/**
 * 72: foydalanuvchi interneti bo'yicha fon sifati — `sm` (tejash / 2G), `md` (3G, aniqlab bo'lmasa — masalan iPhone),
 * `full` (tez: 4G va ≥ 5 Mbit/s) — asl rasm. `<html data-net>` ga yoziladi, CSS shu bo'yicha rasmni tanlaydi.
 */
export type NetTier = "sm" | "md" | "full";
type Conn = { saveData?: boolean; effectiveType?: string; downlink?: number };
export function netTier(): NetTier {
  const c = (typeof navigator !== "undefined" ? (navigator as Navigator & { connection?: Conn }).connection : undefined) ?? null;
  if (!c) return "md";
  if (c.saveData || c.effectiveType === "slow-2g" || c.effectiveType === "2g") return "sm";
  if (c.effectiveType === "3g") return "md";
  if (typeof c.downlink === "number" && c.downlink < 5) return "md";
  return "full";
}
/** Asl rasm shu qurilmada bir marta yuklangan (keshda) — keyingi ochilishda tez internetda darhol asl rasm */
export const BG_FULL_CACHED_KEY = "a365.bg.full";

export type AppearanceTheme = "light" | "dark";
export interface ColorPreset {
  /** i18n: `appearance.c.{id}` */
  id: string;
  hex: string;
}

/** 49: asosiy rang — faqat shu to'plam (har birida tugma yozuvi ≥ 4.5:1) */
export const PRIMARY_PRESETS: readonly ColorPreset[] = [
  { id: "gold", hex: "#f2b705" },
  { id: "orange", hex: "#e8590c" },
  { id: "red", hex: "#e11d48" },
  { id: "violet", hex: "#7c3aed" },
  { id: "blue", hex: "#2563eb" },
  { id: "teal", hex: "#0d9488" },
  { id: "green", hex: "#16a34a" },
  { id: "graphite", hex: "#334155" },
];

/**
 * 49: fon ranglari — har mavzu uchun alohida to'plam. Har biri shu mavzudagi matn, ikkinchi darajali va xira matn
 * (`--text`, `--text-2`, `--muted`) bilan ≥ 4.5:1 — yorug'da faqat och, qorong'ida faqat to'q ranglar.
 */
export const BG_PRESETS: Record<AppearanceTheme, readonly ColorPreset[]> = {
  light: [
    { id: "cream", hex: "#f4f2ec" },
    { id: "white", hex: "#ffffff" },
    { id: "gray", hex: "#f0f0ec" },
    { id: "sky", hex: "#e9f0f8" },
    { id: "mint", hex: "#e8f2ea" },
    { id: "sand", hex: "#f6eee2" },
    { id: "lavender", hex: "#f1edf7" },
    { id: "rose", hex: "#f8ecee" },
  ],
  dark: [
    { id: "graphite", hex: "#0f1412" },
    { id: "black", hex: "#0a0a0a" },
    { id: "slate", hex: "#111827" },
    { id: "midnight", hex: "#0b1426" },
    { id: "forest", hex: "#0e1d16" },
    { id: "coffee", hex: "#1a1511" },
    { id: "plum", hex: "#16122a" },
    { id: "wine", hex: "#1e1114" },
  ],
};

export const findPreset = (list: readonly ColorPreset[], v: unknown): ColorPreset | undefined =>
  typeof v === "string" ? list.find((p) => p.hex === v.toLowerCase()) : undefined;

export const APPEARANCE_CACHE_KEY = "a365.appearance.css";
export const APPEARANCE_STYLE_ID = "a365-appearance";
export const DEFAULT_PRIMARY = "#f2b705";
const LIGHT_SURFACE = "#ffffff";
const DARK_SURFACE = "#151b18";
const INK_DARK = "#14110a";

const HEX = /^#[0-9a-f]{6}$/i;
const SAFE_URL = /^https:\/\/[^\s"'()<>\\]{4,500}$/i;

export const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v);
export const isSafeImageUrl = (v: unknown): v is string => typeof v === "string" && SAFE_URL.test(v);
/** 46: backend bergan rasm URL'i — to'liq https yoki shu sayt ichidagi yo'l (`/api/v1/app-settings/images/…?v=`) */
const SAFE_PATH = /^\/[^\s"'()<>\\]{1,500}$/;
export const isSafeAssetUrl = (v: unknown): v is string => isSafeImageUrl(v) || (typeof v === "string" && SAFE_PATH.test(v) && !v.startsWith("//"));

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("")}`;
}
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG kontrast nisbati */
export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
function mix(hex: string, to: string, t: number): string {
  const a = rgb(hex);
  const b = rgb(to);
  return toHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}
/** `hex` ni `toward` tomon qadam-baqadam surib, `surface` ga nisbatan `min` kontrastga yetkazadi */
function ensureContrast(hex: string, surface: string, min: number, toward: string): string {
  let c = hex;
  for (let i = 1; i <= 20 && contrast(c, surface) < min; i++) c = mix(hex, toward, i * 0.05);
  return c;
}

export interface DerivedColors {
  accent: string;
  /** Aksent ustidagi matn (tugma yozuvi) */
  contrastText: string;
  /** Yorug' fonda matn/belgi sifatida (≥ 4.5:1) */
  ink: string;
  /** Qorong'i mavzudagi aksent (qorong'i fonda ≥ 4.5:1) */
  darkAccent: string;
  darkContrastText: string;
}

export function deriveColors(primary: string): DerivedColors {
  const accent = primary.toLowerCase();
  const contrastText = contrast(accent, INK_DARK) >= contrast(accent, "#ffffff") ? INK_DARK : "#ffffff";
  const ink = ensureContrast(accent, LIGHT_SURFACE, 4.5, "#000000");
  const darkAccent = ensureContrast(accent, DARK_SURFACE, 4.5, "#ffffff");
  const darkContrastText = contrast(darkAccent, INK_DARK) >= contrast(darkAccent, "#ffffff") ? INK_DARK : "#ffffff";
  return { accent, contrastText, ink, darkAccent, darkContrastText };
}

function bgCss(value: string | null | undefined, uploaded: string | null | undefined, theme: AppearanceTheme, variants?: { md?: string | null; sm?: string | null }): string {
  const html = theme === "dark" ? "html.dark" : "html:not(.dark)";
  const base = `${html} .client-bg`;
  // 49: rang — faqat shu mavzu to'plamidan; rasm uchun mo'ljallangan parda o'chadi, fon butun ekranni qoplaydi
  const preset = findPreset(BG_PRESETS[theme], value);
  if (preset) return `${base}::before{background:${preset.hex} !important;height:100% !important;}${base}::after{background:none !important;}`;
  const url = value === "upload" ? uploaded : value;
  if (!isSafeAssetUrl(url)) return "";
  // 72: yuklangan rasm — internetga qarab: o'rtacha nusxa (standart), sekin — kichik, tez — asl rasm. Faqat mos
  // kelgan qoidadagi rasm yuklab olinadi (CSS: bitta element — bitta `background-image`)
  const md = value === "upload" && isSafeAssetUrl(variants?.md) ? variants.md : null;
  const sm = value === "upload" && isSafeAssetUrl(variants?.sm) ? variants.sm : null;
  const out = [`${base}::before{background:url("${md ?? url}") center top / cover no-repeat !important;}`];
  if (sm) out.push(`${html}[data-net="sm"] .client-bg::before{background-image:url("${sm}") !important;}`);
  if (md) out.push(`${html}[data-net="full"] .client-bg::before{background-image:url("${url}") !important;}`);
  return out.join("");
}

/** Sozlamalardan CSS (bo'sh satr — hammasi standart) */
export function appearanceCss(a: Appearance | null | undefined): string {
  if (!a) return "";
  const out: string[] = [];
  if (isHex(a.primary_color) && a.primary_color.toLowerCase() !== DEFAULT_PRIMARY) {
    const c = deriveColors(a.primary_color);
    out.push(`:root{--accent:${c.accent};--accent-contrast:${c.contrastText};--accent-ink:${c.ink};}`);
    out.push(`:root.dark,.dark{--accent:${c.darkAccent};--accent-contrast:${c.darkContrastText};--accent-ink:${c.darkAccent};}`);
  }
  if (a.font === "system") out.push(`:root{--font-sans:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;}`);
  out.push(bgCss(a.background_light, a.images?.light, "light", a.variants?.light));
  out.push(bgCss(a.background_dark, a.images?.dark, "dark", a.variants?.dark));
  return out.filter(Boolean).join("\n");
}

/** Server javobidan `appearance` ni xavfsiz ajratib olish (begona maydonlar/noto'g'ri turlar tashlanadi) */
export function parseAppearance(settings: unknown, images?: Record<string, Partial<Record<"light" | "dark", string>>> | null): Appearance | null {
  const raw = (settings as { appearance?: unknown } | null)?.appearance;
  const bgImg = images?.[BACKGROUND_IMAGE];
  const imgs = { light: isSafeAssetUrl(bgImg?.light) ? bgImg.light : null, dark: isSafeAssetUrl(bgImg?.dark) ? bgImg.dark : null };
  // 72: yengil nusxalar (bo'lmasa — hammaga asl rasm)
  const safe = (v: unknown) => (isSafeAssetUrl(v) ? v : null);
  const md = images?.[BACKGROUND_VARIANTS.md];
  const sm = images?.[BACKGROUND_VARIANTS.sm];
  const variants = { light: { md: safe(md?.light), sm: safe(sm?.light) }, dark: { md: safe(md?.dark), sm: safe(sm?.dark) } };
  if (!raw || typeof raw !== "object") return imgs.light || imgs.dark ? { images: imgs, variants } : null;
  const r = raw as Record<string, unknown>;
  // 49: rang — faqat shu mavzu to'plamidan (eski ixtiyoriy/xavfli qiymat → standart)
  const bg = (v: unknown, theme: AppearanceTheme) =>
    v === "default" || v === "upload" || isSafeImageUrl(v) ? (v as string) : (findPreset(BG_PRESETS[theme], v)?.hex ?? null);
  return {
    primary_color: isHex(r.primary_color) ? r.primary_color : null,
    background_light: bg(r.background_light, "light"),
    background_dark: bg(r.background_dark, "dark"),
    font: r.font === "system" ? "system" : r.font === "manrope" ? "manrope" : null,
    images: imgs,
    variants,
  };
}

/** CSS'ni sahifaga qo'yish (va keyingi ochilish uchun keshlash) */
export function applyAppearanceCss(css: string) {
  if (typeof document === "undefined") return;
  let el = document.getElementById(APPEARANCE_STYLE_ID) as HTMLStyleElement | null;
  if (!css) {
    el?.remove();
  } else {
    if (!el) {
      el = document.createElement("style");
      el.id = APPEARANCE_STYLE_ID;
      document.head.appendChild(el);
    }
    if (el.textContent !== css) el.textContent = css;
  }
  try {
    // 72: rasm(lar) o'zgardi — "asl rasm keshda" belgisi endi eskirgan
    if (localStorage.getItem(APPEARANCE_CACHE_KEY) !== css) localStorage.removeItem(BG_FULL_CACHED_KEY);
    if (css) localStorage.setItem(APPEARANCE_CACHE_KEY, css);
    else localStorage.removeItem(APPEARANCE_CACHE_KEY);
  } catch {
    /* private rejim */
  }
}

/**
 * Birinchi chizishdan oldin (layout `<head>` dagi inline skript) — keshlangan CSS va 72: internet darajasi
 * (`data-net`; `netTier` bilan bir xil qoida): sekin — kichik nusxa, aks holda o'rtacha; asl rasm faqat tez internetda
 * va u shu qurilmada avval yuklangan bo'lsa darhol (bo'lmasa provayder uni fonda yuklab, keyin almashtiradi).
 */
export const APPEARANCE_SCRIPT = `(function(){try{var n=navigator.connection,t='md';if(n){if(n.saveData||n.effectiveType==='slow-2g'||n.effectiveType==='2g')t='sm';else if(n.effectiveType!=='3g'&&!(typeof n.downlink==='number'&&n.downlink<5)&&localStorage.getItem('${BG_FULL_CACHED_KEY}')==='1')t='full'}document.documentElement.setAttribute('data-net',t);var c=localStorage.getItem('${APPEARANCE_CACHE_KEY}');if(c){var s=document.createElement('style');s.id='${APPEARANCE_STYLE_ID}';s.textContent=c;document.head.appendChild(s)}}catch(e){}})()`;
