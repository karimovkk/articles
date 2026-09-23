"use client";

/**
 * Sessiya keshi (26.4): kam o'zgaradigan javoblarni (kategoriyalar, kutubxona ro'yxati) sahifalar orasida
 * qayta so'ramaslik uchun. `sessionStorage` — tab yopilsa tozalanadi; TTL bilan eskirganda qayta so'raladi.
 */
export function sessionGet<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw) as { t: number; v: T };
    return Date.now() - t < ttlMs ? v : null;
  } catch {
    return null;
  }
}

export function sessionSet<T>(key: string, value: T): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    /* kvota to'lgan yoki taqiqlangan — kesh ishlatilmaydi */
  }
}

/** Brauzer bo'sh turganda bajarish (asosiy so'rovlarga xalaqit bermasin) */
export function whenIdle(fn: () => void, timeout = 1500): void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout });
  else window.setTimeout(fn, 300);
}
