/**
 * Token saqlash: access + refresh (localStorage) va proxy.ts uchun
 * yengil cookie bayrog'i (`a365_auth=1`). Cookie'da token YO'Q — u faqat
 * server tomonda optimistik redirect qilish uchun.
 */
const ACCESS_KEY = "a365.access";
const REFRESH_KEY = "a365.refresh";
const DEVICE_KEY = "a365.device";
export const AUTH_COOKIE = "a365_auth";

const isBrowser = () => typeof window !== "undefined";

let memoryAccess: string | null = null;

export const tokenStore = {
  getAccess(): string | null {
    if (memoryAccess) return memoryAccess;
    if (!isBrowser()) return null;
    memoryAccess = window.localStorage.getItem(ACCESS_KEY);
    return memoryAccess;
  },
  getRefresh(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string | null) {
    memoryAccess = access;
    if (!isBrowser()) return;
    window.localStorage.setItem(ACCESS_KEY, access);
    if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
    document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  },
  clear() {
    memoryAccess = null;
    if (!isBrowser()) return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  },
  /** Qurilma identifikatori (X-Device-Id) — sessiyani qurilmaga bog'lash uchun. */
  getDeviceId(): string {
    if (!isBrowser()) return "server";
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id =
        typeof crypto?.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  },
};
