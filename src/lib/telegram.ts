/**
 * 106: Telegram Mini App — sayt Telegram ichida (bot menyu tugmasi / web_app tugmasi) ochilganini aniqlash va SDK.
 *
 * Telegram Mini App'ni `#tgWebAppData=…` bilan ochadi; SDK (`telegram-web-app.js`) uni o'qib sessionStorage'ga
 * (`__telegram__initParams`) yozadi — Mini App ichida boshqa sahifaga o'tilganda ham aniqlanadi. SDK faqat Telegram
 * ichida yuklanadi (oddiy brauzerda tashqi skript so'ralmaydi).
 */

export interface TelegramWebApp {
  /** Telegram imzolagan XOM query-string — backend'ga o'zgartirilmasdan yuboriladi */
  initData: string;
  platform?: string;
  version?: string;
  colorScheme?: "light" | "dark";
  ready(): void;
  expand(): void;
  close(): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  isVersionAtLeast?(version: string): boolean;
  MainButton?: {
    setText(text: string): unknown;
    show(): unknown;
    hide(): unknown;
    onClick(cb: () => void): unknown;
    offClick(cb: () => void): unknown;
    showProgress?(leaveActive?: boolean): unknown;
    hideProgress?(): unknown;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const SDK_URL = "https://telegram.org/js/telegram-web-app.js";
/** Telegram ichida ochilgani (sahifalar orasida — sessiya davomida) */
const FLAG = "a365.tg";

export function telegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  const tg = window.Telegram?.WebApp;
  return tg && tg.initData ? tg : null;
}

/** Sayt Telegram Mini App sifatida ochilganmi (SDK yuklanmasdan oldin ham) */
export function launchedInTelegram(): boolean {
  if (typeof window === "undefined") return false;
  if (window.Telegram?.WebApp?.initData) return true;
  if (/[#&]tgWebAppData=/.test(window.location.hash)) return true;
  try {
    return window.sessionStorage.getItem(FLAG) === "1" || !!window.sessionStorage.getItem("__telegram__initParams");
  } catch {
    return false;
  }
}

/**
 * 117: `<head>` da (hydration va har qanday yo'naltirishdan oldin) bajariladi. SDK `#tgWebAppData` ni faqat o'zi
 * yuklangan paytda o'qiydi; SDK keyin yuklanadi va shu orada sahifa yo'naltirilsa (`/tg` → `/catalog`) hash yo'qoladi —
 * `initData` bo'sh qoladi (iPhone). Shuning uchun parametrlar SDK'ning o'z formatida (`__telegram__initParams`, xuddi
 * SDK'dagi `urlParseHashParams` kabi) oldindan saqlanadi — SDK yuklanganda ular bilan birlashtiradi.
 */
export const TELEGRAM_CAPTURE_SCRIPT = `(function(){try{var h=location.hash.replace(/^#/,'');if(h.indexOf('tgWebAppData=')<0)return;var d=function(s){try{return decodeURIComponent(s.replace(/\\+/g,'%20'))}catch(e){return s}};var p={},i=h.indexOf('?');if(i>=0){p._path=d(h.substr(0,i));h=h.substr(i+1)}h.split('&').forEach(function(x){var a=x.split('=');p[d(a[0])]=a[1]==null?null:d(a[1])});var k='__telegram__initParams',o=null;try{o=JSON.parse(sessionStorage.getItem(k))}catch(e){}if(o)for(var n in o)if(typeof p[n]==='undefined')p[n]=o[n];sessionStorage.setItem(k,JSON.stringify(p));sessionStorage.setItem('${FLAG}','1')}catch(e){}})()`;

let sdkPromise: Promise<TelegramWebApp | null> | null = null;

/** SDK'ni yuklash (faqat Telegram ichida); `initData` bo'lmasa — null */
export function loadTelegram(): Promise<TelegramWebApp | null> {
  if (typeof window === "undefined" || !launchedInTelegram()) return Promise.resolve(null);
  try {
    window.sessionStorage.setItem(FLAG, "1");
  } catch {
    /* private rejim */
  }
  if (window.Telegram?.WebApp) return Promise.resolve(telegramWebApp());
  sdkPromise ??= new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => resolve(telegramWebApp());
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return sdkPromise;
}

/**
 * 111: Mini App'da faqat sotib olish va kirish/ro'yxat sahifalari; qolgani (o'qish, kutubxona, profil…) — saytda
 * ("Saytda ochish"). Boshqa manzil ochilsa — katalogga.
 */
const MINI_APP_PATHS = ["/tg", "/catalog", "/cart", "/login", "/register", "/auth/handoff"];
export function miniAppAllowed(pathname: string): boolean {
  return MINI_APP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
