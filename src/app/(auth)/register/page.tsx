"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, PasswordInput, passwordStrength } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { authApi, errorMessage } from "@/lib/api";
import { useT } from "@/i18n";

export default function RegisterPage() {
  const { t } = useT();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
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
      await authApi.register({ identifier, password, full_name: fullName });
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
          <input className="input" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
        </div>
      </Field>
      <Field label={t("auth.identifier")} hint={t("auth.identifierHint")}>
        <div className="input-wrap">
          <I.Mail size={16} />
          <input className="input" autoComplete="username" placeholder={t("auth.identifierPlaceholder")} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
      </Field>
      <Field label={t("auth.password")}>
        <PasswordInput withIcon autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} strength={passwordStrength(password)} />
      </Field>
      <Field label={t("auth.confirmPassword")}>
        <PasswordInput withIcon autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required aria-invalid={mismatch || undefined} />
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
      <Button type="submit" size="lg" loading={loading} icon={<I.Sparkles size={17} />}>
        {t("auth.createAccount")}
      </Button>
      <p className="text-center text-sm text-muted">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-bold text-accent-ink hover:underline">
          {t("auth.login")}
        </Link>
      </p>
    </form>
  );
}
