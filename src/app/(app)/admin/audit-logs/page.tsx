"use client";

import { useState } from "react";
import { DataTable, usePaged, type Column } from "@/components/admin/data-table";
import { Button, Input, PageHeader, formatDate } from "@/components/ui";
import { adminApi, type AuditLog } from "@/lib/api";

export default function AdminAuditLogsPage() {
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [filters, setFilters] = useState({ action: "", entity_type: "" });

  const { data, loading, error, setPage } = usePaged<AuditLog>(
    (page) => adminApi.auditLogs({ page, action: filters.action || undefined, entity_type: filters.entity_type || undefined }),
    [filters],
  );

  const columns: Column<AuditLog>[] = [
    { key: "time", header: "Vaqt", render: (l) => <span className="whitespace-nowrap text-muted">{formatDate(l.created_at)}</span> },
    { key: "action", header: "Amal", render: (l) => <span className="font-mono text-xs text-accent">{l.action}</span> },
    {
      key: "entity",
      header: "Obyekt",
      render: (l) => (
        <span className="text-muted">
          {l.entity_type ?? "—"}
          {l.entity_id && <span className="ml-1 font-mono text-[11px]">{l.entity_id.slice(0, 8)}</span>}
        </span>
      ),
    },
    { key: "admin", header: "Admin", render: (l) => <span className="font-mono text-[11px] text-muted">{l.admin_id.slice(0, 8)}</span> },
    { key: "ip", header: "IP", render: (l) => <span className="text-muted">{l.ip ?? l.ip_address ?? "—"}</span> },
    {
      key: "meta",
      header: "Meta",
      render: (l) =>
        l.metadata && Object.keys(l.metadata).length ? (
          <code className="block max-w-xs truncate text-[11px] text-muted" title={JSON.stringify(l.metadata)}>
            {JSON.stringify(l.metadata)}
          </code>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="Audit jurnali" description="Admin mutatsiyalari: kitob / kategoriya / foydalanuvchi / ruxsat / sessiya o'zgarishlari." />
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ action: action.trim(), entity_type: entity.trim() });
        }}
      >
        <Input placeholder="action (masalan: book.create)" value={action} onChange={(e) => setAction(e.target.value)} className="max-w-xs" />
        <Input placeholder="entity_type (book, user, …)" value={entity} onChange={(e) => setEntity(e.target.value)} className="max-w-xs" />
        <Button type="submit" variant="secondary">
          Filtrlash
        </Button>
      </form>
      <DataTable data={data} columns={columns} loading={loading} error={error} onPage={setPage} />
    </div>
  );
}
