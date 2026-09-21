"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, Toolbar, usePaged, type Column } from "@/components/admin/data-table";
import { Alert, Avatar, Badge, Button, Field, Input, Modal, PageHeader, SearchInput, Select, formatDate, statusTone } from "@/components/ui";
import * as I from "@/components/ui/icons";
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
      render: (u) => {
        const name = u.full_name || u.email || u.phone || u.id.slice(0, 8);
        return (
          <div className="row-name">
            <Avatar name={name} size="sm" tone={u.role === "ADMIN" ? "accent" : undefined} />
            <span className="min-w-0">
              <Link href={`/admin/users/${u.id}`} className="name block hover:text-accent-ink">
                {name}
              </Link>
              <span className="sub block">{[u.email, u.phone].filter(Boolean).join(" · ") || "—"}</span>
            </span>
          </div>
        );
      },
    },
    { key: "role", header: t("common.role"), render: (u) => <Badge tone={u.role === "ADMIN" ? "accent" : "neutral"}>{u.role}</Badge> },
    {
      key: "status",
      header: t("common.status"),
      render: (u) => (
        <Badge tone={statusTone(u.status)} dot>
          {u.status}
        </Badge>
      ),
    },
    { key: "created", header: t("common.created"), render: (u) => <span className="muted">{formatDate(u.created_at)}</span> },
  ];

  const statusOptions = [
    { value: "", label: t("admin.allStatuses") },
    { value: "ACTIVE", label: "ACTIVE" },
    { value: "INACTIVE", label: "INACTIVE" },
    { value: "BLOCKED", label: "BLOCKED" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={t("admin.nav.people")}
        title={t("admin.users.title")}
        icon={<I.Users size={26} />}
        actions={
          <>
            <Button variant="secondary" loading={exporting} onClick={() => void exportUsers()} icon={<I.Download size={16} />}>
              {t("admin.export.xlsx")}
            </Button>
            <Button onClick={() => setCreateOpen(true)} icon={<I.Plus size={16} />} data-testid="new-user">
              {t("admin.users.create")}
            </Button>
          </>
        }
      />
      {exportErr && (
        <Alert className="mb-4">{exportErr}</Alert>
      )}
      <Toolbar onSubmit={() => setQuery(search.trim())} meta={data ? `${t("common.total")}: ${data.total}` : undefined}>
        <SearchInput placeholder={t("admin.users.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full max-w-xs" aria-label={t("common.search")} />
        <Select value={status} onChange={(v) => setStatus(v as UserStatus | "")} options={statusOptions} className="w-44" aria-label={t("common.status")} data-testid="filter-status" />
        <Button type="submit" variant="secondary">
          {t("common.search")}
        </Button>
      </Toolbar>
      <DataTable data={data} columns={columns} loading={loading} error={error} onPage={setPage} onRowClick={(u) => router.push(`/admin/users/${u.id}`)} minWidth={640} />
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
    <Modal open={open} onClose={onClose} title={t("admin.users.create")} icon={<I.User size={18} />}>
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
