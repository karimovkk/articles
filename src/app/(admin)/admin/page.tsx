"use client";

/**
 * Admin dashboard (FE-6.9): GET /admin/stats — umumiy sonlar va holat bo'yicha taqsimot.
 * Endpoint bo'lmasa (eski backend) ro'yxat `total`laridan hisoblanadi.
 */
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Alert, Badge, Card, PageHeader, Spinner, Stat, buttonClass, formatDate, statusTone } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { adminApi, isApiError, type AdminStats, type AuditLog } from "@/lib/api";
import { useT } from "@/i18n";
import { formatNumber as fmt } from "@/i18n";

interface Loaded {
  stats: AdminStats;
  fallback: boolean;
  logs: AuditLog[];
  /** Tekshiruvni kutayotgan buyurtmalar (stats'da yo'q) */
  ordersAwaiting: number;
}

/** Eski backend: /admin/stats yo'q — ro'yxatlardan minimal statistika. */
async function statsFromLists(): Promise<AdminStats> {
  const [u, b, a, c] = await Promise.allSettled([
    adminApi.users({ page_size: 1 }),
    adminApi.books({ page_size: 1 }),
    adminApi.access({ page_size: 1 }),
    adminApi.categories(),
  ]);
  const total = (r: PromiseSettledResult<{ total: number }>) => (r.status === "fulfilled" ? r.value.total : 0);
  return {
    users: { total: total(u) },
    books: { total: total(b) },
    access: { total: total(a) },
    categories: c.status === "fulfilled" ? c.value.total : 0,
    annotations: 0,
    active_sessions: 0,
  };
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
        if (!isApiError(e) || e.status !== 404) console.warn("[admin] /admin/stats", e);
        stats = await statsFromLists();
        fallback = true;
      }
      const [logs, ordersAwaiting] = await Promise.all([
        adminApi
          .auditLogs({ page_size: 8 })
          .then((r) => r.items)
          .catch(() => [] as AuditLog[]),
        adminApi
          .orders({ status: "AWAITING_REVIEW", page_size: 1 })
          .then((r) => r.total)
          .catch(() => 0),
      ]);
      setData({ stats, fallback, logs, ordersAwaiting });
    })();
  }, []);

  const s = data?.stats;
  const tiles: Array<{ href: string; label: string; value?: number; breakdown?: Record<string, number>; icon: ReactNode }> = [
    { href: "/admin/users", label: t("nav.admin.users"), value: s?.users.total, breakdown: s?.users.by_status, icon: <I.Users size={17} /> },
    { href: "/admin/books", label: t("nav.admin.books"), value: s?.books.total, breakdown: s?.books.by_status, icon: <I.Book size={17} /> },
    ...(s?.articles ? [{ href: "/admin/books", label: t("admin.stats.articles"), value: s.articles.total, breakdown: s.articles.by_processing, icon: <I.FileText size={17} /> }] : []),
    { href: "/admin/access", label: t("nav.admin.access"), value: s?.access.total, breakdown: s?.access.by_status, icon: <I.Key size={17} /> },
    { href: "/admin/categories", label: t("nav.admin.categories"), value: s?.categories, icon: <I.Tag size={17} /> },
    { href: "/admin/orders", label: t("admin.orders.awaiting"), value: data?.ordersAwaiting, icon: <I.ShoppingBag size={17} /> },
    ...(data && !data.fallback
      ? [
          { href: "/admin/books", label: t("admin.stats.annotations"), value: s?.annotations, icon: <I.Highlighter size={17} /> },
          { href: "/admin/users", label: t("admin.stats.activeSessions"), value: s?.active_sessions, icon: <I.Activity size={17} /> },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader eyebrow={t("nav.admin")} title={t("admin.title")} description={t("admin.description")} icon={<I.Sparkles size={26} />} />
      {data?.fallback && (
        <Alert tone="info" className="mb-4">
          {t("admin.stats.fallback")}
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="stat-grid">
        {tiles.map((tile, i) => (
          <Stat
            key={`${tile.href}-${i}`}
            href={tile.href}
            label={tile.label}
            icon={tile.icon}
            value={tile.value === undefined ? <Spinner className="size-6" /> : fmt(tile.value)}
            foot={
              tile.breakdown && Object.keys(tile.breakdown).length > 0
                ? Object.entries(tile.breakdown).map(([k, v]) => (
                    <Badge key={k} tone={statusTone(k)} dot>
                      {k}: {v}
                    </Badge>
                  ))
                : undefined
            }
          />
        ))}
      </div>
      {s?.users.by_role && (
        <p className="mt-3 text-xs font-semibold text-muted">
          {t("common.role")}:{" "}
          {Object.entries(s.users.by_role)
            .map(([k, v]) => `${k} ${v}`)
            .join(" · ")}
        </p>
      )}

      <Card
        className="mt-6"
        title={t("admin.recentActions")}
        actions={
          <Link href="/admin/audit-logs" className={buttonClass("ghost", "sm")}>
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
          <ul className="tracklist">
            {data.logs.map((l, i) => (
              <li key={l.id} className="track">
                <span className="track-num">{i + 1}</span>
                <span className="min-w-0">
                  <span className="track-title">
                    <Badge tone="accent" className="font-mono">
                      {l.action}
                    </Badge>
                    {l.entity_type && <span className="ml-2 text-xs font-semibold text-muted">{l.entity_type}</span>}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-muted">{formatDate(l.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
