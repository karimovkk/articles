"use client";

/**
 * Public qobiq (katalog): mehmon uchun Kirish/Ro'yxat, kirgan foydalanuvchi uchun
 * Kutubxona/Profil/(Admin). Auth tekshiruvi sahifani bloklamaydi.
 */
import type { ReactNode } from "react";
import { SiteHeader, SiteMain } from "./site-header";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <SiteMain>{children}</SiteMain>
    </div>
  );
}
