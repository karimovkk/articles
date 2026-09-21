"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/providers/auth-provider";
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Spinner, formatDate, statusTone } from "@/components/ui";
import { authApi, errorMessage, sessionsApi, type Session } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { useT } from "@/i18n";

export default function ProfilePage() {
  const { t } = useT();
  const { user, setUser, logout } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const { data: sessions, error: sessListErr, reload: loadSessions } = useAsync(() => sessionsApi.list(), []);
  const [sessErr, setSessErr] = useState<string | null>(null);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const u = await authApi.updateProfile({ full_name: fullName.trim() });
      setUser(u);
      setMsg({ tone: "success", text: t("profile.saved") });
    } catch (err) {
      setMsg({ tone: "danger", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function revoke(s: Session) {
    if (!confirm(s.is_current ? t("profile.revokeCurrentConfirm") : t("profile.revokeConfirm"))) return;
    try {
      await sessionsApi.revoke(s.id);
      if (s.is_current) {
        await logout();
        return;
      }
      loadSessions();
    } catch (e) {
      setSessErr(errorMessage(e));
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageHeader title={t("profile.title")} description={t("profile.description")} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-text">{t("profile.info")}</h2>
          <form onSubmit={saveProfile} className="space-y-4">
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            <Field label={t("auth.fullName")}>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <dl className="grid grid-cols-3 gap-y-2 text-sm">
              <dt className="text-muted">{t("common.email")}</dt>
              <dd className="col-span-2 text-text">{user.email ?? "—"}</dd>
              <dt className="text-muted">{t("common.phone")}</dt>
              <dd className="col-span-2 text-text">{user.phone ?? "—"}</dd>
              <dt className="text-muted">{t("common.role")}</dt>
              <dd className="col-span-2">
                <Badge tone={user.role === "ADMIN" ? "info" : "neutral"}>{user.role}</Badge>
              </dd>
              <dt className="text-muted">{t("common.status")}</dt>
              <dd className="col-span-2">
                <Badge tone={statusTone(user.status)}>{user.status}</Badge>
              </dd>
            </dl>
            <Button type="submit" loading={saving}>
              {t("common.save")}
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 text-base font-semibold text-text">{t("profile.sessions")}</h2>
          <p className="mb-4 text-xs text-muted">{t("profile.sessionsNote")}</p>
          {(sessErr ?? sessListErr) && <Alert>{sessErr ?? sessListErr}</Alert>}
          {!sessions ? (
            <Spinner />
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted">{t("profile.noSessions")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text">
                      {s.device_name || s.user_agent || s.device_id || s.id.slice(0, 8)}
                      {s.is_current && (
                        <span className="ml-2">
                          <Badge tone="success">{t("profile.current")}</Badge>
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {s.ip ?? s.ip_address ?? ""} · {formatDate(s.last_seen_at ?? s.created_at)}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => void revoke(s)}>
                    {t("common.revoke")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
