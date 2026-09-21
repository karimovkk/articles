"use client";

import { useState } from "react";
import { DataTable, usePaged, type Column } from "@/components/admin/data-table";
import { Alert, Button, Input, PageHeader, Select, formatDate } from "@/components/ui";
import { AUDIT_ACTIONS, adminApi, errorMessage, type AuditAction, type AuditLog } from "@/lib/api";
import { downloadBlob } from "@/lib/admin-names";
import { useT } from "@/i18n";

export default function AdminAuditLogsPage() {
  const { t } = useT();
  const [action, setAction] = useState<AuditAction | "">("");
  const [entity, setEntity] = useState("");
  const [filters, setFilters] = useState<{ action: AuditAction | ""; entity_type: string }>({ action: "", entity_type: "" });
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  async function exportLogs() {
    setExporting(true);
    setExportErr(null);
    try {
      const { blob, filename } = await adminApi.exportBlob("audit-logs");
      downloadBlob(blob, filename ?? `audit-logs-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      setExportErr(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  const { data, loading, error, setPage } = usePaged<AuditLog>(
    (page) => adminApi.auditLogs({ page, action: filters.action || undefined, entity_type: filters.entity_type || undefined }),
    [filters],
  );

  const columns: Column<AuditLog>[] = [
    { key: "time", header: t("admin.audit.time"), render: (l) => <span className="whitespace-nowrap text-muted">{formatDate(l.created_at)}</span> },
    { key: "action", header: t("admin.audit.action"), render: (l) => <span className="font-mono text-xs text-accent">{l.action}</span> },
    {
      key: "entity",
      header: t("admin.audit.entity"),
      render: (l) => (
        <span className="text-muted">
          {l.entity_type ?? "—"}
          {l.entity_id && <span className="ml-1 font-mono text-[11px]">{l.entity_id.slice(0, 8)}</span>}
        </span>
      ),
    },
    { key: "admin", header: t("admin.audit.admin"), render: (l) => <span className="font-mono text-[11px] text-muted">{l.admin_id?.slice(0, 8) ?? "—"}</span> },
    { key: "ip", header: "IP", render: (l) => <span className="text-muted">{l.ip_address ?? "—"}</span> },
    {
      key: "meta",
      header: t("admin.audit.meta"),
      render: (l) =>
        l.meta && Object.keys(l.meta).length ? (
          <code className="block max-w-xs truncate text-[11px] text-muted" title={JSON.stringify(l.meta)}>
            {JSON.stringify(l.meta)}
          </code>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("admin.audit.title")}
        description={t("admin.audit.description")}
        actions={
          <Button variant="secondary" size="sm" loading={exporting} onClick={() => void exportLogs()}>
            {t("admin.export.xlsx")}
          </Button>
        }
      />
      {exportErr && (
        <div className="mb-4">
          <Alert>{exportErr}</Alert>
        </div>
      )}
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ action, entity_type: entity.trim() });
        }}
      >
        <Select value={action} onChange={(e) => setAction(e.target.value as AuditAction | "")} className="w-64">
          <option value="">{t("admin.audit.allActions")}</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Input placeholder={t("admin.audit.entityPlaceholder")} value={entity} onChange={(e) => setEntity(e.target.value)} className="max-w-xs" />
        <Button type="submit" variant="secondary">
          {t("common.filter")}
        </Button>
      </form>
      <DataTable data={data} columns={columns} loading={loading} error={error} onPage={setPage} />
    </div>
  );
}
