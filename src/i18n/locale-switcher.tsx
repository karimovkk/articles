"use client";

import { LOCALES, useT } from "@/i18n";
import { cn } from "@/components/ui";

/** Til tanlash: UZ / RU / EN tugmalari (header va auth sahifalarida). */
export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useT();
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-md border border-border p-0.5", className)} role="group" aria-label={t("common.language")}>
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLocale(l.code)}
          title={l.label}
          aria-pressed={locale === l.code}
          className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium uppercase", locale === l.code ? "bg-bg text-text" : "text-muted hover:text-text")}
        >
          {l.code}
        </button>
      ))}
    </div>
  );
}
