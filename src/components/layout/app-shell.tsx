"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Spinner } from "@/components/ui";
import { SiteHeader, SiteMain } from "./site-header";

/** Klient tomonidagi guard: foydalanuvchi tekshirilguncha kutadi, yo'q bo'lsa /login. */
export function AppShell({ children, chromeless = false }: { children: ReactNode; chromeless?: boolean }) {
  const { user, loading, expired } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}${expired ? "&reason=expired" : ""}`);
  }, [loading, user, expired, pathname, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        <Spinner />
      </div>
    );
  }

  if (chromeless) return <>{children}</>;

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <SiteMain>{children}</SiteMain>
    </div>
  );
}
