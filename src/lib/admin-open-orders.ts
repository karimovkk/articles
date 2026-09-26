"use client";

/**
 * Admin: ko'rib chiqilmagan (na tasdiqlangan, na rad etilgan) buyurtmalar soni — `PENDING` (to'lov kutilmoqda) +
 * `AWAITING_REVIEW` (chek yuborilgan, tekshirish kerak). Admin sidebar'i, dashboard va ilova sidebar'idagi "Admin"
 * havolasi shu bitta manbadan o'qiydi: obunachi bor ekan har daqiqada, oynaga qaytilganda va buyurtma
 * tasdiqlangan/rad etilganda (`refreshOpenOrders()`) yangilanadi.
 */
import { useSyncExternalStore } from "react";
import { adminApi } from "@/lib/api";

export interface OpenOrders {
  pending: number;
  awaiting: number;
  total: number;
}

const POLL_MS = 60_000;
let value: OpenOrders | null = null;
let inFlight: Promise<void> | null = null;
let timer: number | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function refreshOpenOrders(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = Promise.all([
    adminApi.orders({ status: "PENDING", page_size: 1 }).then((r) => r.total),
    adminApi.orders({ status: "AWAITING_REVIEW", page_size: 1 }).then((r) => r.total),
  ])
    .then(([pending, awaiting]) => {
      value = { pending, awaiting, total: pending + awaiting };
      emit();
    })
    .catch(() => undefined) // tarmoq/ruxsat xatosi — oldingi qiymat qoladi
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

const onVisible = () => {
  if (document.visibilityState === "visible") void refreshOpenOrders();
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) {
    void refreshOpenOrders();
    timer = window.setInterval(() => void refreshOpenOrders(), POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

const noop = () => () => {};

/** `enabled` — faqat admin uchun (oddiy foydalanuvchida so'rov yuborilmaydi). Yuklanguncha `null`. */
export function useOpenOrders(enabled = true): OpenOrders | null {
  return useSyncExternalStore(
    enabled ? subscribe : noop,
    () => (enabled ? value : null),
    () => null,
  );
}

/** Chiqishda — boshqa admin eski sonni ko'rmasin */
export function clearOpenOrders() {
  value = null;
  emit();
}
