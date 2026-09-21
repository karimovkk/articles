"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Field, Input, formatDate } from "@/components/ui";
import { authApi, errorMessage, isApiError } from "@/lib/api";
import { useT } from "@/i18n";

function safeNext(v: string | null): string {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/library";
}

/** Backend `details` da limit bo'lsa (masalan `{limit: 2}`) — soni, aks holda null. */
function deviceLimit(details: unknown): number | null {
  const d = details as { limit?: unknown; max_devices?: unknown } | null | undefined;
  const n = d?.limit ?? d?.max_devices;
  return typeof n === "number" ? n : null;
}

interface ActiveDevice {
  device_name?: string | null;
  user_agent?: string | null;
  device_id?: string | null;
  last_seen_at?: string | null;
}

/** Backend `details.active_devices` bersa (kelishilgan yaxshilanish) — ro'yxat. */
function activeDevices(details: unknown): ActiveDevice[] {
  const d = details as { active_devices?: unknown } | null | undefined;
  return Array.isArray(d?.active_devices) ? (d.active_devices as ActiveDevice[]).filter((x) => x && typeof x === "object") : [];
}

/** `{sessions}` o'rniga qalin «Profil → Sessiyalar» qo'yadi. */
function deviceLimitBody(template: string, path: string) {
  const [before, after] = template.split("{sessions}");
  return (
    <>
      {before}
      <b>{path}</b>
      {after}
    </>
  );
}

function LoginForm() {
  const { t } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ code: string; text: string; details?: unknown } | null>(null);
  const [loading, setLoading] = useState(false);
  const expired = params.get("reason") === "expired";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.login(identifier, password);
      router.replace(safeNext(params.get("next")));
    } catch (err) {
      setError({ code: isApiError(err) ? err.code : "ERROR", text: errorMessage(err, t("auth.loginFailed")), details: isApiError(err) ? err.details : undefined });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-text">{t("auth.login")}</h2>
      {expired && <Alert tone="info">{t("auth.expired")}</Alert>}
      {error && error.code === "DEVICE_LIMIT_REACHED" ? (
        // FE-1.7: qurilma limiti — aniq yo'l-yo'riq
        <Alert tone="info">
          <p className="font-medium">
            {t("auth.deviceLimitTitle", { limit: deviceLimit(error.details) === null ? "" : t("auth.deviceLimitCount", { n: deviceLimit(error.details)! }) })}
          </p>
          <p className="mt-1">{deviceLimitBody(t("auth.deviceLimitBody"), t("auth.deviceLimitPath"))}</p>
          {activeDevices(error.details).length > 0 && (
            <div className="mt-2">
              <p className="font-medium">{t("auth.deviceLimitDevices")}</p>
              <ul className="mt-1 list-disc pl-5">
                {activeDevices(error.details).map((d, i) => (
                  <li key={i}>
                    {d.device_name || d.user_agent || d.device_id || "—"}
                    {d.last_seen_at && <span className="text-xs opacity-80"> · {formatDate(d.last_seen_at)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Alert>
      ) : error ? (
        <Alert>{error.text}</Alert>
      ) : null}
      <Field label={t("auth.identifier")}>
        <Input
          autoComplete="username"
          placeholder={t("auth.identifierPlaceholder")}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
      </Field>
      <Field label={t("auth.password")}>
        <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Button type="submit" className="w-full" loading={loading}>
        {t("auth.login")}
      </Button>
      <p className="text-center text-sm text-muted">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="text-accent hover:underline">
          {t("auth.register")}
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
