"use client";

import { useState } from "react";
import Link from "next/link";
import { DataTable, usePaged, type Column } from "@/components/admin/data-table";
import { Badge, Button, Input, PageHeader, Select, formatDate, statusTone } from "@/components/ui";
import { adminApi, type User, type UserStatus } from "@/lib/api";

export default function AdminUsersPage() {
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
      header: "Foydalanuvchi",
      render: (u) => (
        <Link href={`/admin/users/${u.id}`} className="text-accent hover:underline">
          {u.full_name || u.email || u.phone || u.id.slice(0, 8)}
        </Link>
      ),
    },
    { key: "contact", header: "Kontakt", render: (u) => <span className="text-muted">{[u.email, u.phone].filter(Boolean).join(" · ") || "—"}</span> },
    { key: "role", header: "Rol", render: (u) => <Badge tone={u.role === "ADMIN" ? "info" : "neutral"}>{u.role}</Badge> },
    { key: "status", header: "Holat", render: (u) => <Badge tone={statusTone(u.status)}>{u.status}</Badge> },
    { key: "created", header: "Yaratilgan", render: (u) => <span className="text-muted">{formatDate(u.created_at)}</span> },
  ];

  return (
    <div>
      <PageHeader title="Foydalanuvchilar" />
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
      >
        <Input placeholder="Email, telefon yoki ism…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={status} onChange={(e) => setStatus(e.target.value as UserStatus | "")} className="w-40">
          <option value="">Barcha holatlar</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="BLOCKED">BLOCKED</option>
        </Select>
        <Button type="submit" variant="secondary">
          Qidirish
        </Button>
      </form>
      <DataTable data={data} columns={columns} loading={loading} error={error} onPage={setPage} />
    </div>
  );
}
