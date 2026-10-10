/**
 * 78: Uzum Market'dagi do'kon havolasi — admin "Integratsiya" sahifasida o'zgartiradi (`PUT /admin/app-settings`,
 * kalit `shop.uzum_url`), hamma public `GET /app-settings` dan oladi. Berilmagan bo'lsa — Uzum'da qidiruv.
 */
export const SHOP_SETTING_KEY = "shop";
export const DEFAULT_SHOP_URL = "https://uzum.uz/uz/search?query=Articles365";
const SAFE = /^https:\/\/[^\s"'<>\\]{4,500}$/i;

export const isShopUrl = (v: unknown): v is string => {
  if (typeof v !== "string" || !SAFE.test(v)) return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

/** Server sozlamalaridan xavfsiz havola (yo'q / noto'g'ri — null) */
export function parseShopUrl(settings: unknown): string | null {
  const shop = (settings as { shop?: { uzum_url?: unknown } } | null)?.shop;
  return isShopUrl(shop?.uzum_url) ? shop.uzum_url : null;
}
