"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, PageHeader, Spinner, formatDate } from "@/components/ui";
import { adminApi, type AuditLog } from "@/lib/api";

interface Stats {
  users: number;
  books: number;
  access: number;
  logs: AuditLog[];
}

export default function AdminHome() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const [u, b, a, l] = await Promise.allSettled([
        adminApi.users({ page_size: 1 }),
        adminApi.books({ page_size: 1 }),
        adminApi.access({ page_size: 1 }),
        adminApi.auditLogs({ page_size: 8 }),
      ]);
      setStats({
        users: u.status === "fulfilled" ? u.value.total : 0,
        books: b.status === "fulfilled" ? b.value.total : 0,
        access: a.status === "fulfilled" ? a.value.total : 0,
        logs: l.status === "fulfilled" ? l.value.items : [],
      });
    })();
  }, []);

  const tiles = [
    { href: "/admin/users", label: "Foydalanuvchilar", value: stats?.users },
    { href: "/admin/books", label: "Kitoblar", value: stats?.books },
    { href: "/admin/access", label: "Ruxsatlar", value: stats?.access },
  ];

  return (
    <div>
      <PageHeader title="Boshqaruv paneli" description="Kitoblar, foydalanuvchilar va ruxsatlarni boshqarish." />
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="p-5 transition-colors hover:border-accent">
              <p className="text-sm text-muted">{t.label}</p>
              <p className="mt-1 text-3xl font-semibold text-text">{t.value ?? <Spinner className="size-6" />}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">So&apos;nggi admin amallari</h2>
          <Link href="/admin/audit-logs" className="text-sm text-accent hover:underline">
            Barchasi →
          </Link>
        </div>
        {!stats ? (
          <Spinner />
        ) : stats.logs.length === 0 ? (
          <p className="text-sm text-muted">Yozuvlar yo&apos;q</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {stats.logs.map((l) => (
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
