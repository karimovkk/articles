"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input } from "@/components/ui";
import { authApi, errorMessage } from "@/lib/api";

export default function RegisterPage() {
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
      setError("Parollar mos emas");
      return;
    }
    if (password.length < 8) {
      setError("Parol kamida 8 belgidan iborat bo'lishi kerak");
      return;
    }
    setLoading(true);
    try {
      await authApi.register({ identifier, password, full_name: fullName });
      router.replace("/library");
    } catch (err) {
      setError(errorMessage(err, "Ro'yxatdan o'tish amalga oshmadi"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-text">Ro&apos;yxatdan o&apos;tish</h2>
      {error && <Alert>{error}</Alert>}
      <Field label="To'liq ism">
        <Input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </Field>
      <Field label="Email yoki telefon" hint="Biri kifoya: email yoki +998 formatidagi telefon">
        <Input autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
      </Field>
      <Field label="Parol">
        <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
      </Field>
      <Field label="Parolni tasdiqlang">
        <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      <Button type="submit" className="w-full" loading={loading}>
        Hisob yaratish
      </Button>
      <p className="text-center text-sm text-muted">
        Hisobingiz bormi?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Kirish
        </Link>
      </p>
    </form>
  );
}
