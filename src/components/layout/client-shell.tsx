"use client";

/**
 * Mijoz qobig'i (16.2) — katalog, kutubxona, kitob, bildirishnoma, profil sahifalari uchun:
 *  - fon: `public/bg/article-*.webp` (`.client-bg`, position: fixed + qoraytiruvchi gradient);
 *  - header: 365 emblema, markazda nav, qidiruv, til, mavzu, qo'ng'iroq, profil menyusi (mehmon — Kirish/Ro'yxat);
 *  - sidebar: nav (+ o'qilmagan soni), kategoriyalar (kitoblar soni bilan), "Buy Real Books" (78); <1100px — drawer.
 * Reader va auth sahifalari bu qobiqdan foydalanmaydi.
 * 111: Telegram Mini App'da — faqat sotib olish: menyuda "Maqolalar" va "Savatcha", header'da olovcha/qo'ng'iroq/profil
 * havolalari va "Buy Real Books" yo'q (o'qish va qolgani — saytda).
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, Menu, MenuItem, MenuLabel, MenuSep, buttonClass, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { NotificationBell } from "@/components/notifications/bell";
import { CartHeaderButton, useCartNav } from "@/components/cart/cart-ui";
import { YearDayChip, YearEmblem } from "./year-progress";
import { useUnreadCount } from "@/components/notifications/use-unread-count";
import { API_PREFIX, backendUrl, env } from "@/lib/env";
import { useOpenOrders } from "@/lib/admin-open-orders";
import { StreakChip } from "@/components/streak/streak-chip";
import { BuyRealBooks } from "./buy-real-books";
import { ContactWidget } from "./contact-widget";
import { useT, type DictKey } from "@/i18n";
import { LocaleSwitcher } from "@/i18n/locale-switcher";
import { useInTelegram } from "@/lib/use-in-telegram";
import { DEFAULT_BESTSELLER_COVER, DEFAULT_BESTSELLER_COVER_SRCSET, isBookId } from "@/lib/decor";
import { useDecor } from "@/providers/appearance-provider";
import { SeasonEffects } from "./season-effects";

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
    <div className="client" data-route={pathname === "/catalog" || pathname === "/daily" ? "catalog" : undefined}>
      <div className="client-bg" aria-hidden />
      <ClientHeader menuOpen={open} onMenu={() => setOpenAt(open ? null : pathname)} />
      <div className="client-body">
        {open && <button type="button" className="client-backdrop" aria-label={t("ui.nav.closeMenu")} onClick={() => setOpenAt(null)} />}
        <ClientSidebar open={open} onNavigate={() => setOpenAt(null)} />
        <main className="client-main">{children}</main>
      </div>
      {/* 113: bog'lanish — Telegram (@I365_admin) */}
      <ContactWidget />
      {/* 125: qor / barglar / gulbarglar — admin yoqsa; reader'da yo'q (u bu qobiqdan foydalanmaydi) */}
      <SeasonEffects />
    </div>
  );
}

