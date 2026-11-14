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

// 127: 3D kitob uchishi (Alfa'dagi to'p kabi) — muqova haqiqiy 3D kitobga aylanadi: qalinligi (orqa muqova, umurtqa,
// varaq qirralari) bor. Bo'lim almashganda kitob eski banddan sakrab, bitta ballistik yoy bo'ylab (doimiy tortishish)
// yangi bandga tushadi: havoda o'z o'qi atrofida bir marta aylanadi, muqovasi ochilib varaqlari yelpig'ichdek
// hilpiraydi, qo'nishdan oldin yopiladi; qo'nganda siqilib-cho'ziladi, kichik sakraydi, zarba chiziqlari, to'lqin va
// qog'oz parchalari sochiladi (fixed overlay — sidebar overflow'i kesmasin). Hammasi WAAPI (transform/opacity/filter),
// 3D qismlar faqat uchish paytida ko'rinadi — tinch holatda muqova avvalgidek tiniq 2D.
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const LAND = 0.78; // vaqtning shu ulushida kitob bandga tegadi, qolgani — siqilish va kichik sakrash
const BOOK_H = 40;

function flyBook(el: HTMLElement, dx: number, dy: number) {
  const dist = Math.hypot(dx, dy);
  const dur = Math.round(Math.min(1300, 940 + dist * 0.45));
  const dir = dy < 0 ? -1 : 1; // pastga uchsa — chapga, yuqoriga — o'ngga aylanadi
  // Ballistik yoy: y(s) = dy(1−s) − c·s(1−s), cho'qqisi yuqoriroq banddan H piksel tepada
  const H = 16 + Math.min(18, dist * 0.06);
  const peak = Math.min(dy, 0) - H;
  const D = dy - peak;
  const b = 4 * D - 2 * dy;
  const c = (b + Math.sqrt(Math.max(0, b * b - 4 * dy * dy))) / 2;
  const bulge = -Math.min(18, 6 + dist * 0.04); // chapga (yorliqlar ustidan) — sidebar o'ng chetida kesilmasin

  const wrap: Keyframe[] = [];
  const book: Keyframe[] = [];
  const cover: Keyframe[] = [];
  const N = 44;
  const open = (s: number) => Math.pow(Math.sin(Math.PI * clamp01((s - 0.06) / 0.74)), 1.3);
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let tf: string;
    let bk: string;
    let o = 0;
    let lift = 0;
    if (t <= LAND) {
      const s = t / LAND; // vaqt chiziqli — haqiqiy tortishish: cho'qqida sekin, tushishda tezlashadi
      const x = dx * (1 - s) + bulge * Math.sin(Math.PI * s);
      const y = dy * (1 - s) - c * s * (1 - s);
      lift = Math.sin(Math.PI * s);
      const sc = 1 + 0.14 * lift; // ko'tarilganda ekranga yaqinlashadi
      tf = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${(-6 + 6 * lift).toFixed(2)}deg) scale(${sc.toFixed(4)})`;
      bk = `perspective(320px) rotateX(${(16 * lift).toFixed(2)}deg) rotateY(${(dir * 360 * easeInOutCubic(s)).toFixed(2)}deg)`;
      o = open(s);
    } else {
      // Qo'nish: siqilish → kichik sakrash → joyiga (pastki qirra bandda qoladi: translateY kompensatsiyasi)
      const u = (t - LAND) / (1 - LAND);
      const k = [
        [0, 0, 1.1, 0.84, 9],
        [0.38, -5, 0.97, 1.05, -4],
        [0.72, 0, 1.03, 0.96, 2],
        [1, 0, 1, 1, 0],
      ];
      let j = 0;
      while (j < k.length - 2 && u > k[j + 1][0]) j++;
      const [u0, y0, sx0, sy0, r0] = k[j];
      const [u1, y1, sx1, sy1, r1] = k[j + 1];
      const p = easeInOutCubic(clamp01((u - u0) / (u1 - u0)));
      const sy = sy0 + (sy1 - sy0) * p;
      const sx = sx0 + (sx1 - sx0) * p;
      const y = y0 + (y1 - y0) * p + (BOOK_H * (1 - sy)) / 2;
      tf = `translate(0px, ${y.toFixed(2)}px) rotate(-6deg) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
      bk = `perspective(320px) rotateX(${(r0 + (r1 - r0) * p).toFixed(2)}deg) rotateY(0deg)`;
    }
    const sh = 3 + lift * 12;
    wrap.push({ offset: t, transform: tf, filter: `drop-shadow(0 ${sh.toFixed(1)}px ${(3 + lift * 6).toFixed(1)}px rgba(18,22,20,${(0.34 - lift * 0.12).toFixed(2)}))` });
    book.push({ offset: t, transform: bk });
    cover.push({ offset: t, transform: `rotateY(${(-128 * o).toFixed(2)}deg)` });
  }

  const inner = el.querySelector<HTMLElement>(".sb-book");
  const lid = el.querySelector<HTMLElement>(".sb-cover");
  const leaves = el.querySelectorAll<HTMLElement>(".sb-leaf");
  // Qo'nish nuqtasi — kitobning yakuniy joyi; animate()dan OLDIN o'lchanadi (keyin rect boshlang'ich kadrni beradi)
  const r = el.getBoundingClientRect();
  el.dataset.fly = "";
  el.style.zIndex = "3"; // yuqoridagi/pastdagi bandlar ostida qolmasin
  const anim = el.animate(wrap, { duration: dur, easing: "linear" });
  const opts = { duration: dur, easing: "linear" };
  inner?.animate(book, opts);
  lid?.animate(cover, opts);
  // Varaqlar muqova ortidan — har biri kamroq ochiladi va sal kechikadi (yelpig'ich)
  leaves.forEach((leaf, i) => {
    const amp = [104, 74, 44][i] ?? 30;
    const lag = 0.04 * (i + 1);
    leaf.animate(
      Array.from({ length: N + 1 }, (_, n) => {
        const t = n / N;
        const o = t <= LAND ? open(clamp01(t / LAND - lag)) : 0;
        return { offset: t, transform: `translateZ(${-(i + 1) * 1.2}px) rotateY(${(-amp * o).toFixed(2)}deg)` };
      }),
      opts,
    );
  });
  const clear = () => {
    el.style.zIndex = "";
    delete el.dataset.fly;
  };
  anim.onfinish = clear;
  anim.oncancel = clear;

  const link = el.closest<HTMLElement>(".side-link");
  const accent = (link && getComputedStyle(link).getPropertyValue("--accent").trim()) || "#c8a24a";
  landingBurst(r.left + r.width / 2, r.bottom - 2, accent, dur * LAND);
  if (link && typeof link.animate === "function") {
    link.animate(
      [
        { boxShadow: `0 0 0 0 color-mix(in srgb, ${accent} 0%, transparent)` },
        { boxShadow: `0 0 0 0 color-mix(in srgb, ${accent} 32%, transparent)`, offset: 0.2 },
        { boxShadow: `0 0 0 7px color-mix(in srgb, ${accent} 0%, transparent)` },
      ],
      { duration: 900, delay: dur * LAND, easing: "ease-out" },
    );
  }
}

