"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Spinner } from "@/components/ui";
import { ClientShell } from "./client-shell";

/**
 * Klient tomonidagi guard: foydalanuvchi tekshirilguncha kutadi, yo'q bo'lsa /login.
 * Oddiy sahifalar mijoz qobig'ida (kutish paytida ham — fon va header sakramasin); `chromeless` — reader/admin.
 */
export function AppShell({ children, chromeless = false }: { children: ReactNode; chromeless?: boolean }) {
  const { user, loading, expired } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}${expired ? "&reason=expired" : ""}`);
  }, [loading, user, expired, pathname, router]);

  const ready = !loading && !!user;
  const waiting = (
    <div className="flex min-h-[50vh] items-center justify-center text-muted">
      <Spinner />
    </div>
  );

  if (chromeless) return ready ? <>{children}</> : <div className="flex min-h-dvh items-center justify-center text-muted">{waiting}</div>;
  return <ClientShell>{ready ? children : waiting}</ClientShell>;
}
