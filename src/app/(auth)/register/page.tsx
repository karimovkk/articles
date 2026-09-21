"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input } from "@/components/ui";
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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-text">{t("auth.register")}</h2>
      {error && <Alert>{error}</Alert>}
      <Field label={t("auth.fullName")}>
        <Input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </Field>
      <Field label={t("auth.identifier")} hint={t("auth.identifierHint")}>
        <Input autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
      </Field>
      <Field label={t("auth.password")}>
        <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
      </Field>
      <Field label={t("auth.confirmPassword")}>
        <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      <Button type="submit" className="w-full" loading={loading}>
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
