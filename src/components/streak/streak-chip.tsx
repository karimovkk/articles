"use client";

/** 44.6: header — "🔥 N" (ketma-ket o'qilgan kunlar); bugun o'qilmagan bo'lsa — xira, eslatma bilan. Reytingga olib boradi. */
import Link from "next/link";
import { cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { useStreak } from "@/lib/streak-store";
import { useT } from "@/i18n";

export function StreakChip({ className }: { className?: string }) {
  const { t } = useT();
  const s = useStreak();
  if (!s) return null;
  const title = s.active_today ? t("streak.chipActive", { n: s.current_streak }) : s.current_streak > 0 ? t("streak.chipKeep", { n: s.current_streak }) : t("streak.chipStart");
  return (
    <Link href="/leaderboard" className={cn("streak-chip", s.active_today && "active", className)} title={title} aria-label={title} data-testid="streak-chip" data-active={s.active_today ? "1" : "0"}>
      <I.Flame size={17} />
      <span>{s.current_streak}</span>
    </Link>
  );
}
