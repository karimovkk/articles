"use client";

/**
 * 82: reyting podiumi yonidagi panellar — kompyuterda bo'sh joy o'rniga foydali ma'lumot:
 *  - "Sizning o'rningiz": o'rin, joriy seriya; keyingi o'ringa (top-20 dan tashqarida — top-20 ga) necha kun qolgani va
 *    progress; 1-o'rinda — "Siz yetakchisiz";
 *  - "Rekordlar": eng uzun seriya (egasi bilan), top o'rtacha joriy seriyasi, 7+ kunlik seriyalilar soni.
 * Hammasi `GET /streak/leaderboard` javobidan (qo'shimcha so'rov yo'q).
 */
import Link from "next/link";
import { buttonClass } from "@/components/ui";
import * as I from "@/components/ui/icons";
import type { Leaderboard } from "@/lib/api";
import { formatNumber, useT } from "@/i18n";

export function MyPlacePanel({ data }: { data: Leaderboard }) {
  const { t, locale } = useT();
  const me = data.me ?? data.entries.find((e) => e.is_me) ?? null;
  // Hali seriya yo'q — reytingga kirishga chaqiruv
  if (!me)
    return (
      <section className="lb-side lb-side-me" data-testid="lb-my-place">
        <h3 className="lb-side-title">
          <I.User size={15} />
          {t("streak.side.myPlace")}
        </h3>
        <p className="lb-side-line">
          <I.Flame size={15} className="text-[#e8590c]" />
          {t("streak.days", { n: formatNumber(0, locale) })}
        </p>
        <p className="lb-side-hint" data-testid="lb-my-place-hint">
          {t("streak.side.join")}
        </p>
        <Link href="/library" className={buttonClass("primary", "sm", "self-start")}>
          <I.BookOpen size={15} />
          {t("streak.side.start")}
        </Link>
      </section>
    );
  const inTop = data.entries.some((e) => e.is_me);
  // Kimni quvib o'tish kerak: topda — bir pog'ona yuqoridagi; topdan tashqarida — topning oxirgisi
  const target = me.rank === 1 ? null : inTop ? data.entries.find((e) => e.rank === me.rank - 1) : data.entries[data.entries.length - 1];
  const need = target ? Math.max(1, target.current_streak - me.current_streak + 1) : 0;
  const pct = target ? Math.min(100, Math.round((me.current_streak / Math.max(1, target.current_streak + 1)) * 100)) : 100;
  return (
    <section className="lb-side lb-side-me" data-testid="lb-my-place">
      <h3 className="lb-side-title">
        <I.User size={15} />
        {t("streak.side.myPlace")}
      </h3>
      <div className="lb-side-rank">
        <span className="lb-side-hash">#</span>
        {formatNumber(me.rank, locale)}
      </div>
      <p className="lb-side-line">
        <I.Flame size={15} className="text-[#e8590c]" />
        {t("streak.days", { n: formatNumber(me.current_streak, locale) })}
      </p>
      <div className="lb-side-progress" aria-hidden>
        <i style={{ width: `${pct}%` }} />
      </div>
      <p className="lb-side-hint" data-testid="lb-my-place-hint">
        {!target ? t("streak.side.leader") : inTop ? t("streak.side.toNext", { n: formatNumber(need, locale), rank: target.rank }) : t("streak.side.toTop", { n: formatNumber(need, locale), top: data.entries.length })}
      </p>
    </section>
  );
}

export function RecordsPanel({ data }: { data: Leaderboard }) {
  const { t, locale } = useT();
  const list = data.entries;
  if (!list.length) return null;
  const best = list.reduce((a, e) => (e.longest_streak > a.longest_streak ? e : a), list[0]);
  const avg = Math.round(list.reduce((s, e) => s + e.current_streak, 0) / list.length);
  const week = list.filter((e) => e.current_streak >= 7).length;
  return (
    <section className="lb-side lb-side-records" data-testid="lb-records">
      <h3 className="lb-side-title">
        <I.Trophy size={15} />
        {t("streak.side.records")}
      </h3>
      <dl className="lb-side-stats">
        <div>
          <dt>{t("streak.side.longest")}</dt>
          <dd>
            <b>{t("streak.days", { n: formatNumber(best.longest_streak, locale) })}</b>
            <span className="user-text">{best.display_name}</span>
          </dd>
        </div>
        <div>
          <dt>{t("streak.side.avg", { n: list.length })}</dt>
          <dd>
            <b>{t("streak.days", { n: formatNumber(avg, locale) })}</b>
          </dd>
        </div>
        <div>
          <dt>{t("streak.side.week")}</dt>
          <dd>
            <b>{formatNumber(week, locale)}</b>
            <span>{t("streak.side.readers")}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
