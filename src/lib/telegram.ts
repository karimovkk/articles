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
export const TELEGRAM_CAPTURE_SCRIPT = `(function(){try{var h=location.hash.replace(/^#/,'');if(h.indexOf('tgWebAppData=')<0){if(sessionStorage.getItem('${FLAG}')&&!sessionStorage.getItem('a365.tg.boot'))sessionStorage.setItem('a365.tg.boot','nohash:'+location.pathname);return}sessionStorage.setItem('a365.tg.boot','hash:'+location.pathname);var d=function(s){try{return decodeURIComponent(s.replace(/\\+/g,'%20'))}catch(e){return s}};var p={},i=h.indexOf('?');if(i>=0){p._path=d(h.substr(0,i));h=h.substr(i+1)}h.split('&').forEach(function(x){var a=x.split('=');p[d(a[0])]=a[1]==null?null:d(a[1])});var k='__telegram__initParams',o=null;try{o=JSON.parse(sessionStorage.getItem(k))}catch(e){}if(o)for(var n in o)if(typeof p[n]==='undefined')p[n]=o[n];sessionStorage.setItem(k,JSON.stringify(p));sessionStorage.setItem('${FLAG}','1')}catch(e){}})()`;

let sdkPromise: Promise<TelegramWebApp | null> | null = null;

/** SDK'ni yuklash (faqat Telegram ichida); `initData` bo'lmasa — null */
export function loadTelegram(): Promise<TelegramWebApp | null> {
  if (typeof window === "undefined" || !launchedInTelegram()) return Promise.resolve(null);
  try {
    window.sessionStorage.setItem(FLAG, "1");
  } catch {
    /* private rejim */
  }
  if (window.Telegram?.WebApp) {
    sdkState = "loaded";
    return Promise.resolve(telegramWebApp());
  }
  sdkPromise ??= new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    sdkState = "pending";
    s.onload = () => {
      sdkState = "loaded";
      resolve(telegramWebApp());
    };
    s.onerror = () => {
      sdkState = "error";
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return sdkPromise;
}

/** 118: SDK holati — diagnostika uchun */
let sdkState: "idle" | "pending" | "loaded" | "error" = "idle";

interface TelegramProxyWindow {
  TelegramWebviewProxy?: { postEvent(type: string, data: string): void };
}

/** 118: Telegram ilovasiga buyruq — SDK'ning o'z transporti (iOS/Android: `TelegramWebviewProxy`, Telegram Web: iframe) */
function postTelegramEvent(type: string, data: Record<string, unknown>): boolean {
  const proxy = (window as unknown as TelegramProxyWindow).TelegramWebviewProxy;
  if (proxy) {
    proxy.postEvent(type, JSON.stringify(data));
    return true;
  }
  if (window.parent !== window) {
    window.parent.postMessage(JSON.stringify({ eventType: type, eventData: data }), "https://web.telegram.org");
    return true;
  }
  return false;
}

function telegramBridge(): boolean {
  return !!(window as unknown as TelegramProxyWindow).TelegramWebviewProxy || window.parent !== window;
}

/** Bot / chat havolasini Telegram'ning o'zida ochish va Mini App'ni yopish */
export interface TelegramLinker {
  openTelegramLink(url: string): void;
  close(): void;
}

/**
 * 118: Mini App ichida havola ochuvchi. SDK `initData` siz qolsa ham (iPhone) uning metodlari ishlaydi; SDK umuman
 * bo'lmasa — to'g'ridan Telegram ko'prigi orqali. Oddiy brauzerda (yoki ko'prik yo'q) — `null`.
 */
export function telegramLinker(): TelegramLinker | null {
  if (typeof window === "undefined") return null;
  const tg = window.Telegram?.WebApp;
  if (tg?.initData) return tg;
  if (!launchedInTelegram()) return null;
  if (tg) return tg;
  if (!telegramBridge()) return null;
  return {
    openTelegramLink(url: string) {
      const u = new URL(url);
      if (u.protocol !== "https:" || !/^(www\.)?(t|telegram)\.me$/.test(u.hostname)) throw new Error("WebAppTgUrlInvalid");
      postTelegramEvent("web_app_open_tg_link", { path_full: u.pathname + u.search });
    },
    close() {
      postTelegramEvent("web_app_close", {});
    },
  };
}

/** 118: qisqa diagnostika (qurilmada skrinshot uchun) — maxfiy ma'lumot yo'q (initData'ning faqat uzunligi) */
export function telegramDiag(): string {
  if (typeof window === "undefined") return "";
  const tg = window.Telegram?.WebApp;
  let boot = "-";
  let stored = "-";
  try {
    boot = window.sessionStorage.getItem("a365.tg.boot") ?? "-";
    const p = JSON.parse(window.sessionStorage.getItem("__telegram__initParams") ?? "null") as Record<string, unknown> | null;
    stored = p ? Object.keys(p).filter((k) => k.startsWith("tgWebApp")).map((k) => k.replace("tgWebApp", "")).join(",") || "0" : "-";
  } catch {
    /* private rejim */
  }
  return [
    `sdk=${sdkState}${tg ? "+obj" : ""}`,
    `init=${tg?.initData?.length ?? 0}`,
    `v=${tg?.version ?? "-"}`,
    `p=${tg?.platform ?? "-"}`,
    `proxy=${(window as unknown as TelegramProxyWindow).TelegramWebviewProxy ? 1 : 0}`,
    `frame=${window.parent !== window ? 1 : 0}`,
    `hash=${/tgWebAppData=/.test(window.location.hash) ? 1 : 0}`,
    `boot=${boot}`,
    `ss=${stored}`,
  ].join(" ");
}

/**
 * 111: Mini App'da faqat sotib olish va kirish/ro'yxat sahifalari; qolgani (o'qish, kutubxona, profil…) — saytda
 * ("Saytda ochish"). Boshqa manzil ochilsa — katalogga.
 */
const MINI_APP_PATHS = ["/tg", "/catalog", "/cart", "/login", "/register", "/auth/handoff"];
export function miniAppAllowed(pathname: string): boolean {
  return MINI_APP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
