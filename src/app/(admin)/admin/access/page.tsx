"use client";

import { useState } from "react";
import Link from "next/link";
import { DataTable, Toolbar, usePaged, type Column } from "@/components/admin/data-table";
import { GrantModal } from "@/components/admin/user-detail";
import { Badge, Button, PageHeader, Select, formatDate, statusTone, useConfirm } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { adminApi, errorMessage, type BookAccess } from "@/lib/api";
import { useEntityNames } from "@/lib/admin-names";
import { useT } from "@/i18n";

export default function AdminAccessPage() {
  const { t } = useT();
  const confirm = useConfirm();
  const [status, setStatus] = useState("");
  const [grantOpen, setGrantOpen] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const { data, loading, error, setPage, reload } = usePaged<BookAccess>((page) => adminApi.access({ page, status: status || undefined }), [status]);
  const names = useEntityNames(
    data?.items.filter((a) => !a.user_full_name && !a.user_email).map((a) => a.user_id) ?? [],
    data?.items.filter((a) => !a.book_title).map((a) => a.book_id) ?? [],
  );

  async function revoke(a: BookAccess) {
    if (!(await confirm({ title: t("common.revoke"), message: t("admin.access.revokeConfirm"), confirmLabel: t("common.revoke"), tone: "danger" }))) return;
    setActionErr(null);
    try {
      await adminApi.revokeAccess(a.id);
      await reload();
    } catch (e) {
      setActionErr(errorMessage(e));
    }
  }

  const columns: Column<BookAccess>[] = [
    {
      key: "user",
      header: t("common.user"),
      render: (a) => (
        <Link href={`/admin/users/${a.user_id}`} className="name hover:text-accent-ink">
          {a.user_full_name || a.user_email || names.users[a.user_id] || a.user_id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: "book",
      header: t("admin.book"),
      render: (a) => (
        <Link href={`/admin/books/${a.book_id}`} className="font-semibold hover:text-accent-ink">
          {a.book_title || names.books[a.book_id] || a.book_id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: "status",
      header: t("common.status"),
      render: (a) => (
        <Badge tone={statusTone(a.status)} dot>
          {a.status}
        </Badge>
      ),
    },
    { key: "granted", header: t("admin.granted"), render: (a) => <span className="muted">{formatDate(a.granted_at)}</span> },
    { key: "revoked", header: t("admin.revoked"), render: (a) => <span className="muted">{formatDate(a.revoked_at)}</span> },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (a) =>
        (a.status ?? "ACTIVE").toUpperCase() === "ACTIVE" ? (
          <Button size="sm" variant="danger-ghost" onClick={() => void revoke(a)}>
            {t("common.revoke")}
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={t("admin.nav.people")}
        title={t("admin.access.title")}
        description={t("admin.access.description")}
        icon={<I.Key size={26} />}
        actions={
          <Button onClick={() => setGrantOpen(true)} icon={<I.Plus size={16} />} data-testid="grant-open">
            {t("admin.grant")}
          </Button>
        }
      />
      <Toolbar meta={data ? `${t("common.total")}: ${data.total}` : undefined}>
        <Select
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: t("admin.access.all") },
            { value: "ACTIVE", label: "ACTIVE" },
            { value: "REVOKED", label: "REVOKED" },
          ]}
          className="w-44"
          aria-label={t("common.status")}
          data-testid="filter-status"
        />
      </Toolbar>
      <DataTable data={data} columns={columns} loading={loading} error={error ?? actionErr} onPage={setPage} minWidth={720} />
      <GrantModal
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        onDone={() => {
          setGrantOpen(false);
          void reload();
        }}
      />
    </div>
  );
}
