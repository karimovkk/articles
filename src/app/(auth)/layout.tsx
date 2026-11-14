"use client";

/**
 * Auth qobig'i: butun ekran — qiyshaytirilgan 3D muqovalar devori (`CoverWall`, ustunlar to'xtovsiz suzadi),
 * ustida qorong'i parda; chapda brend, shior va katta "365"; o'ngda shisha effektli karta:
 * Kirish / Ro'yxatdan o'tish segment-tab, sarlavha + microcopy, forma.
 */
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { env } from "@/lib/env";
import { useT } from "@/i18n";
import { LocaleSwitcher } from "@/i18n/locale-switcher";
import { YearDayChip } from "@/components/layout/year-progress";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { CoverWall } from "@/components/auth/cover-wall";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useT();
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  return (
    <div className="auth">
      <CoverWall />
      <div className="auth-veil" aria-hidden />
      {/* Har raqam navbat bilan kattalashib, ustidan nur o'tadi (design.css: auth-digit-pop / auth-digit-shine) */}
      <div className="auth-big" aria-hidden>
        <span className="auth-digit" style={{ "--d": 0 } as CSSProperties}>3</span>
        <span className="auth-digit hl" style={{ "--d": 1 } as CSSProperties}>6</span>
        <span className="auth-digit" style={{ "--d": 2 } as CSSProperties}>5</span>
      </div>

      <header className="auth-top">
        {/* 29: Safari shriftni biroz kengroq chizadi — tor ekranda brend nomi "…" bilan qisqaradi */}
        <Link href="/catalog" className="brand min-w-0">
          <span className="brand-mark shrink-0">A</span>
          <span className="brand-text min-w-0">
            <span className="brand-name block truncate">{env.appName}</span>
            <span className="brand-sub max-[640px]:hidden">{t("app.tagline")}</span>
          </span>
        </Link>
        {/* 25: brend "365" — yilning nechanchi kuni; ≤420px da brend nomi ustiga tushmasligi uchun yashiriladi (27.3) */}
        <YearDayChip className="max-[420px]:hidden" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link href="/catalog" className="btn ghost sm auth-back max-[900px]:hidden">
            <I.ArrowLeft size={15} />
            {t("catalog.back")}
          </Link>
          {/* 23: tor ekranda til tanlagich brend nomini siqib qo'ymasin — ixcham menyu */}
          <LocaleSwitcher className="max-[640px]:hidden" />
          <LocaleSwitcher variant="menu" className="min-[641px]:hidden" />
          <ThemeSwitch />
        </div>
      </header>

      <aside className="auth-hero">
        <h2>
          {t("auth.heroTitle1")} <em>{t("auth.heroTitle2")}</em>
        </h2>
        <p>{t("auth.heroText")}</p>
      </aside>

      <main className="auth-panel">
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
        <p className="auth-copy">
          © {new Date().getFullYear()} {env.appName}
        </p>
      </main>
    </div>
  );
}
