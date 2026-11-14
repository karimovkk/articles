"use client";

/**
 * Admin dashboard (FE-6.9): GET /admin/stats — umumiy sonlar va holat bo'yicha taqsimot.
 * Endpoint bo'lmasa (eski backend) ro'yxat `total`laridan hisoblanadi.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
  Card,
  PageHeader,
  Spinner,
  Stat,
  buttonClass,
  statusTone,
} from "@/components/ui";
import * as I from "@/components/ui/icons";
import {
  adminApi,
  isApiError,
  type AdminStats,
  type AuditLog,
} from "@/lib/api";
import {
  Meter,
  RoleArc,
  Shelf,
  Timeline,
} from "@/components/admin/dash-widgets";
import { useT } from "@/i18n";
import { useOpenOrders } from "@/lib/admin-open-orders";
import { formatNumber as fmt } from "@/i18n";
import { codeLabel } from "@/lib/status-label";

interface Loaded {
  stats: AdminStats;
  fallback: boolean;
  logs: AuditLog[];
}

/** Eski backend: /admin/stats yo'q — ro'yxatlardan minimal statistika. */
async function statsFromLists(): Promise<AdminStats> {
  const [u, b, a, c] = await Promise.allSettled([
    adminApi.users({ page_size: 1 }),
    adminApi.books({ page_size: 1 }),
    adminApi.access({ page_size: 1 }),
    adminApi.categories(),
  ]);
  const total = (r: PromiseSettledResult<{ total: number }>) =>
    r.status === "fulfilled" ? r.value.total : 0;
  return {
    users: { total: total(u) },
    books: { total: total(b) },
    access: { total: total(a) },
    categories: c.status === "fulfilled" ? c.value.total : 0,
    annotations: 0,
    active_sessions: 0,
  };
}

