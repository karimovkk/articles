"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, usePaged, type Column } from "@/components/admin/data-table";
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, Select, formatDate, statusTone } from "@/components/ui";
import { adminApi, errorMessage, type User, type UserStatus } from "@/lib/api";
import { downloadBlob } from "@/lib/admin-names";
import { useT } from "@/i18n";

export default function AdminUsersPage() {
  const { t } = useT();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  async function exportUsers() {
    setExporting(true);
    setExportErr(null);
    try {
      const { blob, filename } = await adminApi.exportBlob("users");
      downloadBlob(blob, filename ?? `users-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      setExportErr(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }

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
      <PageHeader
        title={t("admin.users.title")}
        actions={
          <>
            <Button variant="secondary" size="sm" loading={exporting} onClick={() => void exportUsers()}>
              {t("admin.export.xlsx")}
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              {t("admin.users.create")}
            </Button>
          </>
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
      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(u) => router.push(`/admin/users/${u.id}`)} />
    </div>
  );
}

/** PM Q1: admin foydalanuvchi yaratadi — email yoki telefon (ixtiyoriy), ism, parol (majburiy). */
function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (u: User) => void }) {
  const { t } = useT();
  const [identifier, setIdentifier] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const v = identifier.trim();
      const contact = v ? (v.includes("@") ? { email: v.toLowerCase() } : { phone: v.replace(/[\s-]/g, "") }) : {};
      onCreated(await adminApi.createUser({ ...contact, full_name: fullName.trim() || null, password }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("admin.users.create")}>
      <form onSubmit={submit} className="space-y-3">
        {error && <Alert>{error}</Alert>}
        <Field label={t("auth.fullName")}>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label={t("auth.identifier")} hint={t("admin.users.contactHint")}>
          <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={t("auth.identifierPlaceholder")} />
        </Field>
        <Field label={t("auth.password")} hint={t("admin.users.passwordHint")}>
          <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="off" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={busy}>
            {t("admin.books.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
