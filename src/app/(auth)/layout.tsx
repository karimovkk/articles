"use client";

/**
 * Auth qobig'i (13.2): chapda brend paneli — "aurora" fon, aylanuvchi yer shari va uning orbitasidagi kitoblar
 * (`GlobeOrbit`), 3 slaydli karusel;
 * o'ngda karta: Kirish / Ro'yxatdan o'tish segment-tab, sarlavha + microcopy, forma.
 */
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { env } from "@/lib/env";
import { useT, type DictKey } from "@/i18n";
import { LocaleSwitcher } from "@/i18n/locale-switcher";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { GlobeOrbit } from "@/components/auth/globe-orbit";

const SLIDES: Array<{ icon: (p: { size?: number }) => ReactNode; title: DictKey; text: DictKey }> = [
  { icon: I.ShieldCheck, title: "auth.slide1.title", text: "auth.slide1.text" },
  { icon: I.Highlighter, title: "auth.slide2.title", text: "auth.slide2.text" },
  { icon: I.Smartphone, title: "auth.slide3.title", text: "auth.slide3.text" },
];
const SLIDE_MS = 4500;

function Slides() {
  const { t } = useT();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % SLIDES.length), SLIDE_MS);
    return () => window.clearInterval(id);
  }, [paused]);
  return (
    <div className="auth-slides" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} data-testid="auth-slides">
      {SLIDES.map((s, n) => (
        <div key={s.title} className={cn("auth-slide", n === i && "active")} aria-hidden={n !== i}>
          <span className="ic">
            <s.icon size={20} />
          </span>
          <span>
            <span className="ttl block">{t(s.title)}</span>
            <span className="txt block">{t(s.text)}</span>
          </span>
        </div>
      ))}
      <div className="auth-dots" role="tablist" aria-label="slides">
        {SLIDES.map((s, n) => (
          <button key={s.title} type="button" role="tab" aria-selected={n === i} aria-label={t(s.title)} className={cn(n === i && "active")} onClick={() => setI(n)} />
        ))}
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useT();
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  return (
    <div className="auth">
      <aside className="auth-art">
        <div className="aurora" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <Link href="/catalog" className="brand">
          <span className="brand-mark">A</span>
          <span className="brand-text">
            <span className="brand-name">{env.appName}</span>
            <span className="brand-sub">{t("app.tagline")}</span>
          </span>
        </Link>
        <GlobeOrbit />
        <div>
          <h2>
            {t("auth.heroTitle1")} <em>{t("auth.heroTitle2")}</em>
          </h2>
          <p className="mt-3.5 max-w-[440px] text-[15px]" style={{ color: "var(--frame-text-2)" }}>
            {t("auth.heroText")}
          </p>
          <Slides />
        </div>
        <p className="text-xs font-semibold" style={{ color: "var(--frame-muted)" }}>
          © {new Date().getFullYear()} {env.appName}
        </p>
      </aside>

      <div className="auth-panel">
        <div className="auth-form">
          <div className="mb-5 flex items-center justify-between gap-3">
            <Link href="/catalog" className="brand min-[901px]:hidden">
              <span className="brand-mark">A</span>
              <span className="brand-text">
                <span className="brand-name" style={{ color: "var(--text)" }}>
                  {env.appName}
                </span>
              </span>
            </Link>
            <Link href="/catalog" className="btn ghost sm max-[900px]:hidden">
              <I.ArrowLeft size={15} />
              {t("catalog.back")}
            </Link>
            <div className="flex items-center gap-2">
              <LocaleSwitcher />
              <ThemeSwitch />
            </div>
          </div>
          <div className="auth-card">
            <nav className="auth-tabs" aria-label={t("auth.login")}>
              <Link href="/login" className={cn(isLogin && "active")} aria-current={isLogin ? "page" : undefined} data-testid="tab-login">
                {t("auth.login")}
              </Link>
              <Link href="/register" className={cn(!isLogin && "active")} aria-current={!isLogin ? "page" : undefined} data-testid="tab-register">
                {t("auth.register")}
              </Link>
            </nav>
            <h1 className="auth-title">{isLogin ? t("auth.welcomeBack") : t("auth.createTitle")}</h1>
            <p className="auth-sub mb-6">{isLogin ? t("auth.loginSubtitle") : t("auth.createSubtitle")}</p>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
