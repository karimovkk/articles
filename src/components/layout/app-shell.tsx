"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { Button, Spinner, cn } from "@/components/ui";
import { env } from "@/lib/env";

const NAV = [
  { href: "/library", label: "Kutubxona" },
  { href: "/profile", label: "Profil" },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Boshqaruv" },
  { href: "/admin/books", label: "Kitoblar" },
  { href: "/admin/users", label: "Foydalanuvchilar" },
  { href: "/admin/access", label: "Ruxsatlar" },
  { href: "/admin/categories", label: "Kategoriyalar" },
  { href: "/admin/audit-logs", label: "Audit" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Klient tomonidagi guard: foydalanuvchi tekshirilguncha kutadi, yo'q bo'lsa /login. */
export function AppShell({ children, chromeless = false }: { children: ReactNode; chromeless?: boolean }) {
  const { user, loading, isAdmin, logout } = useAuth();
  const { theme, toggle } = useTheme();
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

  const displayName = user.full_name || user.email || user.phone || "Foydalanuvchi";

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
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className={cn("rounded-md px-3 py-1.5 text-sm", pathname.startsWith("/admin") ? "bg-bg text-text" : "text-muted hover:text-text")}
              >
                Admin
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggle}
              className="rounded-md px-2 py-1 text-sm text-muted hover:text-text"
              title={theme === "dark" ? "Kunduzgi rejim" : "Tungi rejim"}
              aria-label="Mavzuni almashtirish"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <span className="hidden max-w-[180px] truncate text-sm text-muted md:inline" title={displayName}>
              {displayName}
            </span>
            <Button variant="secondary" size="sm" onClick={() => void logout()}>
              Chiqish
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
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
        )}
        <nav className="flex items-center gap-1 border-t border-border px-2 py-1 sm:hidden">
          {[...NAV, ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : [])].map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn("rounded-md px-3 py-1 text-sm", isActive(pathname, n.href) ? "bg-bg text-text" : "text-muted")}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
