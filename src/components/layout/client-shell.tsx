"use client";

/**
 * Mijoz qobig'i (16.2) — katalog, kutubxona, kitob, bildirishnoma, profil sahifalari uchun:
 *  - fon: `public/bg/article-*.webp` (`.client-bg`, position: fixed + qoraytiruvchi gradient);
 *  - header: 365 emblema, markazda nav, qidiruv, til, mavzu, qo'ng'iroq, profil menyusi (mehmon — Kirish/Ro'yxat);
 *  - sidebar: nav (+ o'qilmagan soni), kategoriyalar (kitoblar soni bilan), promo karta; <1024px — drawer.
 * Reader va auth sahifalari bu qobiqdan foydalanmaydi.
 */
import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, Menu, MenuItem, MenuLabel, MenuSep, buttonClass, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { NotificationBell } from "@/components/notifications/bell";
import { YearDayChip, YearEmblem } from "./year-progress";
import { useUnreadCount } from "@/components/notifications/use-unread-count";
import { useCatalogCategories } from "@/lib/catalog-categories";
import { env } from "@/lib/env";
import { useT, type DictKey } from "@/i18n";
import { LocaleSwitcher } from "@/i18n/locale-switcher";

type NavItem = { href: string; label: DictKey; icon: ReactNode; auth?: boolean; badge?: number | null };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ClientShell({ children }: { children: ReactNode }) {
  const { t } = useT();
  const pathname = usePathname();
  // Drawer ochilgan marshrut saqlanadi — marshrut o'zgarsa o'z-o'zidan yopiladi
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    // `data-route` — fon rasmi katalogda keng band, ichki sahifalarda yupqa tasma (18.1)
    <div className="client" data-route={pathname === "/catalog" ? "catalog" : undefined}>
      <div className="client-bg" aria-hidden />
      <ClientHeader menuOpen={open} onMenu={() => setOpenAt(open ? null : pathname)} />
      <div className="client-body">
        {open && <button type="button" className="client-backdrop" aria-label={t("ui.nav.closeMenu")} onClick={() => setOpenAt(null)} />}
        <ClientSidebar open={open} onNavigate={() => setOpenAt(null)} />
        <main className="client-main">{children}</main>
      </div>
    </div>
  );
}

function ClientHeader({ menuOpen, onMenu }: { menuOpen: boolean; onMenu: () => void }) {
  const { user, loading, isAdmin, logout } = useAuth();
  const { t } = useT();
  const pathname = usePathname();
  const displayName = user ? user.full_name || user.email || user.phone || t("common.user") : "";
  const nav: Array<{ href: string; label: DictKey; auth?: boolean; wide?: boolean }> = [
    { href: "/catalog", label: "nav.catalog" },
    { href: "/library", label: "nav.library", auth: true },
    // 33: 1280px dan tor header'da joy yo'q (brend markazda) — u yerda sidebar'da bor
    { href: "/vocabulary", label: "nav.vocabulary", auth: true, wide: true },
    { href: "/profile", label: "nav.profile", auth: true },
  ];

  return (
    <header className="client-header">
      <button type="button" className="icon-btn plain client-burger" onClick={onMenu} aria-expanded={menuOpen} aria-label={t(menuOpen ? "ui.nav.closeMenu" : "ui.nav.openMenu")} data-testid="client-menu">
        {menuOpen ? <I.X size={20} /> : <I.Menu size={20} />}
      </button>
      <nav className="client-nav" aria-label={t("client.nav")}>
        {nav
          .filter((n) => !n.auth || user)
          .map((n) => (
            <Link key={n.href} href={n.href} className={cn(isActive(pathname, n.href) && "active", n.wide && "max-[1279px]:!hidden")} aria-current={isActive(pathname, n.href) ? "page" : undefined}>
              {t(n.label)}
            </Link>
          ))}
        {isAdmin && (
          <Link href="/admin" prefetch={false}>
            {t("nav.admin")}
            <I.ArrowUpRight size={13} />
          </Link>
        )}
      </nav>

      {/* 25/30: brend "365" markazda — yilning nechanchi kuni doim ko'rinib turadi, halqa vaqti-vaqti bilan yonadi */}
      <div className="client-brand-wrap">
        <Link href={user ? "/library" : "/catalog"} className="client-brand" aria-label={env.appName} data-testid="header-brand">
          <YearEmblem />
          <span className="client-brand-name">{env.appName}</span>
        </Link>
        <YearDayChip className="max-[400px]:hidden min-[641px]:max-[1100px]:hidden" />
      </div>

      <div className="client-actions">
        <Link
          href="/catalog#search"
          onClick={(e) => {
            // Katalogning o'zida — sahifa qayta yuklanmaydi, qidiruv maydoniga fokus
            if (pathname !== "/catalog") return;
            e.preventDefault();
            window.dispatchEvent(new Event("a365:focus-search"));
          }}
          className="icon-btn plain max-[640px]:hidden"
          aria-label={t("client.search")}
          title={t("client.search")}
          data-testid="header-search"
        >
          <I.Search size={18} />
        </Link>
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
                <I.ChevronDown size={14} className="text-muted max-[1180px]:hidden" />
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
              <Link href="/login" prefetch={false} className={buttonClass("secondary", "sm")}>
                {t("auth.login")}
              </Link>
              <Link href="/register" prefetch={false} className={buttonClass("primary", "sm", "max-[640px]:hidden")}>
                {t("auth.register")}
              </Link>
            </>
          )
        )}
      </div>
    </header>
  );
}

function ClientSidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { user, loading, isAdmin } = useAuth();
  const { t } = useT();
  const pathname = usePathname();
  const unread = useUnreadCount(!!user);
  const items: NavItem[] = [
    { href: "/catalog", label: "nav.catalog", icon: <I.Grid size={19} /> },
    { href: "/library", label: "nav.library", icon: <I.Library size={19} />, auth: true },
    { href: "/vocabulary", label: "nav.vocabulary", icon: <I.Languages size={19} />, auth: true },
    { href: "/notifications", label: "notifications.title", icon: <I.Bell size={19} />, auth: true, badge: unread },
    { href: "/profile", label: "nav.profile", icon: <I.User size={19} />, auth: true },
  ];

  return (
    <aside className={cn("client-sidebar", open && "open")} aria-label={t("client.nav")}>
      <nav className="client-side-nav">
        {items
          .filter((n) => !n.auth || user)
          .map((n) => (
            <Link key={n.href} href={n.href} onClick={onNavigate} className={cn("side-link", isActive(pathname, n.href) && "active")} aria-current={isActive(pathname, n.href) ? "page" : undefined}>
              {n.icon}
              <span>{t(n.label)}</span>
              {!!n.badge && (
                <span className="side-badge" data-testid="nav-unread">
                  {n.badge > 99 ? "99+" : n.badge}
                </span>
              )}
            </Link>
          ))}
        {isAdmin && (
          <Link href="/admin" prefetch={false} onClick={onNavigate} className="side-link">
            <I.Settings size={19} />
            <span>{t("nav.admin")}</span>
            <I.ArrowUpRight size={14} className="ml-auto opacity-60" />
          </Link>
        )}
        {!user && !loading && (
          <Link href="/login" prefetch={false} onClick={onNavigate} className={cn("side-link", isActive(pathname, "/login") && "active")}>
            <I.LogOut size={19} className="rotate-180" />
            <span>{t("auth.login")}</span>
          </Link>
        )}
      </nav>

      <Suspense fallback={null}>
        <SidebarCategories onNavigate={onNavigate} />
      </Suspense>

      <Link href={user ? "/library" : "/catalog"} prefetch={false} onClick={onNavigate} className="client-promo" aria-label={t("client.promoText")}>
        <span className="client-promo-title">{t("client.promoTitle")}</span>
        <span className="client-promo-text">{t("client.promoText")}</span>
        <span className="client-promo-go" aria-hidden>
          <I.ArrowRight size={16} />
        </span>
      </Link>
    </aside>
  );
}

/** Kategoriyalar ro'yxati — kitoblar soni bilan; faol kategoriya `/catalog?category=` dan. */
const CAT_ICONS = [I.Sparkles, I.Layers, I.Bookmark, I.Star, I.Activity, I.Hash, I.Tag, I.BookOpen];

function SidebarCategories({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useT();
  const pathname = usePathname();
  const params = useSearchParams();
  const categories = useCatalogCategories();
  const active = pathname === "/catalog" ? (params.get("category") ?? "") : null;
  if (!categories?.length) return null;

  return (
    <div className="client-cats" data-testid="side-categories">
      <div className="client-cats-head">
        <span>{t("client.categories")}</span>
        <Link href="/catalog" onClick={onNavigate}>
          {t("client.viewAll")}
          <I.ArrowRight size={13} />
        </Link>
      </div>
      <ul>
        {categories.map((c, i) => {
          const Icon = CAT_ICONS[i % CAT_ICONS.length];
          const on = active === c.id;
          return (
            <li key={c.id}>
              <Link href={`/catalog?category=${c.id}`} prefetch={false} onClick={onNavigate} className={cn("side-cat", on && "active")} aria-current={on ? "page" : undefined} data-testid="side-category">
                <Icon size={17} />
                <span className="truncate">{c.name}</span>
                {c.count !== null && <span className="count">{c.count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
