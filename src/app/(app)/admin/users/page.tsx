"use client";

import { useState } from "react";
import Link from "next/link";
import { DataTable, usePaged, type Column } from "@/components/admin/data-table";
import { Badge, Button, Input, PageHeader, Select, formatDate, statusTone } from "@/components/ui";
import { adminApi, type User, type UserStatus } from "@/lib/api";
import { useT } from "@/i18n";

export default function AdminUsersPage() {
  const { t } = useT();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<UserStatus | "">("");

  const { data, loading, error, setPage } = usePaged<User>(
    (page) => adminApi.users({ page, search: query || undefined, status: status || undefined }),
    [query, status],
  );

  const columns: Column<User>[] = [
    {
      key: "who",
      header: t("common.user"),
      render: (u) => (
        <Link href={`/admin/users/${u.id}`} className="text-accent hover:underline">
          {u.full_name || u.email || u.phone || u.id.slice(0, 8)}
        </Link>
      ),
    },
    { key: "contact", header: t("admin.users.contact"), render: (u) => <span className="text-muted">{[u.email, u.phone].filter(Boolean).join(" · ") || "—"}</span> },
    { key: "role", header: t("common.role"), render: (u) => <Badge tone={u.role === "ADMIN" ? "info" : "neutral"}>{u.role}</Badge> },
    { key: "status", header: t("common.status"), render: (u) => <Badge tone={statusTone(u.status)}>{u.status}</Badge> },
    { key: "created", header: t("common.created"), render: (u) => <span className="text-muted">{formatDate(u.created_at)}</span> },
  ];

  return (
    <div>
      <PageHeader title={t("admin.users.title")} />
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
      >
        <Input placeholder={t("admin.users.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={status} onChange={(e) => setStatus(e.target.value as UserStatus | "")} className="w-40">
          <option value="">{t("admin.allStatuses")}</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="BLOCKED">BLOCKED</option>
        </Select>
        <Button type="submit" variant="secondary">
          {t("common.search")}
        </Button>
      </form>
      <DataTable data={data} columns={columns} loading={loading} error={error} onPage={setPage} />
    </div>
  );
}
