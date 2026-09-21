"use client";

/**
 * Admin dashboard (FE-6.9): GET /admin/stats — umumiy sonlar va holat bo'yicha taqsimot.
 * Endpoint bo'lmasa (eski backend) ro'yxat `total`laridan hisoblanadi.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Card, PageHeader, Spinner, formatDate, statusTone } from "@/components/ui";
import { adminApi, isApiError, type AdminStats, type AuditLog } from "@/lib/api";
import { useT } from "@/i18n";

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
  const tiles: Array<{ href: string; label: string; value?: number; breakdown?: Record<string, number> }> = [
    { href: "/admin/users", label: t("nav.admin.users"), value: s?.users.total, breakdown: s?.users.by_status },
    { href: "/admin/books", label: t("nav.admin.books"), value: s?.books.total, breakdown: s?.books.by_status },
    ...(s?.articles ? [{ href: "/admin/books", label: t("admin.stats.articles"), value: s.articles.total, breakdown: s.articles.by_processing }] : []),
    { href: "/admin/access", label: t("nav.admin.access"), value: s?.access.total, breakdown: s?.access.by_status },
    { href: "/admin/categories", label: t("nav.admin.categories"), value: s?.categories },
    { href: "/admin/orders", label: t("admin.orders.awaiting"), value: data?.ordersAwaiting },
    ...(data && !data.fallback
      ? [
          { href: "/admin/books", label: t("admin.stats.annotations"), value: s?.annotations },
          { href: "/admin/users", label: t("admin.stats.activeSessions"), value: s?.active_sessions },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader title={t("admin.title")} description={t("admin.description")} />
      {data?.fallback && (
        <div className="mb-4">
          <Alert tone="info">{t("admin.stats.fallback")}</Alert>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile, i) => (
          <Link key={`${tile.href}-${i}`} href={tile.href}>
            <Card className="h-full p-5 transition-colors hover:border-accent">
              <p className="text-sm text-muted">{tile.label}</p>
              <p className="mt-1 text-3xl font-semibold text-text">{tile.value ?? <Spinner className="size-6" />}</p>
              {tile.breakdown && Object.keys(tile.breakdown).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(tile.breakdown).map(([k, v]) => (
                    <Badge key={k} tone={statusTone(k)}>
                      {k}: {v}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          </Link>
        ))}
      </div>
      {s?.users.by_role && (
        <p className="mt-3 text-xs text-muted">
          {t("common.role")}:{" "}
          {Object.entries(s.users.by_role)
            .map(([k, v]) => `${k} ${v}`)
            .join(" · ")}
        </p>
      )}

      <Card className="mt-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">{t("admin.recentActions")}</h2>
          <Link href="/admin/audit-logs" className="text-sm text-accent hover:underline">
            {t("admin.all")}
          </Link>
        </div>
        {!data ? (
          <Spinner />
        ) : data.logs.length === 0 ? (
          <p className="text-sm text-muted">{t("admin.noRecords")}</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {data.logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-text">
                  <span className="font-mono text-xs text-accent">{l.action}</span>
                  {l.entity_type && <span className="ml-2 text-muted">{l.entity_type}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted">{formatDate(l.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
