"use client";

/**
 * 44.6: kunlik o'qish seriyasi — header "🔥 N", menyu va reyting sahifasi bitta manbadan o'qiydi.
 * Obunachi bor ekan yuklanadi, oynaga qaytilganda va o'qish saqlangach (`refreshStreak`) yangilanadi.
 */
import { useSyncExternalStore } from "react";
import { streakApi, type Streak } from "@/lib/api";

let value: Streak | null = null;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function refreshStreak(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = streakApi
    .me()
    .then((s) => {
      value = s;
      emit();
    })
    .catch(() => undefined) // backend qo'llamasa / tarmoq — chip ko'rinmaydi
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

const onVisible = () => {
  if (document.visibilityState === "visible") void refreshStreak();
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) {
    if (!value) void refreshStreak();
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) document.removeEventListener("visibilitychange", onVisible);
  };
}
const noop = () => () => {};

/** `enabled` — faqat kirgan foydalanuvchida. Yuklanguncha (yoki backend yo'q bo'lsa) `null`. */
export function useStreak(enabled = true): Streak | null {
  return useSyncExternalStore(
    enabled ? subscribe : noop,
    () => (enabled ? value : null),
    () => null,
  );
}

export function clearStreak() {
  value = null;
  emit();
}
