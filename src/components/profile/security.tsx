"use client";

/**
 * Xavfsizlik: parolni o'zgartirish (FE-1.9, `POST /me/password`) va 2FA (TOTP; `/me/2fa/*`).
 * 2FA holati — `user.two_factor_enabled` (B13); eski backend'da maydon bo'lmasa ikkala amal ko'rsatiladi.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { Alert, Badge, Button, Card, Field, Input } from "@/components/ui";
import { authApi, errorMessage, type TwoFactorSetup } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useT } from "@/i18n";

export function PasswordCard() {
  const { t } = useT();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPw !== confirm) return setMsg({ tone: "danger", text: t("auth.passwordMismatch") });
    if (newPw.length < 8) return setMsg({ tone: "danger", text: t("auth.passwordTooShort") });
    setBusy(true);
    try {
      await authApi.changePassword(oldPw, newPw);
      setMsg({ tone: "success", text: t("profile.password.changed") });
      setOldPw("");
      setNewPw("");
      setConfirm("");
    } catch (err) {
      setMsg({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-base font-semibold text-text">{t("profile.password.title")}</h2>
      <form onSubmit={submit} className="space-y-3">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Field label={t("profile.password.old")}>
          <Input type="password" autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} required />
        </Field>
        <Field label={t("profile.password.new")}>
          <Input type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} />
        </Field>
        <Field label={t("auth.confirmPassword")}>
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        <Button type="submit" loading={busy}>
          {t("profile.password.submit")}
        </Button>
      </form>
    </Card>
  );
}

function QrCanvas({ text }: { text: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) QRCode.toCanvas(ref.current, text, { width: 192, margin: 1 }).catch(() => undefined);
  }, [text]);
  return <canvas ref={ref} className="rounded-md bg-white" aria-label="QR" />;
}

export function TwoFactorCard() {
  const { t } = useT();
  const { user, refresh } = useAuth();
  const enabled = user?.two_factor_enabled; // undefined — backend maydonni bermaydi
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"idle" | "enable" | "disable">("idle");
  const [msg, setMsg] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);

  async function startSetup() {
    setMsg(null);
    setBusy(true);
    try {
      setSetup(await authApi.twoFactorSetup());
      setMode("enable");
    } catch (err) {
      setMsg({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      if (mode === "enable") await authApi.twoFactorEnable(code.trim());
      else await authApi.twoFactorDisable(code.trim());
      setMsg({ tone: "success", text: mode === "enable" ? t("profile.twofa.enabled") : t("profile.twofa.disabled") });
      setMode("idle");
      setSetup(null);
      setCode("");
      void refresh();
    } catch (err) {
      setMsg({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-base font-semibold text-text">{t("profile.twofa.title")}</h2>
        {enabled !== undefined && <Badge tone={enabled ? "success" : "neutral"}>{enabled ? t("profile.twofa.on") : t("profile.twofa.off")}</Badge>}
      </div>
      <p className="mb-4 text-xs text-muted">{t("profile.twofa.description")}</p>
      {msg && (
        <div className="mb-3">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}
      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          {enabled !== true && (
            <Button onClick={() => void startSetup()} loading={busy}>
              {t("profile.twofa.enable")}
            </Button>
          )}
          {enabled !== false && (
            <Button variant="secondary" onClick={() => setMode("disable")}>
              {t("profile.twofa.disable")}
            </Button>
          )}
        </div>
      )}
      {mode !== "idle" && (
        <form onSubmit={submit} className="space-y-3">
          {mode === "enable" && setup && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <QrCanvas text={setup.provisioning_uri} />
              <div className="space-y-2 text-sm text-text">
                <p>{t("profile.twofa.scan")}</p>
                <p className="text-xs text-muted">{t("profile.twofa.secretHint")}</p>
                <code className="block break-all rounded-md bg-bg px-2 py-1 font-mono text-xs">{setup.secret}</code>
              </div>
            </div>
          )}
          <Field label={t("profile.twofa.code")}>
            <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required className="max-w-[160px] font-mono tracking-widest" />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" loading={busy} variant={mode === "disable" ? "danger" : "primary"}>
              {mode === "enable" ? t("profile.twofa.confirmEnable") : t("profile.twofa.confirmDisable")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setMode("idle"); setSetup(null); setCode(""); }}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
