"use client";

/**
 * Mavzu almashtirgich: chapda oy (tungi), o'ngda quyosh (kunduzgi); tugmacha faol tomonga suriladi,
 * ikonkalar aylanib almashadi. Bosilgan nuqta `toggle`ga beriladi — sahifa shu nuqtadan "to'lqin" bilan almashadi.
 */
import { useTheme } from "@/providers/theme-provider";
import { useT } from "@/i18n";
import { cn } from "./cn";
import * as I from "./icons";

export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const { t } = useT();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={t("theme.toggle")}
      title={dark ? t("theme.light") : t("theme.dark")}
      className={cn("theme-switch", dark && "is-dark", className)}
      data-testid="theme-toggle"
      onClick={(e) => {
        // Klaviatura (Enter/Space) — koordinata yo'q: tugma markazidan
        const r = e.currentTarget.getBoundingClientRect();
        const x = e.detail === 0 ? r.left + r.width / 2 : e.clientX;
        const y = e.detail === 0 ? r.top + r.height / 2 : e.clientY;
        toggle({ x, y });
      }}
    >
      <span className="ts-icon ts-moon">
        <I.Moon size={13} />
      </span>
      <span className="ts-icon ts-sun">
        <I.Sun size={13} />
      </span>
      <span className="ts-knob" aria-hidden>
        <I.Sun size={14} className="k-sun" />
        <I.Moon size={14} className="k-moon" />
      </span>
    </button>
  );
}
