"use client";

/**
 * Public qobiq (katalog): mehmon uchun Kirish/Ro'yxat, kirgan foydalanuvchi uchun
 * Kutubxona/Profil/(Admin). Auth tekshiruvi sahifani bloklamaydi.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { buttonClass, cn } from "@/components/ui";
import { env } from "@/lib/env";
import { useT } from "@/i18n";
import { LocaleSwitcher } from "@/i18n/locale-switcher";
import { NotificationBell } from "@/components/notifications/bell";

export function PublicShell({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  const { t } = useT();
  const pathname = usePathname();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/catalog" className="font-semibold tracking-tight text-text">
            {env.appName}
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/catalog" className={cn("rounded-md px-3 py-1.5 text-sm", pathname.startsWith("/catalog") ? "bg-bg text-text" : "text-muted hover:text-text")}>
              {t("nav.catalog")}
            </Link>
            {user && (
              <>
                <Link href="/library" className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-text">
                  {t("nav.library")}
                </Link>
                <Link href="/profile" className="hidden rounded-md px-3 py-1.5 text-sm text-muted hover:text-text sm:inline">
                  {t("nav.profile")}
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="hidden rounded-md px-3 py-1.5 text-sm text-muted hover:text-text sm:inline">
                    {t("nav.admin")}
                  </Link>
                )}
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LocaleSwitcher className="hidden sm:inline-flex" />
            <NotificationBell />
            <button
              onClick={toggle}
              className="rounded-md px-2 py-1 text-sm text-muted hover:text-text"
              title={theme === "dark" ? t("theme.light") : t("theme.dark")}
              aria-label={t("theme.toggle")}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            {!loading && !user && (
              <>
                <Link href="/login" className={buttonClass("secondary", "sm")}>
                  {t("auth.login")}
                </Link>
                <Link href="/register" className={buttonClass("primary", "sm", "hidden sm:inline-flex")}>
                  {t("auth.register")}
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end border-t border-border px-2 py-1 sm:hidden">
          <LocaleSwitcher />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
