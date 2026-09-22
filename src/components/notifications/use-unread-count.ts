"use client";

/**
 * O'qilmagan bildirishnomalar soni — umumiy store (header qo'ng'irog'i va sidebar badge bitta so'rovdan foydalanadi):
 * `/notifications/unread-count` 60 s da, sahifaga qaytilganda va `a365:notifications-changed` hodisasida yangilanadi.
 * Oxirgi obunachi ketganda (logout) to'xtaydi va qiymat tozalanadi.
 */
import { useEffect, useSyncExternalStore } from "react";
import { notificationsApi } from "@/lib/api";

const POLL_MS = 60_000;

let count: number | null = null;
let users = 0;
let stop: (() => void) | null = null;
const listeners = new Set<() => void>();

function set(next: number | null) {
  count = next;
  listeners.forEach((l) => l());
}

/** Qiymatni hozir qayta so'rash (masalan, marshrut o'zgarganda). */
export function refreshUnreadCount() {
  if (users > 0) notificationsApi.unreadCount().then(set, () => undefined);
}

function start() {
  refreshUnreadCount();
  const timer = window.setInterval(refreshUnreadCount, POLL_MS);
  const onVisible = () => document.visibilityState === "visible" && refreshUnreadCount();
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("a365:notifications-changed", refreshUnreadCount);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("a365:notifications-changed", refreshUnreadCount);
  };
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useUnreadCount(enabled: boolean): number | null {
  const value = useSyncExternalStore(
    subscribe,
    () => count,
    () => null,
  );
  useEffect(() => {
    if (!enabled) return;
    users += 1;
    if (users === 1) stop = start();
    return () => {
      users -= 1;
      if (users === 0) {
        stop?.();
        stop = null;
        set(null);
      }
    };
  }, [enabled]);
  return enabled ? value : null;
}
