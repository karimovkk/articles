"use client";

/**
 * 44.8: admin "Ko'rinish" — global ko'rinish sozlamalari (`PUT /admin/app-settings`, kalit `appearance`; hamma
 * foydalanuvchi — hatto login sahifasi — public `GET /app-settings` dan o'qiydi). Asosiy rang (qolganlari avtomatik,
 * kontrast ko'rsatiladi), yorug'/qorong'i fon (standart · rang · rasm havolasi), shrift. O'zgarish darhol oldindan
 * ko'rinadi (faqat shu brauzerda); "Saqlash" — hammaga; "Standartga qaytarish" — `DELETE …/appearance`.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Spinner, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { adminApi, errorMessage } from "@/lib/api";
import { DEFAULT_PRIMARY, appearanceCss, contrast, deriveColors, isHex, isSafeImageUrl, type Appearance } from "@/lib/appearance";
import { applyAppearance, useAppearanceSettings } from "@/providers/appearance-provider";
import { useT } from "@/i18n";

const PRESETS = ["#f2b705", "#e8590c", "#e11d48", "#7c3aed", "#2563eb", "#0d9488", "#16a34a", "#334155"];
type BgKind = "default" | "color" | "image";
const kindOf = (v: string | null | undefined): BgKind => (isHex(v) ? "color" : isSafeImageUrl(v) ? "image" : "default");

function BgField({ label, value, onChange, testid }: { label: string; value: string | null | undefined; onChange: (v: string) => void; testid: string }) {
  const { t } = useT();
  const [kind, setKind] = useState<BgKind>(kindOf(value));
  const [color, setColor] = useState(isHex(value) ? value : "#f4f2ec");
  const [url, setUrl] = useState(isSafeImageUrl(value) ? value : "");
  const pick = (k: BgKind) => {
    setKind(k);
    onChange(k === "color" ? color : k === "image" && isSafeImageUrl(url) ? url : "default");
  };
  return (
    <Field label={label}>
      <div className="space-y-2" data-testid={testid}>
        <div className="seg" role="group" aria-label={label}>
          {(["default", "color", "image"] as BgKind[]).map((k) => (
            <button key={k} type="button" className={cn(kind === k && "active")} aria-pressed={kind === k} onClick={() => pick(k)} data-testid={`${testid}-${k}`}>
              {t(`appearance.bg.${k}`)}
            </button>
          ))}
        </div>
        {kind === "color" && (
          <div className="flex items-center gap-2">
            <input type="color" value={color} onChange={(e) => (setColor(e.target.value), onChange(e.target.value))} className="appearance-swatch-input" aria-label={label} />
            <Input value={color} onChange={(e) => (setColor(e.target.value), isHex(e.target.value) && onChange(e.target.value))} className="w-32 font-mono" maxLength={7} />
          </div>
        )}
        {kind === "image" && (
          <>
            <Input value={url} placeholder="https://…/fon.webp" onChange={(e) => (setUrl(e.target.value), onChange(isSafeImageUrl(e.target.value) ? e.target.value : "default"))} data-testid={`${testid}-url`} />
            {url && !isSafeImageUrl(url) && <p className="text-xs text-danger">{t("appearance.bg.urlInvalid")}</p>}
          </>
        )}
      </div>
    </Field>
  );
}

export default function AdminAppearancePage() {
  const { t } = useT();
  const { settings, loaded, reload } = useAppearanceSettings();
  const [draft, setDraft] = useState<Appearance | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  // Fon maydonlarini saqlash/bekor qilish/qaytarishdan keyin serverdagi qiymatdan qayta boshlash uchun
  const [version, setVersion] = useState(0);
  const saved = settings ?? {};
  const savedRef = useRef(settings);
  useLayoutEffect(() => {
    savedRef.current = settings;
  });
  const a: Appearance = draft ?? saved;
  const primary = isHex(a.primary_color) ? a.primary_color : DEFAULT_PRIMARY;
  const colors = useMemo(() => deriveColors(primary), [primary]);
  const btnContrast = contrast(colors.accent, colors.contrastText);

  // Oldindan ko'rish — faqat shu brauzerda, saqlanmaguncha
  useEffect(() => {
    if (draft) applyAppearance(appearanceCss(draft), { persist: false });
  }, [draft]);
  // Sahifadan ketilsa (saqlanmagan) — serverdagi holatga qaytadi
  useEffect(() => () => applyAppearance(appearanceCss(savedRef.current)), []);
  const discard = () => {
    setDraft(null);
    setVersion((v) => v + 1);
    applyAppearance(appearanceCss(savedRef.current));
  };

  const set = (patch: Partial<Appearance>) => setDraft({ ...a, ...patch });

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await adminApi.saveAppSettings({ appearance: { ...a, primary_color: primary } });
      setDraft(null);
      setVersion((v) => v + 1);
      await reload();
      setMsg({ tone: "success", text: t("appearance.saved") });
    } catch (e) {
      setMsg({ tone: "danger", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    setBusy(true);
    setMsg(null);
    try {
      await adminApi.deleteAppSetting("appearance");
      setDraft(null);
      setVersion((v) => v + 1);
      await reload();
      setMsg({ tone: "success", text: t("appearance.resetDone") });
    } catch (e) {
      setMsg({ tone: "danger", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5" data-testid="appearance-page">
      <PageHeader title={t("appearance.title")} description={t("appearance.sub")} icon={<I.Sparkles size={24} />} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {!loaded ? (
        <Spinner />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card title={t("appearance.settings")}>
            <div className="card-body space-y-5">
              <Field label={t("appearance.primary")} hint={t("appearance.primaryHint")}>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2" role="group" aria-label={t("appearance.primary")}>
                    {PRESETS.map((c) => (
                      <button key={c} type="button" className={cn("appearance-swatch", primary === c && "active")} style={{ background: c }} onClick={() => set({ primary_color: c })} aria-label={c} aria-pressed={primary === c} data-testid="appearance-preset" />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="color" value={primary} onChange={(e) => set({ primary_color: e.target.value })} className="appearance-swatch-input" aria-label={t("appearance.primary")} />
                    <Input value={a.primary_color ?? primary} onChange={(e) => set({ primary_color: e.target.value })} className="w-32 font-mono" maxLength={7} data-testid="appearance-primary" />
                  </div>
                </div>
              </Field>
              <BgField key={`l${version}`} label={t("appearance.bgLight")} value={a.background_light} onChange={(v) => set({ background_light: v })} testid="bg-light" />
              <BgField key={`d${version}`} label={t("appearance.bgDark")} value={a.background_dark} onChange={(v) => set({ background_dark: v })} testid="bg-dark" />
              <Field label={t("appearance.font")}>
                <div>
                <div className="seg" role="group" aria-label={t("appearance.font")} data-testid="appearance-font">
                  {(["manrope", "system"] as const).map((f) => (
                    <button key={f} type="button" className={cn((a.font ?? "manrope") === f && "active")} aria-pressed={(a.font ?? "manrope") === f} onClick={() => set({ font: f })}>
                      {t(`appearance.font.${f}`)}
                    </button>
                  ))}
                </div>
                </div>
              </Field>
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button onClick={() => void save()} loading={busy} disabled={!draft} icon={<I.Check size={16} />} data-testid="appearance-save">
                  {t("appearance.save")}
                </Button>
                {draft && (
                  <Button variant="ghost" onClick={discard} disabled={busy}>
                    {t("common.cancel")}
                  </Button>
                )}
                <Button variant="danger-ghost" onClick={() => void reset()} disabled={busy} className="ml-auto" data-testid="appearance-reset">
                  {t("appearance.reset")}
                </Button>
              </div>
            </div>
          </Card>

          <Card title={t("appearance.preview")}>
            <div className="card-body space-y-4" data-testid="appearance-preview">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm">{t("appearance.sampleButton")}</Button>
                <Badge tone="accent">{t("appearance.sampleBadge")}</Badge>
                <a className="text-sm font-bold text-accent-ink underline">{t("appearance.sampleLink")}</a>
              </div>
              <dl className="appearance-contrast">
                <dt>{t("appearance.cButton")}</dt>
                <dd className={cn(btnContrast < 4.5 && "warn")} data-testid="contrast-button">{btnContrast.toFixed(1)}:1</dd>
                <dt>{t("appearance.cText")}</dt>
                <dd>{contrast(colors.ink, "#ffffff").toFixed(1)}:1</dd>
                <dt>{t("appearance.cDark")}</dt>
                <dd>{contrast(colors.darkAccent, "#151b18").toFixed(1)}:1</dd>
              </dl>
              {btnContrast < 4.5 && <p className="text-xs text-warning" data-testid="contrast-warn">{t("appearance.lowContrast")}</p>}
              <p className="text-xs text-muted">{t("appearance.autoNote")}</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
