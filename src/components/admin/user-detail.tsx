"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Select, Spinner, formatDate, statusTone } from "@/components/ui";
import { adminApi, errorMessage, type Book, type User, type UserStatus } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { useT } from "@/i18n";

export function AdminUserDetail({ userId }: { userId: string }) {
  const { t } = useT();
  const { data, error: loadError, reload: load } = useAsync(
    async () => {
      const [user, access, sessions] = await Promise.all([adminApi.user(userId), adminApi.userBooks(userId), adminApi.userSessions(userId)]);
      return { user, access, sessions };
    },
    [userId],
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const error = actionError ?? loadError;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return error ? <Alert>{error}</Alert> : <Spinner />;
  }
  const { user, access, sessions } = data;

  const activeAccess = access.filter((a) => (a.status ?? "ACTIVE").toUpperCase() === "ACTIVE");

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.full_name || user.email || user.phone || t("common.user")}
        description={[user.email, user.phone].filter(Boolean).join(" · ")}
        actions={
          <Link href="/admin/users" className="text-sm text-accent hover:underline">
            {t("admin.backToList")}
          </Link>
        }
      />
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold text-text">{t("admin.users.account")}</h2>
          <dl className="grid grid-cols-3 gap-y-2 text-sm">
            <dt className="text-muted">ID</dt>
            <dd className="col-span-2 font-mono text-xs text-text">{user.id}</dd>
            <dt className="text-muted">{t("common.role")}</dt>
            <dd className="col-span-2">
              <Badge tone={user.role === "ADMIN" ? "info" : "neutral"}>{user.role}</Badge>
            </dd>
            <dt className="text-muted">{t("common.status")}</dt>
            <dd className="col-span-2">
              <Badge tone={statusTone(user.status)}>{user.status}</Badge>
            </dd>
            <dt className="text-muted">{t("common.created")}</dt>
            <dd className="col-span-2 text-text">{formatDate(user.created_at)}</dd>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["ACTIVE", "INACTIVE", "BLOCKED"] as UserStatus[])
              .filter((s) => s !== user.status)
              .map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === "ACTIVE" ? "primary" : s === "BLOCKED" ? "danger" : "secondary"}
                  loading={busy}
                  onClick={() => run(() => adminApi.setUserStatus(user.id, s))}
                >
                  {s === "ACTIVE" ? t("common.activate") : s === "INACTIVE" ? t("common.deactivate") : t("common.block")}
                </Button>
              ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold text-text">{t("admin.users.sessions", { n: sessions.length })}</h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted">{t("admin.users.noSessions")}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-text">{s.device_name || s.user_agent || s.device_id || s.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted">
                      {s.ip ?? s.ip_address ?? ""} · {formatDate(s.last_seen_at ?? s.created_at)}
                    </p>
                  </div>
                  {!s.revoked_at && (
                    <Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => adminApi.revokeSession(s.id))}>
                      {t("common.revoke")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">{t("admin.users.bookAccess", { n: activeAccess.length })}</h2>
          <Button size="sm" onClick={() => setGrantOpen(true)}>
            {t("admin.grant")}
          </Button>
        </div>
        {access.length === 0 ? (
          <p className="text-sm text-muted">{t("admin.users.noAccess")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-1">{t("admin.book")}</th>
                <th className="py-1">{t("common.status")}</th>
                <th className="py-1">{t("admin.granted")}</th>
                <th className="py-1">{t("admin.revoked")}</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {access.map((a) => (
                <tr key={a.id}>
                  <td className="py-2 text-text">
                    <Link href={`/admin/books/${a.book_id}`} className="text-accent hover:underline">
                      {a.book?.title ?? a.book_id}
                    </Link>
                  </td>
                  <td className="py-2">
                    <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                  </td>
                  <td className="py-2 text-muted">{formatDate(a.granted_at)}</td>
                  <td className="py-2 text-muted">{formatDate(a.revoked_at)}</td>
                  <td className="py-2 text-right">
                    {(a.status ?? "ACTIVE").toUpperCase() === "ACTIVE" && (
                      <Button size="sm" variant="danger" loading={busy} onClick={() => run(() => adminApi.revokeAccess(a.id))}>
                        {t("common.revoke")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <GrantModal
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        userId={user.id}
        onDone={() => {
          setGrantOpen(false);
          load();
        }}
      />
    </div>
  );
}

/** Kitob tanlab, foydalanuvchiga ruxsat berish (POST /admin/book-access, idempotent). */
export function GrantModal({ open, onClose, userId, bookId, onDone }: { open: boolean; onClose: () => void; userId?: string; bookId?: string; onDone: () => void }) {
  const { t } = useT();
  const [selBook, setSelBook] = useState(bookId ?? "");
  const [selUser, setSelUser] = useState(userId ?? "");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: options, error: loadError } = useAsync(
    async () => {
      if (!open) return { books: [] as Book[], users: [] as User[] };
      const [books, users] = await Promise.all([
        bookId ? Promise.resolve([] as Book[]) : adminApi.books({ page_size: 100 }).then((r) => r.items),
        userId ? Promise.resolve([] as User[]) : adminApi.users({ page_size: 100 }).then((r) => r.items),
      ]);
      return { books, users };
    },
    [open, bookId, userId],
  );
  const books = options?.books ?? [];
  const users = options?.users ?? [];
  const error = submitError ?? loadError;

  async function submit() {
    if (!selBook || !selUser) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await adminApi.grantAccess({ user_id: selUser, book_id: selBook });
      onDone();
    } catch (e) {
      setSubmitError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("admin.access.grantTitle")}>
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {!userId && (
          <Field label={t("common.user")}>
            <Select value={selUser} onChange={(e) => setSelUser(e.target.value)}>
              <option value="">{t("admin.access.choose")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email || u.phone} {u.email ? `(${u.email})` : ""}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {!bookId && (
          <Field label={t("admin.book")}>
            <Select value={selBook} onChange={(e) => setSelBook(e.target.value)}>
              <option value="">{t("admin.access.choose")}</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} {b.author ? `— ${b.author}` : ""} [{b.status}]
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} loading={busy} disabled={!selBook || !selUser}>
            {t("admin.access.grant")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
