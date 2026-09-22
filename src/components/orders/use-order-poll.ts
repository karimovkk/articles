"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Buyurtma holatini kuzatish (oqim v1.0): admin chekni Telegram'da tasdiqlaydi/rad etadi, frontend esa
 * `GET /orders` orqali yangilanadi. `enabled` (AWAITING_REVIEW bor) bo'lsa — har `ms` da, sahifaga qaytilganda
 * (focus/visibility) va bildirishnomalar o'zgarganda `refresh` chaqiriladi.
 */
export function useOrderPoll(enabled: boolean, refresh: () => void, ms = 20_000) {
  const ref = useRef(refresh);
  useLayoutEffect(() => {
    ref.current = refresh;
  });
  useEffect(() => {
    if (!enabled) return;
    const tick = () => ref.current();
    const id = window.setInterval(tick, ms);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    window.addEventListener("a365:notifications-changed", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
      window.removeEventListener("a365:notifications-changed", tick);
    };
  }, [enabled, ms]);
}
