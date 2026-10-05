"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, PasswordInput, passwordStrength } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { authApi, errorMessage, normalizePhone } from "@/lib/api";
import { useT } from "@/i18n";
import { useHydrated } from "@/lib/use-hydrated";

export default function RegisterPage() {
  const { t } = useT();
  const hydrated = useHydrated();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // 44.1: faqat telefon — E.164 ga keltiriladi
    const e164 = normalizePhone(phone);
    if (!e164) {
      setError(t("auth.phoneInvalid"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    setLoading(true);
    try {
      await authApi.register({ phone: e164, password, full_name: fullName });
      router.replace("/library");
    } catch (err) {
      setError(errorMessage(err, t("auth.registerFailed")));
    } finally {
      setLoading(false);
    }
  }

  const match = confirm.length > 0 && confirm === password;
  const mismatch = confirm.length > 0 && confirm !== password;
  return (
    <form onSubmit={onSubmit} className="space-y-4" data-testid="register-form">
      {error && <Alert>{error}</Alert>}
      <Field label={t("auth.fullName")}>
        <div className="input-wrap">
          <I.User size={16} />
          <input className="input" autoComplete="name" value={fullName} readOnly={!hydrated} onChange={(e) => setFullName(e.target.value)} autoFocus />
        </div>
      </Field>
      <Field label={t("auth.phone")} hint={t("auth.phoneHint")}>
        <div className="input-wrap">
          <I.Phone size={16} />
          <input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="+998 90 123 45 67" value={phone} readOnly={!hydrated} onChange={(e) => setPhone(e.target.value)} required data-testid="register-phone" />
        </div>
      </Field>
      <Field label={t("auth.password")}>
        <PasswordInput withIcon autoComplete="new-password" value={password} readOnly={!hydrated} onChange={(e) => setPassword(e.target.value)} required minLength={8} strength={passwordStrength(password)} />
      </Field>
      <Field label={t("auth.confirmPassword")}>
        <PasswordInput withIcon autoComplete="new-password" value={confirm} readOnly={!hydrated} onChange={(e) => setConfirm(e.target.value)} required aria-invalid={mismatch || undefined} />
        {match && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-success" data-testid="pw-match">
            <I.CheckCircle size={13} /> {t("auth.passwordsMatch")}
          </span>
        )}
        {mismatch && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-danger" data-testid="pw-mismatch">
            <I.XCircle size={13} /> {t("auth.passwordMismatch")}
          </span>
        )}
      </Field>
      <p className="text-xs text-muted">{t("auth.terms")}</p>
      <Button type="submit" size="lg" loading={loading} disabled={!hydrated} icon={<I.Sparkles size={17} />}>
        {t("auth.createAccount")}
      </Button>
      <p className="text-center text-sm text-muted">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" prefetch={false} className="font-bold text-accent-ink hover:underline">
          {t("auth.login")}
        </Link>
      </p>
    </form>
  );
}