function ClientHeader({ menuOpen, onMenu }: { menuOpen: boolean; onMenu: () => void }) {
  const { user, loading, isAdmin, logout } = useAuth();
  const { t } = useT();
  const pathname = usePathname();
  const inTelegram = useInTelegram();
  const displayName = user ? user.full_name || user.email || user.phone || t("common.user") : "";
  return (
    <header className="client-header" data-guest={!user && !loading ? "" : undefined}>
      <button type="button" className="icon-btn plain client-burger" onClick={onMenu} aria-expanded={menuOpen} aria-label={t(menuOpen ? "ui.nav.closeMenu" : "ui.nav.openMenu")} data-testid="client-menu">
        {menuOpen ? <I.X size={20} /> : <I.Menu size={20} />}
      </button>
      {/* 25/30: brend "365" markazda — yilning nechanchi kuni doim ko'rinib turadi, halqa vaqti-vaqti bilan yonadi */}
      <div className="client-brand-wrap">
        <Link href={inTelegram ? "/catalog" : user ? "/library" : "/daily"} className="client-brand" aria-label={env.appName} data-testid="header-brand">
          <YearEmblem />
          <BrandWord name={env.appName} />
        </Link>
        <YearDayChip className="header-day" />
      </div>

      <div className="client-actions">
        <Link
          href="/catalog#search"
          onClick={(e) => {
            // Katalog sahifalarining o'zida (kunlik / pullik) — sahifa qayta yuklanmaydi, qidiruv maydoniga fokus
            if (pathname !== "/catalog" && pathname !== "/daily") return;
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
        {/* 59: telefonda joy olovcha uchun — til faqat bayroq, mavzu bitta yumaloq tugma */}
        <LocaleSwitcher variant="menu" compact className="max-sm:!px-1.5" />
        <ThemeSwitch className="ts-phone-compact" />
        <CartHeaderButton />
        {user && !inTelegram && <StreakChip />}
        {user && !inTelegram && <NotificationBell />}
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
            {!inTelegram && (
              <>
                <MenuItem href="/profile" icon={<I.User size={16} />}>
                  {t("nav.profile")}
                </MenuItem>
                <MenuItem href="/notifications" icon={<I.Bell size={16} />}>
                  {t("notifications.title")}
                </MenuItem>
              </>
            )}
            {isAdmin && !inTelegram && (
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

/**
 * 77: so'z-belgi — "Articles" (sarlavha shrifti, kursiv) + oltin "365" (vaqti-vaqti bilan yaltiraydi). Nom oxiridagi
 * raqam alohida ajratiladi (`NEXT_PUBLIC_APP_NAME` boshqacha bo'lsa — butun nom bir xil uslubda).
 */
function BrandWord({ name }: { name: string }) {
  const m = /^(.*?)(\d+)$/.exec(name);
  return (
    <span className="client-brand-name brand-word" aria-hidden>
      <span className="bw-main">{m ? m[1] : name}</span>
      {m && <span className="bw-num">{m[2]}</span>}
    </span>
  );
}

/**
 * 125: faol band yonida — bestseller kitob muqovasi (admin tanlaydi: `settings.decor.bestseller`; standart — "365"
 * jurnal). Muqova public `/catalog/{id}/cover` — oddiy `<img>` (brauzer keshlaydi, JS yo'q); xato bo'lsa — standart.
 */
// 125.4: bo'lim almashganda muqova eski banddan yangisiga "uchib" o'tadi (FLIP). Eski joy — unmount paytida yoziladi;
// yangi nusxa shu commit ichida mount bo'ladi (vaqt farqi ~0) — 1 s'dan eski yozuv (sahifa qayta yuklangan) hisobga
// olinmaydi va oddiy kirish animatsiyasi ishlaydi. Faqat transform (GPU), bitta element, ~0.6 s — sahifani sekinlatmaydi.
let peekLast: { x: number; y: number; at: number } | null = null;

// 125.6: sokin uchish — muqova eski banddan yangisiga yumshoq yoy bo'ylab sirpanib o'tadi: aylanish, cho'kish va
// prujina yo'q. Yo'l o'rtasida biroz ko'tariladi (2–4% kattalashib, soyasi sal chuqurlashib) va silliq sekinlashib
// joyiga tushadi; yangi band bir marta xira oltin halqa bilan "nafas oladi". Kadrlar JS'da yoy formulasidan
// hisoblanadi (sinus easing), faqat transform/box-shadow, bitta kichik element.
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

function flyBook(el: HTMLElement, dx: number, dy: number) {
  const dist = Math.hypot(dx, dy);
  const dur = Math.round(Math.min(860, 560 + dist * 0.3));
  // Yoy chapga (yorliqlar ustidan) sal egiladi — sidebar o'ng chetidan chiqib, kesilib qolmasin
  const bulge = -Math.min(22, 8 + dist * 0.05);
  const cx = dx / 2 + bulge;
  const cy = dy / 2;
  const frames: Keyframe[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const p = easeInOutSine(i / N);
    const q = 1 - p;
    const x = q * q * dx + 2 * q * p * cx;
    const y = q * q * dy + 2 * q * p * cy;
    const lift = Math.sin(p * Math.PI);
    const s = 1 + Math.min(0.04, 0.02 + dist * 0.00005) * lift;
    const rz = -6 + 2 * lift; // yo'lda biroz to'g'rilanadi, so'ng yana o'z qiyaligiga qaytadi
    const sh = 4 + lift * 5;
    frames.push({
      offset: i / N,
      transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${rz.toFixed(2)}deg) scale(${s.toFixed(4)})`,
      boxShadow: `0 1px 2px rgba(18,22,20,0.25), 0 ${sh.toFixed(1)}px ${(10 + lift * 6).toFixed(1)}px rgba(18,22,20,${(0.22 + lift * 0.04).toFixed(2)})`,
    });
  }
  el.style.zIndex = "3"; // yuqoridagi/pastdagi bandlar ostida qolmasin
  const anim = el.animate(frames, { duration: dur, easing: "linear" });
  const clear = () => (el.style.zIndex = "");
  anim.onfinish = clear;
  anim.oncancel = clear;
  // Yetib kelgach — yangi band bir marta xira oltin halqa bilan sekin "nafas oladi"
  const link = el.closest<HTMLElement>(".side-link");
  const accent = link && getComputedStyle(link).getPropertyValue("--accent").trim();
  if (link && accent && typeof link.animate === "function") {
    link.animate(
      [
        { boxShadow: `0 0 0 0 color-mix(in srgb, ${accent} 0%, transparent)` },
        { boxShadow: `0 0 0 0 color-mix(in srgb, ${accent} 28%, transparent)`, offset: 0.2 },
        { boxShadow: `0 0 0 6px color-mix(in srgb, ${accent} 0%, transparent)` },
      ],
      { duration: 900, delay: dur * 0.75, easing: "ease-out" },
    );
  }
}

function useBookFlight() {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prev = peekLast;
    peekLast = null;
    const fresh = prev && performance.now() - prev.at < 1000;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (fresh && !calm && typeof el.animate === "function") {
      el.style.animation = "none"; // o'lchashdan oldin — CSS kirish animatsiyasining siljishi rect'ni buzmasin
      const r = el.getBoundingClientRect();
      const dx = prev.x - r.left;
      const dy = prev.y - r.top;
      if (Math.abs(dx) + Math.abs(dy) <= 2) {
        // joyida (masalan, StrictMode qayta mount) — oddiy kirish; lekin uchish ketayotgan bo'lsa, unga tegmaymiz
        if (!el.getAnimations().length) el.style.animation = "";
      } else {
        flyBook(el, dx, dy);
      }
    }
    return () => {
      const r = el.getBoundingClientRect();
      // Animatsiya o'rtasida yana bosilsa — joriy (ko'rinib turgan) joydan uchadi
      peekLast = { x: r.left, y: r.top, at: performance.now() };
    };
  }, []);
  return ref;
}

function BestsellerPeek() {
  const { decor } = useDecor();
  const [broken, setBroken] = useState<string | null>(null);
  if (decor.bestseller === "off") return null;
  return <BestsellerCover decor={decor} broken={broken} setBroken={setBroken} />;
}

function BestsellerCover({ decor, broken, setBroken }: { decor: ReturnType<typeof useDecor>["decor"]; broken: string | null; setBroken: (id: string) => void }) {
  const ref = useBookFlight();
  const id = isBookId(decor.bestseller) ? decor.bestseller : null;
  const own = !!id && broken !== id;
  // Sifat: ekranda 28×40, retina'da 2–3x piksel kerak — standart muqova 2x/3x tayyor fayl (srcSet), kitob — `thumb`
  // (katalog kartalaridagi rendition, 84px'dan katta). 3D burish yo'q — u qatlamni rastrlab xiralashtiradi.
  const src = own ? backendUrl(`${API_PREFIX}/catalog/${id}/cover?size=thumb`) : DEFAULT_BESTSELLER_COVER;
  return (
    <span ref={ref} className="side-bestseller" aria-hidden title={decor.bestseller_title ?? undefined} data-testid="nav-bestseller">
      {/* eslint-disable-next-line @next/next/no-img-element -- kichik dekorativ muqova, backend URL */}
      <img
        key={src}
        src={src}
        srcSet={own ? undefined : DEFAULT_BESTSELLER_COVER_SRCSET}
        alt=""
        width={28}
        height={40}
        // sync: bo'lim almashganda yangi <img> keshdan darhol chiziladi — uchish boshida bo'sh "arvoh" muqova ko'rinmaydi
        decoding="sync"
        draggable={false}
        onError={() => id && setBroken(id)}
      />
    </span>
  );
}

function ClientSidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { user, loading, isAdmin } = useAuth();
  const openOrders = useOpenOrders(isAdmin);
  const { t } = useT();
  const pathname = usePathname();
  const unread = useUnreadCount(!!user);
  const cartNav = useCartNav();
  const inTelegram = useInTelegram();
  const all: NavItem[] = [
    // 45: katalog ikki sahifa — kunlik (tekin) va pullik
    { href: "/daily", label: "nav.daily", icon: <I.Sun size={19} /> },
    { href: "/catalog", label: "nav.paid", icon: <I.Grid size={19} /> },
    { href: "/library", label: "nav.library", icon: <I.Library size={19} />, auth: true },
    { href: "/vocabulary", label: "nav.vocabulary", icon: <I.Languages size={19} />, auth: true },
    { href: "/leaderboard", label: "nav.leaderboard", icon: <I.Trophy size={19} />, auth: true },
    // 35: savatcha (chegirma yoqilgan bo'lsa; mehmonlar uchun ham)
    ...(cartNav.enabled ? [{ href: "/cart", label: "cart.title" as DictKey, icon: <I.ShoppingBag size={19} />, badge: cartNav.count }] : []),
    { href: "/notifications", label: "notifications.title", icon: <I.Bell size={19} />, auth: true, badge: unread },
    { href: "/profile", label: "nav.profile", icon: <I.User size={19} />, auth: true },
  ];
  // 111: Mini App — faqat sotib olish
  const items = inTelegram ? all.filter((n) => n.href === "/catalog" || n.href === "/cart") : all;

  return (
    <aside className={cn("client-sidebar", open && "open")} aria-label={t("client.nav")}>
      <nav className="client-side-nav">
        {items
          .filter((n) => !n.auth || user)
          .map((n) => (
            <Link key={n.href} href={n.href} onClick={onNavigate} className={cn("side-link", isActive(pathname, n.href) && "active")} aria-current={isActive(pathname, n.href) ? "page" : undefined}>
              {n.icon}
              <span>{t(n.label)}</span>
              {isActive(pathname, n.href) && <BestsellerPeek />}
              {!!n.badge && (
                <span className="side-badge" data-testid={n.href === "/cart" ? "nav-cart" : "nav-unread"}>
                  {n.badge > 99 ? "99+" : n.badge}
                </span>
              )}
            </Link>
          ))}
        {isAdmin && !inTelegram && (
          <Link href="/admin" prefetch={false} onClick={onNavigate} className="side-link">
            <I.Settings size={19} />
            <span>{t("nav.admin")}</span>
            {/* 121: faqat chek yuborilganlar (AWAITING_REVIEW) */}
            {openOrders?.awaiting ? (
              <span className="side-badge" data-testid="nav-admin-orders" title={t("admin.orders.openCount", { n: openOrders.awaiting })}>
                {openOrders.awaiting > 99 ? "99+" : openOrders.awaiting}
              </span>
            ) : (
              <I.ArrowUpRight size={14} className="ml-auto opacity-60" />
            )}
          </Link>
        )}
        {!user && !loading && (
          <Link href="/login" prefetch={false} onClick={onNavigate} className={cn("side-link", isActive(pathname, "/login") && "active")}>
            <I.LogOut size={19} className="rotate-180" />
            <span>{t("auth.login")}</span>
          </Link>
        )}
      </nav>

      {/* 78: "Buy Real Books" — Uzum Market'dagi do'konimiz, muqovalar aylanib turadi */}
      {!inTelegram && <BuyRealBooks onNavigate={onNavigate} />}
    </aside>
  );
}
