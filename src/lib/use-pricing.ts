"use client";

/**
 * 35: chegirma sozlamasi (`GET /pricing`) — bir marta so'raladi, butun ilova uchun umumiy.
 * `undefined` — yuklanmoqda, `null` — backend qo'llamaydi (savatcha ko'rsatilmaydi), obyekt — savatcha yoqilgan.
 */
import { useSyncExternalStore } from "react";
import { pricingApi, type PricingConfig } from "@/lib/api";

let state: PricingConfig | null | undefined;
let started = false;
const listeners = new Set<() => void>();

function subscribe(l: () => void) {
  listeners.add(l);
  if (!started) {
    started = true;
    void pricingApi.get().then((cfg) => {
      state = cfg;
      listeners.forEach((x) => x());
    });
  }
  return () => {
    listeners.delete(l);
  };
}

export function usePricing(): PricingConfig | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => undefined,
  );
}
