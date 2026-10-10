"use client";

/**
 * 80: reyting podiumi — top 3: 2-o'rin chapda, 1-o'rin markazda (eng baland, toj), 3-o'rin o'ngda. O'rinlar ketma-ket
 * chiqadi (3 → 2 → 1: poydevor o'sadi, avatar sakrab tushadi), 1-o'rin chiqqach ustida mushakbozlik boshlanadi.
 * Harakat CSS animatsiyalari (`--d` kechikish); reduced-motion — hammasi darhol va harakatsiz.
 */
import { useEffect, useState } from "react";
import { cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import type { LeaderboardEntry } from "@/lib/api";
import { formatNumber, useT } from "@/i18n";
import { Fireworks } from "./fireworks";

/** Chiqish tartibi: 3 → 2 → 1 (soniya) */
const DELAY: Record<number, number> = { 3: 0.15, 2: 0.75, 1: 1.35 };
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

export function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  const { t, locale } = useT();
  const top = entries.filter((e) => e.rank <= 3).slice(0, 3);
  // Mushakbozlik — 1-o'rin chiqib bo'lgach
  const [cheer, setCheer] = useState(false);
  const hasFirst = top.some((e) => e.rank === 1);
  useEffect(() => {
    if (!hasFirst) return;
    const id = window.setTimeout(() => setCheer(true), (DELAY[1] + 0.55) * 1000);
    return () => window.clearTimeout(id);
  }, [hasFirst]);
  if (!top.length) return null;
  // Ko'rinish tartibi: 2 · 1 · 3
  const order = [2, 1, 3].map((r) => top.find((e) => e.rank === r)).filter((e): e is LeaderboardEntry => !!e);

  return (
    <div className={cn("podium", `n${top.length}`)} data-testid="podium">
      {hasFirst && <Fireworks active={cheer} className="podium-fireworks" />}
      {order.map((e) => (
        <div key={e.rank} className={cn("podium-place", `p${e.rank}`, e.is_me && "me")} style={{ ["--d" as string]: `${DELAY[e.rank]}s` }} data-testid="podium-place" data-rank={e.rank}>
          <div className="podium-person">
            {e.rank === 1 && (
              <span className="podium-crown" aria-hidden>
                <svg viewBox="0 0 24 16" width="34" height="23">
                  <path d="M2 14 0.6 3.6l6 4.6L12 0l5.4 8.2 6-4.6L22 14z" fill="currentColor" />
                  <rect x="2" y="13.6" width="20" height="2.4" rx="1.2" fill="currentColor" />
                </svg>
              </span>
            )}
            <span className="podium-avatar" aria-hidden>
              {initials(e.display_name)}
              <span className="podium-medal">{e.rank}</span>
            </span>
            <span className="podium-name user-text" title={e.display_name}>
              {e.display_name}
            </span>
            {e.is_me && <span className="podium-you">{t("streak.you")}</span>}
            <span className="podium-streak" title={t("streak.current")}>
              <I.Flame size={15} />
              {formatNumber(e.current_streak, locale)}
            </span>
            <span className="podium-best">{t("streak.bestShort", { n: formatNumber(e.longest_streak, locale) })}</span>
          </div>
          <div className="podium-block" aria-hidden>
            <span>{e.rank}</span>
          </div>
          <span className="sr-only">{t("streak.placeA11y", { rank: e.rank, name: e.display_name, n: e.current_streak })}</span>
        </div>
      ))}
    </div>
  );
}
