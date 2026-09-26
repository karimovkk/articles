"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Spinner } from "@/components/ui";
import { sessionEndReason } from "@/lib/api";
import { ClientShell } from "./client-shell";

/**
 * Klient tomonidagi guard: foydalanuvchi tekshirilguncha kutadi, yo'q bo'lsa /login.
 * Oddiy sahifalar mijoz qobig'ida (kutish paytida ham — fon va header sakramasin); `chromeless` — reader/admin.
 * `allowGuest` (37, reader): mehmon ham ko'radi (tekin kitob); sessiya tugagan bo'lsa baribir kirish sahifasiga.
 */
export function AppShell({ children, chromeless = false, allowGuest = false }: { children: ReactNode; chromeless?: boolean; allowGuest?: boolean }) {
  const { user, loading, expired } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && (!allowGuest || expired)) router.replace(`/login?next=${encodeURIComponent(pathname)}${expired ? `&reason=${sessionEndReason()}` : ""}`);
  }, [loading, user, expired, pathname, router, allowGuest]);

  const ready = !loading && (!!user || (allowGuest && !expired));
  const waiting = (
    <div className="flex min-h-[50vh] items-center justify-center text-muted">
      <Spinner />
    </div>
  );

  if (chromeless) return ready ? <>{children}</> : <div className="flex min-h-dvh items-center justify-center text-muted">{waiting}</div>;
  return <ClientShell>{ready ? children : waiting}</ClientShell>;
}
