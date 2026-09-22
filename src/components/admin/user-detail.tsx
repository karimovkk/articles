"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Avatar, Badge, Button, Card, Field, Modal, PasswordInput, Select, Spinner, buttonClass, cn, formatDate, passwordStrength, statusTone, useConfirm } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { adminApi, errorMessage, type Book, type User, type UserStatus } from "@/lib/api";
import { shortAgent } from "@/lib/agent";
import { useEntityNames } from "@/lib/admin-names";
import { useAsync } from "@/lib/use-async";
import { useAdminCrumb } from "./admin-shell";
import { useT } from "@/i18n";

export function AdminUserDetail({ userId }: { userId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
  const {
    data,
    error: loadError,
    reload: load,
  } = useAsync(async () => {
    const [user, access, sessions] = await Promise.all([adminApi.user(userId), adminApi.userBooks(userId), adminApi.userSessions(userId)]);
    return { user, access, sessions };
  }, [userId]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const error = actionError ?? loadError;
  const names = useEntityNames([], data?.access.filter((a) => !a.book_title).map((a) => a.book_id) ?? []);
  const displayName = data ? data.user.full_name || data.user.email || data.user.phone || t("common.user") : null;
  useAdminCrumb(displayName);

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

  async function revokeAll(id: string) {
    const ok = await confirm({ title: t("admin.users.revokeAll"), message: t("admin.users.revokeAllConfirm"), confirmLabel: t("admin.users.revokeAll"), tone: "danger" });
    if (ok) void run(() => adminApi.revokeAllSessions(id));
  }

  async function setStatus(id: string, s: UserStatus) {
    if (s === "BLOCKED") {
      const ok = await confirm({ title: t("common.block"), message: t("admin.users.blockConfirm"), confirmLabel: t("common.block"), tone: "danger" });
      if (!ok) return;
    }
    void run(() => adminApi.setUserStatus(id, s));
  }

  if (!data) {
    return error ? <Alert>{error}</Alert> : <Spinner />;
  }
  const { user, access, sessions } = data;
  const activeAccess = access.filter((a) => (a.status ?? "ACTIVE").toUpperCase() === "ACTIVE");
  const activeSessions = sessions.filter((s) => !s.revoked_at).length;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="page-head">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={displayName} size="lg" tone={user.role === "ADMIN" ? "accent" : undefined} />
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge tone={user.role === "ADMIN" ? "accent" : "neutral"}>{user.role}</Badge>
              <Badge tone={statusTone(user.status)} dot>
                {user.status}
              </Badge>
            </div>
            <h1 className="page-title">{displayName}</h1>
            <p className="page-sub">{[user.email, user.phone].filter(Boolean).join(" · ") || "—"}</p>
          </div>
        </div>
        <div className="page-actions">
          <Button variant="secondary" size="sm" onClick={() => setResetOpen(true)} icon={<I.Key size={15} />}>
            {t("admin.users.resetPassword")}
          </Button>
          <Link href="/admin/users" className={buttonClass("ghost", "sm")}>
            <I.ArrowLeft size={15} />
            {t("admin.backToList")}
          </Link>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t("admin.users.account")}>
          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-y-2.5 text-sm">
            <dt className="text-muted">ID</dt>
            <dd className="font-mono text-xs text-text">{user.id}</dd>
            <dt className="text-muted">{t("common.role")}</dt>
            <dd>
              <Badge tone={user.role === "ADMIN" ? "accent" : "neutral"}>{user.role}</Badge>
            </dd>
            <dt className="text-muted">{t("common.status")}</dt>
            <dd>
              <Badge tone={statusTone(user.status)} dot>
                {user.status}
              </Badge>
            </dd>
            <dt className="text-muted">{t("common.created")}</dt>
            <dd className="text-text">{formatDate(user.created_at)}</dd>
            {user.two_factor_enabled !== undefined && (
              <>
                <dt className="text-muted">2FA</dt>
                <dd>
                  <Badge tone={user.two_factor_enabled ? "success" : "neutral"}>{user.two_factor_enabled ? t("profile.twofa.on") : t("profile.twofa.off")}</Badge>
                </dd>
              </>
            )}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            {(["ACTIVE", "INACTIVE", "BLOCKED"] as UserStatus[])
              .filter((s) => s !== user.status)
              .map((s) => (
                <Button key={s} size="sm" variant={s === "ACTIVE" ? "primary" : s === "BLOCKED" ? "danger-ghost" : "secondary"} loading={busy} onClick={() => void setStatus(user.id, s)} data-testid={`status-${s}`}>
                  {s === "ACTIVE" ? t("common.activate") : s === "INACTIVE" ? t("common.deactivate") : t("common.block")}
                </Button>
              ))}
          </div>
        </Card>

        <Card
          title={t("admin.users.sessions", { n: sessions.length })}
          actions={
            activeSessions > 0 && (
              <Button size="sm" variant="danger-ghost" loading={busy} onClick={() => void revokeAll(user.id)}>
                {t("admin.users.revokeAll")}
              </Button>
            )
          }
          padded={false}
        >
          {sessions.length === 0 ? (
            <p className="p-5 text-sm text-muted">{t("admin.users.noSessions")}</p>
          ) : (
            <ul className="tracklist">
              {sessions.map((s) => (
                <li key={s.id} className={cn("track", s.revoked_at && "opacity-50")}>
                  <span className="track-num">{/mobile|android|iphone/i.test(s.user_agent ?? "") ? <I.Smartphone size={15} /> : <I.Monitor size={15} />}</span>
                  <span className="min-w-0">
                    <span className="track-title" title={s.user_agent ?? undefined}>
                      {shortAgent(s.user_agent) || s.id.slice(0, 8)}
                      {s.revoked_at && <span className="ml-2 text-xs font-medium text-muted">({t("admin.revoked").toLowerCase()})</span>}
                    </span>
                    <span className="track-sub">
                      {s.ip_address ?? ""} · {formatDate(s.last_active_at ?? s.created_at)}
                    </span>
                  </span>
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

      <Card
        title={t("admin.users.bookAccess", { n: activeAccess.length })}
        actions={
          <Button size="sm" onClick={() => setGrantOpen(true)} icon={<I.Plus size={15} />}>
            {t("admin.grant")}
          </Button>
        }
        padded={false}
      >
        {access.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t("admin.users.noAccess")}</p>
        ) : (
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="table" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th>{t("admin.book")}</th>
                    <th>{t("common.status")}</th>
                    <th>{t("admin.granted")}</th>
                    <th>{t("admin.revoked")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {access.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/admin/books/${a.book_id}`} className="name hover:text-accent-ink">
                          {a.book_title || names.books[a.book_id] || a.book_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td>
                        <Badge tone={statusTone(a.status)} dot>
                          {a.status}
                        </Badge>
                      </td>
                      <td className="muted">{formatDate(a.granted_at)}</td>
                      <td className="muted">{formatDate(a.revoked_at)}</td>
                      <td className="text-right">
                        {(a.status ?? "ACTIVE").toUpperCase() === "ACTIVE" && (
                          <Button size="sm" variant="danger-ghost" loading={busy} onClick={() => run(() => adminApi.revokeAccess(a.id))}>
                            {t("common.revoke")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={t("admin.users.resetPassword")} size="sm" icon={<I.Key size={18} />}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await adminApi.resetPassword(user.id, newPassword);
              setResetOpen(false);
              setNewPassword("");
              setNotice(t("admin.users.passwordReset"));
            });
          }}
          className="space-y-4"
        >
          <p className="text-xs text-muted">{t("admin.users.resetHint")}</p>
          <Field label={t("profile.password.new")}>
            <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} autoComplete="off" strength={passwordStrength(newPassword)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setResetOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={busy}>
              {t("admin.users.resetPassword")}
            </Button>
          </div>
        </form>
      </Modal>

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

/** Kitob tanlab, foydalanuvchiga ruxsat berish (POST /admin/book-access, idempotent). Qidiruvli qo'lbola Select. */
export function GrantModal({ open, onClose, userId, bookId, onDone }: { open: boolean; onClose: () => void; userId?: string; bookId?: string; onDone: () => void }) {
  const { t } = useT();
  const [selBook, setSelBook] = useState(bookId ?? "");
  const [selUser, setSelUser] = useState(userId ?? "");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: options, error: loadError } = useAsync(async () => {
    if (!open) return { books: [] as Book[], users: [] as User[] };
    const [books, users] = await Promise.all([
      bookId ? Promise.resolve([] as Book[]) : adminApi.books({ page_size: 100 }).then((r) => r.items),
      userId ? Promise.resolve([] as User[]) : adminApi.users({ page_size: 100 }).then((r) => r.items),
    ]);
    return { books, users };
  }, [open, bookId, userId]);
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
    <Modal open={open} onClose={onClose} title={t("admin.access.grantTitle")} icon={<I.Key size={18} />} data-testid="grant-modal">
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {!userId && (
          <Field label={t("common.user")}>
            <Select
              value={selUser}
              onChange={setSelUser}
              placeholder={t("admin.access.choose")}
              searchable
              options={users.map((u) => ({ value: u.id, label: u.full_name || u.email || u.phone || u.id.slice(0, 8), description: [u.email, u.phone].filter(Boolean).join(" · ") || undefined }))}
              aria-label={t("common.user")}
              data-testid="grant-user"
            />
          </Field>
        )}
        {!bookId && (
          <Field label={t("admin.book")}>
            <Select
              value={selBook}
              onChange={setSelBook}
              placeholder={t("admin.access.choose")}
              searchable
              options={books.map((b) => ({ value: b.id, label: b.title, description: `${b.author ? `${b.author} · ` : ""}${b.status}` }))}
              aria-label={t("admin.book")}
              data-testid="grant-book"
            />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} loading={busy} disabled={!selBook || !selUser} icon={<I.Check size={16} />} data-testid="grant-submit">
            {t("admin.access.grant")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