/** Qo'nish zarbasi: to'lqin halqa, zarba chiziqlari va 3D aylanib tushadigan qog'oz parchalari. Overlay o'zini o'chiradi. */
function landingBurst(x: number, y: number, accent: string, delay: number) {
  const fx = document.createElement("div");
  fx.className = "sb-fx";
  fx.setAttribute("aria-hidden", "true");
  fx.style.left = `${x}px`;
  fx.style.top = `${y}px`;
  fx.style.setProperty("--fx-accent", accent);
  document.body.appendChild(fx);
  const anims: Animation[] = [];
  const add = (cls: string, kf: Keyframe[], o: KeyframeAnimationOptions) => {
    const e = document.createElement("span");
    e.className = cls;
    fx.appendChild(e);
    anims.push(e.animate(kf, { delay, fill: "forwards", ...o }));
  };
  add("sb-fx-ring", [
    { transform: "translate(-50%, -50%) scale(0.2, 0.08)", opacity: 0.8 },
    { transform: "translate(-50%, -50%) scale(1.6, 0.55)", opacity: 0 },
  ], { duration: 520, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" });
  for (let i = 0; i < 6; i++) {
    const a = (-150 + i * 24) * (Math.PI / 180); // yuqori yarim doira bo'ylab
    const deg = (a * 180) / Math.PI + 90;
    const d0 = 10, d1 = 24 + (i % 2) * 6;
    add("sb-fx-line", [
      { transform: `translate(${Math.cos(a) * d0}px, ${Math.sin(a) * d0 - 10}px) rotate(${deg}deg) scaleY(0.2)`, opacity: 0 },
      { transform: `translate(${Math.cos(a) * (d0 + 6)}px, ${Math.sin(a) * (d0 + 6) - 10}px) rotate(${deg}deg) scaleY(1)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${Math.cos(a) * d1}px, ${Math.sin(a) * d1 - 10}px) rotate(${deg}deg) scaleY(0.3)`, opacity: 0 },
    ], { duration: 420, easing: "ease-out" });
  }
  for (let i = 0; i < 5; i++) {
    const vx = (i - 2) * 11 + (i % 2 ? 4 : -3);
    const up = 22 + ((i * 7) % 12);
    const spin = (i % 2 ? 1 : -1) * (300 + i * 60);
    add("sb-fx-scrap", [
      { transform: "translate(0px, -6px) rotateX(0deg) rotateY(0deg) rotate(0deg)", opacity: 0 },
      { transform: `translate(${vx * 0.6}px, ${-up}px) rotateX(${spin * 0.4}deg) rotateY(${spin * 0.3}deg) rotate(${vx}deg)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${vx}px, ${-up * 0.5}px) rotateX(${spin}deg) rotateY(${spin * 0.7}deg) rotate(${vx * 2}deg)`, opacity: 0 },
    ], { duration: 760 + i * 40, easing: "cubic-bezier(0.25, 0.6, 0.4, 1)" });
  }
  let left = anims.length;
  const done = () => --left <= 0 && fx.remove();
  anims.forEach((a) => {
    a.onfinish = done;
    a.oncancel = done;
  });
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
  // (katalog kartalaridagi rendition, 84px'dan katta). Tinch holatda 3D burish yo'q — u qatlamni rastrlab
  // xiralashtiradi; 3D faqat uchish paytida (127).
  const src = own ? backendUrl(`${API_PREFIX}/catalog/${id}/cover?size=thumb`) : DEFAULT_BESTSELLER_COVER;
  return (
    <span ref={ref} className="side-bestseller" aria-hidden title={decor.bestseller_title ?? undefined} data-testid="nav-bestseller">
      {/* 127: 3D kitob — qirralar va varaqlar faqat uchish paytida ko'rinadi ([data-fly]); muqova oxirida — ustda */}
      <span className="sb-book">
        <span className="sb-3d sb-back" />
        <span className="sb-3d sb-spine" />
        <span className="sb-3d sb-edge sb-edge-r" />
        <span className="sb-3d sb-edge sb-edge-t" />
        <span className="sb-3d sb-edge sb-edge-b" />
        <span className="sb-3d sb-page" />
        <span className="sb-3d sb-leaf" />
        <span className="sb-3d sb-leaf" />
        <span className="sb-3d sb-leaf" />
        <span className="sb-cover">
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
          <span className="sb-3d sb-inside" />
        </span>
      </span>
    </span>
  );
}

// Sidebar ba'zi o'tishlarda qayta yaratiladi (masalan, katalog boshqa route group'da) — oxirgi joy modul darajasida,
// vaqt belgisi bilan saqlanadi (xuddi `peekLast` kabi); 1 s'dan eskisi (sahifa qayta yuklangan) hisobga olinmaydi.
let glideLast: { y: number; h: number; at: number } | null = null;

/**
 * 126: sirpanuvchi faol band — fon "tabletka" va oltin chiziq bitta element: bo'lim almashganda eski banddan yangisiga
 * cho'zilib oqib o'tadi (avval oldingi qirra yangi bandga yetadi, so'ng orqa qirra tortiladi). Kitob muqovasining
 * uchishi (125.6) bilan bir vaqtda, shunga yaqin yumshoq sur'atda. Faqat transform/height, bitta absolute element;
 * o'lcham o'zgarsa (media query, nishon) — ResizeObserver joyini animatsiyasiz yangilaydi.
 */
function useNavGlide(dep: string) {
  const navRef = useRef<HTMLElement>(null);
  const glideRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const glide = glideRef.current;
    if (!nav || !glide) return;
    const measure = () => {
      const link = nav.querySelector<HTMLElement>(".side-link.active");
      return link ? { y: link.offsetTop, h: link.offsetHeight } : null;
    };
    const place = (to: { y: number; h: number } | null) => {
      glide.style.opacity = to ? "1" : "0";
      if (to) {
        glide.style.transform = `translateY(${to.y}px)`;
        glide.style.height = `${to.h}px`;
      }
    };
    const to = measure();
    const prev = glideLast;
    const from = prev && performance.now() - prev.at < 1000 ? prev : null;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    glide.getAnimations().forEach((a) => a.cancel());
    place(to);
    if (to && from && Math.abs(from.y - to.y) > 1 && !calm && typeof glide.animate === "function") {
      const top = Math.min(from.y, to.y);
      const span = Math.max(from.y + from.h, to.y + to.h) - top;
      const dist = Math.abs(to.y - from.y);
      glide.animate(
        [
          { transform: `translateY(${from.y}px)`, height: `${from.h}px` },
          // oldingi qirra yangi bandga yetdi, orqasi hali eski joyda — cho'zilgan "lenta"
          { transform: `translateY(${top}px)`, height: `${span}px`, offset: 0.45 },
          { transform: `translateY(${to.y}px)`, height: `${to.h}px` },
        ],
        { duration: Math.round(Math.min(760, 420 + dist * 0.6)), easing: "cubic-bezier(0.45, 0, 0.25, 1)" },
      );
    }

    const ro = new ResizeObserver(() => {
      if (glide.getAnimations().length) return; // animatsiya oxirgi kadrida to'g'ri joyga tushadi
      place(measure());
    });
    ro.observe(nav);
    return () => {
      ro.disconnect();
      // Ko'rinib turgan joy (animatsiya o'rtasida bo'lsa ham) — keyingi band shu yerdan oqadi. Faol band yo'q
      // (o'tish oralig'i) bo'lsa — oxirgi ma'lum joy saqlanadi, faqat vaqti yangilanadi.
      const g = glide.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      const visible = glide.style.opacity !== "0" && g.height > 0;
      if (visible) glideLast = { y: g.top - n.top, h: g.height, at: performance.now() };
      else if (glideLast) glideLast = { ...glideLast, at: performance.now() };
    };
  }, [dep]);

  return { navRef, glideRef };
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
  const visible = items.filter((n) => !n.auth || user);
  const { navRef, glideRef } = useNavGlide(`${pathname}|${visible.map((n) => n.href).join(",")}`);

  return (
    <aside className={cn("client-sidebar", open && "open")} aria-label={t("client.nav")}>
      <nav ref={navRef} className="client-side-nav" data-glide="">
        <span ref={glideRef} className="side-glide" aria-hidden />
        {visible.map((n) => (
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
