"use client";

/**
 * Admin qobig'i (ilhom: Alfa-FCUI "Floodlight"): qora ramka + suzuvchi varaq.
 *  - Sidebar: bo'limlar, faol element aksent bilan, yig'iladigan (localStorage `a365.adminNav`), <900px — drawer.
 *  - Topbar: crumbs (bo'lim + sahifa nomi — `useAdminCrumb`), bildirishnoma, til, mavzu, ilovaga qaytish.
 * Auth/rol tekshiruvi — `AppShell chromeless` + `AdminGuard` (layout'da).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, IconButton, Menu, MenuItem, MenuLabel, MenuSep, cn } from "@/components/ui";
import { LocaleSwitcher } from "@/i18n/locale-switcher";
import * as I from "@/components/ui/icons";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { env } from "@/lib/env";
import { useT, type DictKey } from "@/i18n";
import { NotificationBell } from "@/components/notifications/bell";
import { useMediaQuery } from "@/lib/use-media-query";

interface NavItem {
  href: string;
  label: DictKey;
  icon: (p: { size?: number }) => ReactNode;
}
interface NavSection {
  label: DictKey;
  items: NavItem[];
}

export const ADMIN_NAV: NavSection[] = [
  { label: "admin.nav.overview", items: [{ href: "/admin", label: "nav.admin.dashboard", icon: I.Home }] },
  {
    label: "admin.nav.content",
    items: [
      { href: "/admin/books", label: "nav.admin.books", icon: I.Book },
      { href: "/admin/categories", label: "nav.admin.categories", icon: I.Tag },
    ],
  },
  {
    label: "admin.nav.people",
    items: [
      { href: "/admin/users", label: "nav.admin.users", icon: I.Users },
      { href: "/admin/access", label: "nav.admin.access", icon: I.Key },
      { href: "/admin/orders", label: "nav.admin.orders", icon: I.ShoppingBag },
    ],
  },
  { label: "admin.nav.system", items: [{ href: "/admin/audit-logs", label: "nav.admin.audit", icon: I.History }] },
];

export function isNavActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* ---------- Crumb konteksti: detal sahifalar o'z nomini beradi ---------- */
const CrumbCtx = createContext<{ crumb: string | null; setCrumb: (v: string | null) => void } | null>(null);

/** Detal sahifada: `useAdminCrumb(book?.title)` — topbar'da bo'limdan keyin ko'rinadi. */
export function useAdminCrumb(label: string | null | undefined) {
  const ctx = useContext(CrumbCtx);
  const set = ctx?.setCrumb;
  useEffect(() => {
    set?.(label ?? null);
    return () => set?.(null);
  }, [label, set]);
}

