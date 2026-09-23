"use client";

import { useState } from "react";
import { DataTable, Toolbar, usePaged, type Column } from "@/components/admin/data-table";
import { Alert, Button, PageHeader, Select, formatDate } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { AUDIT_ACTIONS, adminApi, errorMessage, type AuditAction, type AuditLog } from "@/lib/api";
import { auditActionLabel, auditEntityLabel, downloadBlob } from "@/lib/admin-names";
import { useT } from "@/i18n";

/** Backend audit `entity_type` qiymatlari (OpenAPI'da enum yo'q — kuzatilganlar) */
const AUDIT_ENTITIES = ["book", "article", "user", "book_access", "category", "session", "order"] as const;

export default function AdminAuditLogsPage() {
  const { t } = useT();
  const [action, setAction] = useState<AuditAction | "">("");
  const [entity, setEntity] = useState("");
  const filters = { action, entity_type: entity };
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
    { key: "time", header: t("admin.audit.time"), render: (l) => <span className="muted whitespace-nowrap">{formatDate(l.created_at)}</span> },
    {
      key: "action",
      header: t("admin.audit.action"),
      render: (l) => (
        <span className="flex flex-col gap-0.5">
          <span className="font-bold text-text">{auditActionLabel(l.action)}</span>
          <span className="font-mono text-[11.5px] text-muted">{l.action}</span>
        </span>
      ),
    },
    {
      key: "entity",
      header: t("admin.audit.entity"),
      render: (l) => (
        <span className="text-muted">
          {auditEntityLabel(l.entity_type)}
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
        eyebrow={t("admin.nav.system")}
        title={t("admin.audit.title")}
        description={t("admin.audit.description")}
        icon={<I.History size={26} />}
        actions={
          <Button variant="secondary" loading={exporting} onClick={() => void exportLogs()} icon={<I.Download size={16} />}>
            {t("admin.export.xlsx")}
          </Button>
        }
      />
      {exportErr && <Alert className="mb-4">{exportErr}</Alert>}
      <Toolbar meta={data ? `${t("common.total")}: ${data.total}` : undefined} busy={loading && !!data}>
        <Select
          value={action}
          onChange={(v) => setAction(v as AuditAction | "")}
          options={[{ value: "", label: t("admin.audit.allActions") }, ...AUDIT_ACTIONS.map((a) => ({ value: a, label: auditActionLabel(a), description: a }))]}
          className="w-64"
          aria-label={t("admin.audit.action")}
          data-testid="filter-action"
        />
        <Select
          value={entity}
          onChange={setEntity}
          options={[{ value: "", label: t("admin.audit.allEntities") }, ...AUDIT_ENTITIES.map((e) => ({ value: e, label: auditEntityLabel(e), description: e }))]}
          className="w-56"
          aria-label={t("admin.audit.entity")}
          data-testid="filter-entity"
        />
      </Toolbar>
      <DataTable data={data} columns={columns} loading={loading} error={error} onPage={setPage} minWidth={860} />
    </div>
  );
}
