"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { env } from "@/lib/env";
import { useT } from "@/i18n";
import { LocaleSwitcher } from "@/i18n/locale-switcher";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-text">{env.appName}</h1>
          <p className="mt-1 text-sm text-muted">{t("app.tagline")}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">{children}</div>
        <div className="mt-4 flex items-center justify-center gap-4">
          <Link href="/catalog" className="text-sm text-muted hover:text-text">
            {t("catalog.back")}
          </Link>
          <LocaleSwitcher />
        </div>
      </div>
    </div>
  );
}
