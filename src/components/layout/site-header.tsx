"use client";

/**
 * Foydalanuvchi va public sahifalar uchun umumiy header (`.site-header`):
 * brend, pill-navigatsiya, bildirishnoma, til (qo'lbola menyu), mavzu, foydalanuvchi chipi (qo'lbola menyu).
 * Mehmon uchun — Kirish / Ro'yxatdan o'tish. Mobil: nav pill'lari header ostida gorizontal aylanadi.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, Menu, MenuItem, MenuLabel, MenuSep, buttonClass, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { env } from "@/lib/env";
import { useT, type DictKey } from "@/i18n";
import { LocaleSwitcher } from "@/i18n/locale-switcher";
import { NotificationBell } from "@/components/notifications/bell";

const NAV: Array<{ href: string; label: DictKey; auth?: boolean }> = [
  { href: "/library", label: "nav.library", auth: true },
  { href: "/catalog", label: "nav.catalog" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const { user, loading, isAdmin, logout } = useAuth();
  const { t } = useT();
  const pathname = usePathname();
  const displayName = user ? user.full_name || user.email || user.phone || t("common.user") : "";
  const items = NAV.filter((n) => !n.auth || user);

  const nav = (
    <nav className="site-nav" aria-label={t("nav.library")}>
      {items.map((n) => (
        <Link key={n.href} href={n.href} className={cn(isActive(pathname, n.href) && "active")} aria-current={isActive(pathname, n.href) ? "page" : undefined}>
          {t(n.label)}
        </Link>
      ))}
      {user && (
        <Link href="/profile" className={cn(isActive(pathname, "/profile") && "active")} aria-current={isActive(pathname, "/profile") ? "page" : undefined}>
          {t("nav.profile")}
        </Link>
      )}
      {isAdmin && (
        <Link href="/admin" className="max-[640px]:inline-flex">
          {t("nav.admin")}
          <I.ArrowUpRight size={13} className="ml-1" />
        </Link>
      )}
    </nav>
  );

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href={user ? "/library" : "/catalog"} className="brand" aria-label={env.appName}>
          <span className="brand-mark">A</span>
          <span className="brand-text max-[640px]:hidden">
            <span className="brand-name" style={{ color: "var(--text)" }}>
              {env.appName}
            </span>
          </span>
        </Link>
        <span className="max-[640px]:hidden">{nav}</span>
        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher variant="menu" />
          <ThemeSwitch />
          {user && <NotificationBell />}
          {user ? (
            <Menu
              align="end"
              minWidth={220}
              aria-label={t("ui.userMenu")}
              trigger={(p) => (
                <button {...p} type="button" className="user-chip" data-testid="user-menu" title={displayName}>
                  <Avatar name={displayName} tone="accent" />
                  <span className="user-chip-details">
                    <span className="name">{displayName}</span>
                    <span className="role">{isAdmin ? "ADMIN" : t("common.user")}</span>
                  </span>
                  <I.ChevronDown size={14} className="max-[640px]:hidden text-muted" />
                </button>
              )}
            >
              <MenuLabel>{user.email ?? user.phone ?? displayName}</MenuLabel>
              <MenuItem href="/profile" icon={<I.User size={16} />}>
                {t("nav.profile")}
              </MenuItem>
              <MenuItem href="/notifications" icon={<I.Bell size={16} />}>
                {t("notifications.title")}
              </MenuItem>
              {isAdmin && (
                <MenuItem href="/admin" icon={<I.Settings size={16} />}>
                  {t("nav.admin")}
                </MenuItem>
              )}
              <MenuSep />
              <MenuItem tone="danger" icon={<I.LogOut size={16} />} onSelect={() => void logout()} data-testid="logout">
                {t("nav.logout")}
              </MenuItem>
            </Menu>
          ) : (
            !loading && (
              <>
                <Link href="/login" className={buttonClass("secondary", "sm")}>
                  {t("auth.login")}
                </Link>
                <Link href="/register" className={buttonClass("primary", "sm", "max-[640px]:hidden")}>
                  {t("auth.register")}
                </Link>
              </>
            )
          )}
        </div>
      </div>
      {/* Mobil: pill nav header ostida, gorizontal aylanadi (sahifa kengaymaydi) */}
      <div className="hidden overflow-x-auto px-3 pb-2 max-[640px]:block [scrollbar-width:none]">{nav}</div>
    </header>
  );
}

export function SiteMain({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("site-main", className)}>{children}</main>;
}
