"use client";

import { LOCALES, useT } from "@/i18n";
import { Menu, MenuItem, cn } from "@/components/ui";
import { Flag } from "@/components/ui/flags";

/** Til tanlash — segment (auth sahifalari) yoki qo'lbola menyu (header). */
export function LocaleSwitcher({ className, variant = "seg" }: { className?: string; variant?: "seg" | "menu" }) {
  const { locale, setLocale, t } = useT();
  if (variant === "menu") {
    return (
      <Menu
        align="end"
        minWidth={160}
        aria-label={t("common.language")}
        trigger={(p) => (
          <button {...p} type="button" className={cn("btn ghost sm", className)} aria-label={t("common.language")} data-testid="locale-menu">
            <Flag locale={locale} size={20} />
            <span className="uppercase">{locale}</span>
          </button>
        )}
      >
        {LOCALES.map((l) => (
          <MenuItem key={l.code} selected={locale === l.code} onSelect={() => setLocale(l.code)} icon={<Flag locale={l.code} size={20} />} data-testid={`locale-${l.code}`}>
            {l.label}
          </MenuItem>
        ))}
      </Menu>
    );
  }
  return (
    <div className={cn("seg", className)} role="group" aria-label={t("common.language")}>
      {LOCALES.map((l) => (
        <button key={l.code} type="button" onClick={() => setLocale(l.code)} title={l.label} aria-pressed={locale === l.code} className={cn("uppercase", locale === l.code && "active")} data-testid={`locale-${l.code}`}>
          <Flag locale={l.code} size={18} />
          {l.code}
        </button>
      ))}
    </div>
  );
}