/** 125: raqam 0 dan qiymatgacha "sanab" chiqadi (kamroq harakat rejimida — darhol). */
function CountUp({ value }: { value: number }) {
  const [reduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [shown, setShown] = useState(0);
  const cur = useRef(0); // ekrandagi joriy qiymat (StrictMode qayta ishga tushirsa ham shu yerdan davom etadi)
  useEffect(() => {
    const start = cur.current;
    if (start === value || reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 900);
      cur.current = Math.round(
        start + (value - start) * (1 - Math.pow(1 - p, 3)),
      );
      setShown(cur.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return <>{fmt(reduced ? value : shown)}</>;
}

/** 125: "Articles365" — yilning nechanchi kuni ekanini ko'rsatuvchi oltin halqa (sarlavha bannerida). */
function YearRing() {
  const { t } = useT();
  const [now] = useState(() => new Date());
  const y = now.getFullYear();
  const total = (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 864e5;
  const day =
    Math.floor(
      (Date.UTC(y, now.getMonth(), now.getDate()) - Date.UTC(y, 0, 1)) / 864e5,
    ) + 1;
  const r = 27;
  const len = 2 * Math.PI * r;
  return (
    <div className="adm-year" data-testid="year-ring">
      <div className="adm-year-ring" aria-hidden>
        <svg viewBox="0 0 64 64">
          <defs>
            <linearGradient id="adm-year-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: "var(--gold-1)" }} />
              <stop offset="1" style={{ stopColor: "var(--gold-3)" }} />
            </linearGradient>
          </defs>
          <circle className="track" cx="32" cy="32" r={r} />
          <circle
            className="fill"
            cx="32"
            cy="32"
            r={r}
            strokeDasharray={len}
            strokeDashoffset={len * (1 - day / total)}
            style={{ ["--adm-len" as string]: len }}
          />
        </svg>
        <b>{Math.round((day / total) * 100)}%</b>
      </div>
      <div className="adm-year-text">
        <span className="big">
          {day} <span>/ {total}</span>
        </span>
        <span className="sub">{t("admin.year.day")}</span>
        <span className="sub">{t("admin.year.left", { n: total - day })}</span>
      </div>
    </div>
  );
}

export default function AdminHome() {
  const { t } = useT();
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    (async () => {
      let stats: AdminStats;
      let fallback = false;
      try {
        stats = await adminApi.stats();
      } catch (e) {
        if (!isApiError(e) || e.status !== 404)
          console.warn("[admin] /admin/stats", e);
        stats = await statsFromLists();
        fallback = true;
      }
      const logs = await adminApi
        .auditLogs({ page_size: 8 })
        .then((r) => r.items)
        .catch(() => [] as AuditLog[]);
      setData({ stats, fallback, logs });
    })();
  }, []);

  const s = data?.stats;
  // Ko'rib chiqilmagan buyurtmalar (PENDING + AWAITING_REVIEW) — sidebar bilan bitta manba
  const open = useOpenOrders();
  const tiles: Array<{
    href: string;
    label: string;
    value?: number;
    breakdown?: Record<string, number>;
    color: string;
  }> = [
    {
      href: "/admin/users",
      label: t("nav.admin.users"),
      value: s?.users.total,
      breakdown: s?.users.by_status,
      color: "blue",
    },
    {
      href: "/admin/books",
      label: t("nav.admin.books"),
      value: s?.books.total,
      breakdown: s?.books.by_status,
      color: "gold",
    },
    ...(s?.articles
      ? [
          {
            href: "/admin/books",
            label: t("admin.stats.articles"),
            value: s.articles.total,
            breakdown: s.articles.by_processing,
            color: "violet",
          },
        ]
      : []),
    {
      href: "/admin/access",
      label: t("nav.admin.access"),
      value: s?.access.total,
      breakdown: s?.access.by_status,
      color: "green",
    },
    {
      href: "/admin/categories",
      label: t("nav.admin.categories"),
      value: s?.categories,
      color: "teal",
    },
    {
      href: "/admin/orders",
      label: t("admin.orders.openTitle"),
      value: open?.total,
      breakdown: open
        ? { AWAITING_REVIEW: open.awaiting, PENDING: open.pending }
        : undefined,
      color: "orange",
    },
    ...(data && !data.fallback
      ? [
          {
            href: "/admin/books",
            label: t("admin.stats.annotations"),
            value: s?.annotations,
            color: "rose",
          },
          {
            href: "/admin/users",
            label: t("admin.stats.activeSessions"),
            value: s?.active_sessions,
            color: "sky",
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title={t("admin.title")}
        description={t("admin.description")}
        icon={<I.Sparkles size={26} />}
        actions={<YearRing />}
      />
      {/* 121: eslatma — faqat chek yuborilganlar (PENDING'da qiladigan ish yo'q) */}
      {!!open?.awaiting && (
        <div className="mb-4" data-testid="open-orders-alert">
          <Alert tone="warning">
            <span className="flex flex-wrap items-center justify-between gap-3">
              <span>
                <b>{t("admin.orders.openBanner", { n: open.awaiting })}</b>{" "}
                {t("admin.orders.openBreakdown", {
                  awaiting: open.awaiting,
                  pending: open.pending,
                })}
              </span>
              <Link
                href="/admin/orders"
                className={buttonClass("primary", "sm")}
              >
                {t("admin.orders.openAction")}
              </Link>
            </span>
          </Alert>
        </div>
      )}
      {data?.fallback && (
        <Alert tone="info" className="mb-4">
          {t("admin.stats.fallback")}
        </Alert>
      )}
      <div
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        data-testid="stat-grid"
      >
        {tiles.map((tile, i) => (
          <Stat
            key={`${tile.href}-${i}`}
            href={tile.href}
            label={tile.label}
            value={
              tile.value === undefined ? (
                <Spinner className="size-6" />
              ) : (
                <CountUp value={tile.value} />
              )
            }
            className={`adm-tile c-${tile.color}`}
            foot={
              tile.breakdown && Object.keys(tile.breakdown).length > 0 ? (
                <>
                  <Meter parts={tile.breakdown} />
                  {Object.entries(tile.breakdown).map(([k, v]) => (
                    <Badge key={k} tone={statusTone(k)} dot>
                      {codeLabel(k)}: {v}
                    </Badge>
                  ))}
                </>
              ) : undefined
            }
          />
        ))}
      </div>
      <div className="adm-dash-grid mt-6">
        <Card
          className="adm-tl-card"
          title={t("admin.recentActions")}
          actions={
            <Link
              href="/admin/audit-logs"
              className={buttonClass("ghost", "sm")}
            >
              {t("admin.all")}
              <I.ArrowRight size={15} />
            </Link>
          }
          padded={false}
        >
          {!data ? (
            <div className="p-5">
              <Spinner />
            </div>
          ) : data.logs.length === 0 ? (
            <p className="p-5 text-sm text-muted">{t("admin.noRecords")}</p>
          ) : (
            <Timeline logs={data.logs} />
          )}
        </Card>
        <div className="adm-dash-side">
          <Card title={t("admin.shelf.title")} padded={false}>
            <Shelf badge={open?.awaiting} />
          </Card>
          {s?.users.by_role && Object.keys(s.users.by_role).length > 0 && (
            <Card title={t("admin.roles.title")} padded={false}>
              <RoleArc roles={s.users.by_role} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
