"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Field, Input } from "@/components/ui";
import { authApi, errorMessage } from "@/lib/api";

function safeNext(v: string | null): string {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/library";
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
      setError(errorMessage(err, "Kirish amalga oshmadi"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-text">Kirish</h2>
      {expired && <Alert tone="info">Sessiya muddati tugadi yoki bekor qilindi. Qayta kiring.</Alert>}
      {error && <Alert>{error}</Alert>}
      <Field label="Email yoki telefon">
        <Input
          autoComplete="username"
          placeholder="user@example.com yoki +99890..."
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
      </Field>
      <Field label="Parol">
        <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Button type="submit" className="w-full" loading={loading}>
        Kirish
      </Button>
      <p className="text-center text-sm text-muted">
        Hisobingiz yo&apos;qmi?{" "}
        <Link href="/register" className="text-accent hover:underline">
          Ro&apos;yxatdan o&apos;tish
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