/* ---------- Sidebar holati (localStorage) ---------- */
const NAV_KEY = "a365.adminNav";
const navListeners = new Set<() => void>();
function readCollapsed() {
  try {
    return window.localStorage.getItem(NAV_KEY) === "collapsed";
  } catch {
    return false;
  }
}
function subscribeNav(cb: () => void) {
  navListeners.add(cb);
  return () => navListeners.delete(cb);
}
function setCollapsed(v: boolean) {
  try {
    window.localStorage.setItem(NAV_KEY, v ? "collapsed" : "open");
  } catch {
    /* private rejim */
  }
  navListeners.forEach((l) => l());
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const pathname = usePathname();
  const stored = useSyncExternalStore(subscribeNav, readCollapsed, () => false);
  const isMobile = useMediaQuery("(max-width: 900px)");
  const collapsed = stored && !isMobile; // mobil drawer'da yorliqlar doim ko'rinadi
  // Mobil drawer: ochilgan marshrut saqlanadi — marshrut o'zgarsa o'z-o'zidan yopiladi (effektsiz)
  const [mobileOpenAt, setMobileOpenAt] = useState<string | null>(null);
  const mobileOpen = mobileOpenAt === pathname;
  const setMobileOpen = useCallback((v: boolean) => setMobileOpenAt(v ? pathname : null), [pathname]);
  const [crumb, setCrumbState] = useState<string | null>(null);
  const setCrumb = useCallback((v: string | null) => setCrumbState(v), []);
  const crumbValue = useMemo(() => ({ crumb, setCrumb }), [crumb, setCrumb]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, setMobileOpen]);

  const section = ADMIN_NAV.flatMap((s) => s.items).find((i) => isNavActive(pathname, i.href));
  const displayName = user?.full_name || user?.email || user?.phone || t("common.user");

  return (
    <CrumbCtx.Provider value={crumbValue}>
      <div className="app-frame" data-nav={collapsed ? "collapsed" : "open"} data-testid="admin-shell">
        {mobileOpen && <button type="button" className="mobile-nav-backdrop" aria-label={t("ui.nav.closeMenu")} onClick={() => setMobileOpen(false)} />}
        <aside className={cn("sidebar", mobileOpen && "mobile-open")} aria-label={t("nav.admin")}>
          <div className="sidebar-header">
            <Link href="/admin" className="brand" aria-label={env.appName}>
              <span className="brand-mark">A</span>
              {!collapsed && (
                <span className="brand-text">
                  <span className="brand-name">{env.appName}</span>
                  <span className="brand-sub">{t("nav.admin")}</span>
                </span>
              )}
            </Link>
            <button type="button" className="sidebar-toggle min-[901px]:hidden" aria-label={t("ui.nav.closeMenu")} onClick={() => setMobileOpen(false)}>
              <I.X size={18} />
            </button>
          </div>
          {/* Yig'ish tugmasi — sidebar chekkasida, doim bir xil balandlikda */}
          <button
            type="button"
            className="sidebar-collapse"
            aria-label={collapsed ? t("ui.nav.expand") : t("ui.nav.collapse")}
            title={collapsed ? t("ui.nav.expand") : t("ui.nav.collapse")}
            aria-pressed={stored}
            onClick={() => setCollapsed(!stored)}
            data-testid="nav-toggle"
          >
            {collapsed ? <I.ChevronsRight size={15} /> : <I.ChevronsLeft size={15} />}
          </button>
          <nav className="nav">
            {ADMIN_NAV.map((s) => (
              <div key={s.label} className="contents">
                <div className="nav-section" title={t(s.label)}>
                  {collapsed ? "" : t(s.label)}
                </div>
                {s.items.map((it) => {
                  const active = isNavActive(pathname, it.href);
                  return (
                    <Link key={it.href} href={it.href} className={cn("nav-item", active && "active")} aria-current={active ? "page" : undefined} title={collapsed ? t(it.label) : undefined}>
                      <it.icon size={18} />
                      {!collapsed && <span>{t(it.label)}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <Avatar name={displayName} tone="accent" />
            {!collapsed && (
              <div className="sidebar-user">
                <span className="name" title={displayName}>
                  {displayName}
                </span>
                <span className="role">{t("common.role")}: ADMIN</span>
              </div>
            )}
            <Menu
              align="end"
              aria-label={t("ui.userMenu")}
              trigger={(p) => (
                <button {...p} type="button" className="sidebar-toggle" aria-label={t("ui.userMenu")} data-testid="admin-user-menu">
                  <I.MoreHorizontal size={18} />
                </button>
              )}
            >
              <MenuLabel>{displayName}</MenuLabel>
              <MenuItem href="/library" icon={<I.Library size={16} />}>
                {t("nav.library")}
              </MenuItem>
              <MenuItem href="/profile" icon={<I.User size={16} />}>
                {t("nav.profile")}
              </MenuItem>
              <MenuSep />
              <MenuItem tone="danger" icon={<I.LogOut size={16} />} onSelect={() => void logout()}>
                {t("nav.logout")}
              </MenuItem>
            </Menu>
          </div>
        </aside>

        <div className="sheet">
          <header className="topbar">
            <IconButton label={t("ui.nav.openMenu")} className="mobile-menu-button" variant="plain" onClick={() => setMobileOpen(true)} data-testid="mobile-menu">
              <I.Menu size={20} />
            </IconButton>
            <nav className="crumbs" aria-label="breadcrumb">
              <Link href="/admin">{t("nav.admin")}</Link>
              {section && section.href !== "/admin" && (
                <>
                  <I.ChevronRight size={14} />
                  {crumb ? <Link href={section.href}>{t(section.label)}</Link> : <span className="current">{t(section.label)}</span>}
                </>
              )}
              {section?.href === "/admin" && (
                <>
                  <I.ChevronRight size={14} />
                  <span className="current">{t(section.label)}</span>
                </>
              )}
              {crumb && (
                <>
                  <I.ChevronRight size={14} />
                  <span className="current" title={crumb}>
                    {crumb}
                  </span>
                </>
              )}
            </nav>
            <div className="topbar-actions">
              <NotificationBell />
              <LocaleSwitcher variant="menu" />
              <ThemeSwitch />
              <Link href="/library" className="btn sm max-[640px]:hidden">
                <I.ArrowUpRight size={15} />
                {t("ui.backToApp")}
              </Link>
            </div>
          </header>
          <main className="sheet-content" id="admin-main">
            {children}
          </main>
        </div>
      </div>
    </CrumbCtx.Provider>
  );
}
