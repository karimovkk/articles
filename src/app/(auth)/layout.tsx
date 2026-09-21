"use client";

/** Auth qobig'i: qora ramka, chapda "art" panel (brend + tagline), o'ngda forma varag'i. */
import type { ReactNode } from "react";
import Link from "next/link";
import { env } from "@/lib/env";
import { useT } from "@/i18n";
import { LocaleSwitcher } from "@/i18n/locale-switcher";
import * as I from "@/components/ui/icons";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <div className="auth max-[900px]:grid-cols-1">
      <aside className="auth-art max-[900px]:hidden">
        <Link href="/catalog" className="brand">
          <span className="brand-mark">A</span>
          <span className="brand-text">
            <span className="brand-name">{env.appName}</span>
            <span className="brand-sub">{t("app.tagline")}</span>
          </span>
        </Link>
        <div>
          <h2>{t("auth.heroTitle")}</h2>
          <p>{t("auth.heroText")}</p>
          <ul className="mt-8 space-y-3 text-sm font-semibold" style={{ color: "var(--frame-text-2)" }}>
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-[10px]" style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>
                <I.ShieldCheck size={16} />
              </span>
              {t("auth.heroPoint1")}
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-[10px]" style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>
                <I.Highlighter size={16} />
              </span>
              {t("auth.heroPoint2")}
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-[10px]" style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>
                <I.Smartphone size={16} />
              </span>
              {t("auth.heroPoint3")}
            </li>
          </ul>
        </div>
        <p className="text-xs font-semibold" style={{ color: "var(--frame-muted)" }}>
          © {new Date().getFullYear()} {env.appName}
        </p>
      </aside>
      <div className="auth-panel">
        <div className="auth-form">
          <div className="mb-6 flex items-center justify-between gap-3">
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
            <LocaleSwitcher />
          </div>
          <div className="card p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
