"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Field, PasswordInput, formatDate } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { authApi, errorMessage, isApiError } from "@/lib/api";
import { useT } from "@/i18n";
import { useHydrated } from "@/lib/use-hydrated";

function safeNext(v: string | null): string {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/library";
}

/** 2FA talab qilinganini bildiruvchi kodlar (backend hujjatlamagan — B2). */
function isTwoFactorCode(code: string): boolean {
  return /TWO_FACTOR|2FA|TOTP_REQUIRED|OTP_REQUIRED/i.test(code);
}

/** 38: `DEVICE_NOT_ALLOWED` details — `{ limit, devices: [{ name, bound_at, last_seen_at }] }` */
interface BoundDevice {
  name?: string | null;
  bound_at?: string | null;
  last_seen_at?: string | null;
}
function deviceDetails(details: unknown): { limit: number | null; devices: BoundDevice[] } {
  const d = details as { limit?: unknown; devices?: unknown } | null | undefined;
  return {
    limit: typeof d?.limit === "number" ? d.limit : null,
    devices: Array.isArray(d?.devices) ? (d.devices as BoundDevice[]).filter((x) => x && typeof x === "object") : [],
  };
}

function LoginForm() {
  const { t } = useT();
  const hydrated = useHydrated();
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ code: string; text: string; details?: unknown } | null>(null);
  const [loading, setLoading] = useState(false);
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const expired = params.get("reason") === "expired";
  const deviceRemoved = params.get("reason") === "device_removed";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.login(identifier, password, needTotp ? totp.trim() : undefined);
      router.replace(safeNext(params.get("next")));
    } catch (err) {
      const code = isApiError(err) ? err.code : "ERROR";
      // 2FA yoqilgan hisob: kod maydonini ko'rsatish (B2 — aniq kod nomi backend'dan kutilmoqda)
      if (isTwoFactorCode(code)) {
        setNeedTotp(true);
        setError(needTotp ? { code, text: errorMessage(err) } : null);
        return;
      }
      setError({ code, text: errorMessage(err, t("auth.loginFailed")), details: isApiError(err) ? err.details : undefined });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
      {expired && <Alert tone="info">{t("auth.expired")}</Alert>}
      {deviceRemoved && !error && (
        <div data-testid="device-removed">
          <Alert tone="warning">{t("auth.deviceRemoved")}</Alert>
        </div>
      )}
      {error && error.code === "DEVICE_NOT_ALLOWED" ? (
        // 38: 3-qurilma — chiqish joy bo'shatmaydi, faqat administrator qurilmani olib tashlaydi
        <div data-testid="device-not-allowed">
          <Alert tone="info">
            <p className="font-medium">{t("auth.deviceNotAllowedTitle", { n: deviceDetails(error.details).limit ?? 2 })}</p>
            <p className="mt-1">{t("auth.deviceNotAllowedBody")}</p>
            {deviceDetails(error.details).devices.length > 0 && (
              <div className="mt-2">
                <p className="font-medium">{t("auth.deviceNotAllowedDevices")}</p>
                <ul className="mt-1 list-disc pl-5">
                  {deviceDetails(error.details).devices.map((d, i) => (
                    <li key={i} className="user-text">
                      {d.name || t("devices.unknown")}
                      {d.last_seen_at && <span className="text-xs opacity-80"> · {formatDate(d.last_seen_at)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Alert>
        </div>
      ) : error ? (
        <Alert>{error.text}</Alert>
      ) : null}
      <Field label={t("auth.identifier")}>
        <div className="input-wrap">
          <I.User size={16} />
          <input className="input" autoComplete="username" placeholder={t("auth.identifierPlaceholder")} value={identifier} readOnly={!hydrated} onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
        </div>
      </Field>
      <Field label={t("auth.password")}>
        <PasswordInput withIcon autoComplete="current-password" value={password} readOnly={!hydrated} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {needTotp && (
        <Field label={t("auth.totp")} hint={t("auth.totpHint")}>
          <div className="input-wrap">
            <I.ShieldCheck size={16} />
            <input className="input font-mono tracking-widest" value={totp} readOnly={!hydrated} onChange={(e) => setTotp(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required autoFocus />
          </div>
        </Field>
      )}
      <Button type="submit" size="lg" loading={loading} disabled={!hydrated}>
        {t("auth.login")}
        <I.ArrowRight size={17} />
      </Button>
      <p className="text-center text-sm text-muted">
        {t("auth.noAccount")}{" "}
        <Link href="/register" prefetch={false} className="font-bold text-accent-ink hover:underline">
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
