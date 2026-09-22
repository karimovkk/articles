"use client";

/**
 * Public qobiq (katalog): mijoz qobig'i — mehmon uchun Kirish/Ro'yxat, kirgan foydalanuvchi uchun to'liq nav.
 * Auth tekshiruvi sahifani bloklamaydi.
 */
import type { ReactNode } from "react";
import { ClientShell } from "./client-shell";

export function PublicShell({ children }: { children: ReactNode }) {
  return <ClientShell>{children}</ClientShell>;
}
