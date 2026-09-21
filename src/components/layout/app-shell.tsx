"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { Button, Spinner, cn } from "@/components/ui";
import { env } from "@/lib/env";
import { useT, type DictKey } from "@/i18n";
import { LocaleSwitcher } from "@/i18n/locale-switcher";
import { NotificationBell } from "@/components/notifications/bell";

const NAV: Array<{ href: string; label: DictKey }> = [
  { href: "/library", label: "nav.library" },
  { href: "/catalog", label: "nav.catalog" },
  { href: "/profile", label: "nav.profile" },
];

const ADMIN_NAV: Array<{ href: string; label: DictKey }> = [
  { href: "/admin", label: "nav.admin.dashboard" },
  { href: "/admin/books", label: "nav.admin.books" },
  { href: "/admin/users", label: "nav.admin.users" },
  { href: "/admin/access", label: "nav.admin.access" },
  { href: "/admin/orders", label: "nav.admin.orders" },
  { href: "/admin/categories", label: "nav.admin.categories" },
  { href: "/admin/audit-logs", label: "nav.admin.audit" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Klient tomonidagi guard: foydalanuvchi tekshirilguncha kutadi, yo'q bo'lsa /login. */
export function AppShell({ children, chromeless = false }: { children: ReactNode; chromeless?: boolean }) {
  const { user, loading, isAdmin, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { t } = useT();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, pathname, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        <Spinner />
      </div>
    );
  }

  if (chromeless) return <>{children}</>;

  const displayName = user.full_name || user.email || user.phone || t("common.user");

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/library" className="font-semibold tracking-tight text-text">
            {env.appName}
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn("rounded-md px-3 py-1.5 text-sm", isActive(pathname, n.href) ? "bg-bg text-text" : "text-muted hover:text-text")}
              >
                {t(n.label)}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className={cn("rounded-md px-3 py-1.5 text-sm", pathname.startsWith("/admin") ? "bg-bg text-text" : "text-muted hover:text-text")}
              >
                {t("nav.admin")}
              </Link>
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
            <span className="hidden max-w-[180px] truncate text-sm text-muted md:inline" title={displayName}>
              {displayName}
            </span>
            <Button variant="secondary" size="sm" onClick={() => void logout()}>
              {t("nav.logout")}
            </Button>
          </div>
        </div>
        {pathname.startsWith("/admin") && isAdmin && (
          <div className="border-t border-border bg-surface">
            <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-1.5">
              {ADMIN_NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "whitespace-nowrap rounded-md px-3 py-1 text-sm",
                    isActive(pathname, n.href) ? "bg-bg text-text" : "text-muted hover:text-text",
                  )}
                >
                  {t(n.label)}
                </Link>
              ))}
            </div>
          </div>
        )}
        <nav className="flex items-center gap-1 border-t border-border px-2 py-1 sm:hidden">
          {[...NAV, ...(isAdmin ? [{ href: "/admin", label: "nav.admin" as DictKey }] : [])].map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn("rounded-md px-3 py-1 text-sm", isActive(pathname, n.href) ? "bg-bg text-text" : "text-muted")}
            >
              {t(n.label)}
            </Link>
          ))}
          <LocaleSwitcher className="ml-auto" />
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
