"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/providers/auth-provider";
import { Alert, Avatar, Badge, Button, Card, Field, Input, Spinner, formatDate, statusTone, useConfirm } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { authApi, errorMessage, sessionsApi, type Session } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { shortAgent } from "@/lib/agent";
import { PasswordCard, TwoFactorCard } from "@/components/profile/security";
import { MyOrders } from "@/components/orders/my-orders";
import { useT } from "@/i18n";

export default function ProfilePage() {
  const { t } = useT();
  const confirm = useConfirm();
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
    const ok = await confirm({ title: t("common.revoke"), message: s.is_current ? t("profile.revokeCurrentConfirm") : t("profile.revokeConfirm"), confirmLabel: t("common.revoke"), tone: "danger" });
    if (!ok) return;
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

  const displayName = user.full_name || user.email || user.phone || t("common.user");
  return (
    <div className="space-y-6">
      <div className="page-head">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={displayName} size="lg" tone="accent" />
          <div className="min-w-0">
            <span className="page-eyebrow">{t("nav.profile")}</span>
            <h1 className="page-title">{displayName}</h1>
            <p className="page-sub">{t("profile.description")}</p>
          </div>
        </div>
        <div className="page-actions">
          <Badge tone={user.role === "ADMIN" ? "accent" : "neutral"}>{user.role}</Badge>
          <Badge tone={statusTone(user.status)} dot>
            {user.status}
          </Badge>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title={t("profile.info")}>
          <form onSubmit={saveProfile} className="space-y-4">
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            <Field label={t("auth.fullName")}>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-y-2.5 text-sm">
              <dt className="text-muted">{t("common.email")}</dt>
              <dd className="text-text">{user.email ?? "—"}</dd>
              <dt className="text-muted">{t("common.phone")}</dt>
              <dd className="text-text">{user.phone ?? "—"}</dd>
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
            </dl>
            <Button type="submit" loading={saving} icon={<I.Check size={16} />}>
              {t("common.save")}
            </Button>
          </form>
        </Card>

        <Card title={t("profile.sessions")} padded={false}>
          <p className="px-5 pt-4 text-xs text-muted">{t("profile.sessionsNote")}</p>
          {(sessErr ?? sessListErr) && (
            <Alert className="mx-5 mt-3">{sessErr ?? sessListErr}</Alert>
          )}
          {!sessions ? (
            <div className="p-5">
              <Spinner />
            </div>
          ) : sessions.filter((s) => !s.revoked_at).length === 0 ? (
            <p className="p-5 text-sm text-muted">{t("profile.noSessions")}</p>
          ) : (
            <ul className="tracklist mt-3">
              {sessions
                .filter((s) => !s.revoked_at)
                .map((s) => (
                  <li key={s.id} className="track">
                    <span className="track-num">{/mobile|android|iphone/i.test(s.user_agent ?? "") ? <I.Smartphone size={15} /> : <I.Monitor size={15} />}</span>
                    <span className="min-w-0">
                      <span className="track-title" title={s.user_agent ?? undefined}>
                        {shortAgent(s.user_agent) || s.id.slice(0, 8)}
                        {s.is_current && (
                          <span className="ml-2">
                            <Badge tone="success">{t("profile.current")}</Badge>
                          </span>
                        )}
                      </span>
                      <span className="track-sub">
                        {s.ip_address ?? ""} · {formatDate(s.last_active_at ?? s.created_at)}
                      </span>
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => void revoke(s)}>
                      {t("common.revoke")}
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <PasswordCard />
        <TwoFactorCard />
      </div>

      <MyOrders />
    </div>
  );
}
