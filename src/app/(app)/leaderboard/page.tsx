"use client";

/**
 * 44.6: "Reyting" — kunlik o'qish seriyasi (Duolingo kabi). Yuqorida o'z ko'rsatkichlarim (joriy seriya, eng uzun,
 * jami kunlar, bugun o'qidimmi), pastda top ro'yxat; o'zim topda bo'lmasam — alohida qatorda o'rnim.
 */
import { Alert, Card, PageHeader, Spinner, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { streakApi, type LeaderboardEntry } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { useStreak } from "@/lib/streak-store";
import { formatNumber, useT } from "@/i18n";

export default function LeaderboardPage() {
  const { t, locale } = useT();
  const streak = useStreak();
  const { data, error } = useAsync(() => streakApi.leaderboard(20), []);
  const meInTop = data?.entries.some((e) => e.is_me);

  const row = (e: LeaderboardEntry, extra = false) => (
    <li key={`${e.rank}-${e.display_name}`} className={cn("lb-row", e.is_me && "me", extra && "extra")} data-testid={e.is_me ? "lb-me" : "lb-row"}>
      <span className={cn("lb-rank", e.rank <= 3 && `top${e.rank}`)}>{e.rank}</span>
      <span className="lb-name user-text">{e.is_me ? `${e.display_name} · ${t("streak.you")}` : e.display_name}</span>
      <span className="lb-best" title={t("streak.longest")}>
        {t("streak.daysShort", { n: formatNumber(e.longest_streak, locale) })}
      </span>
      <span className="lb-current" title={t("streak.current")}>
        <I.Flame size={15} />
        {formatNumber(e.current_streak, locale)}
      </span>
    </li>
  );

  return (
    <div className="space-y-5">
      <PageHeader title={t("streak.title")} description={t("streak.sub")} icon={<I.Trophy size={24} />} />

      {streak && (
        <div className="grid gap-4 sm:grid-cols-3" data-testid="my-streak">
          <div className={cn("streak-card", streak.active_today && "active")}>
            <span className="streak-card-label">{t("streak.current")}</span>
            <span className="streak-card-value">
              <I.Flame size={22} />
              {t("streak.days", { n: formatNumber(streak.current_streak, locale) })}
            </span>
            <span className="streak-card-hint" data-testid="streak-today">
              {streak.active_today ? t("streak.todayDone") : t("streak.todayTodo")}
            </span>
          </div>
          <div className="streak-card">
            <span className="streak-card-label">{t("streak.longest")}</span>
            <span className="streak-card-value">{t("streak.days", { n: formatNumber(streak.longest_streak, locale) })}</span>
          </div>
          <div className="streak-card">
            <span className="streak-card-label">{t("streak.total")}</span>
            <span className="streak-card-value">{t("streak.days", { n: formatNumber(streak.total_days, locale) })}</span>
          </div>
        </div>
      )}

      <Card title={t("streak.top")} padded={false}>
        {error && !data ? (
          <Alert className="m-5">{error}</Alert>
        ) : !data ? (
          <div className="p-5">
            <Spinner />
          </div>
        ) : data.entries.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t("streak.empty")}</p>
        ) : (
          <>
            <div className="lb-head" aria-hidden>
              <span>#</span>
              <span>{t("streak.reader")}</span>
              <span>{t("streak.longest")}</span>
              <span>{t("streak.current")}</span>
            </div>
            <ol className="lb-list" data-testid="leaderboard">
              {data.entries.map((e) => row(e))}
              {!meInTop && data.me && row(data.me, true)}
            </ol>
          </>
        )}
      </Card>
    </div>
  );
}
