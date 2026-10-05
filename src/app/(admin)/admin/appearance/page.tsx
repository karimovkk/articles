"use client";

/**
 * 44.8: admin "Ko'rinish" — global ko'rinish sozlamalari (`PUT /admin/app-settings`, kalit `appearance`; hamma
 * foydalanuvchi — hatto login sahifasi — public `GET /app-settings` dan o'qiydi). Asosiy rang (qolganlari avtomatik,
 * kontrast ko'rsatiladi), yorug'/qorong'i fon (standart · rang · rasm), shrift. O'zgarish darhol oldindan
 * ko'rinadi (faqat shu brauzerda); "Saqlash" — hammaga; "Standartga qaytarish" — `DELETE …/appearance`.
 * 46: rasm — sudrab tashlash / tanlash; brauzerda WebP'ga siqilib `PUT /admin/app-settings/images/background?theme=`
 * bilan yuklanadi (rasmning o'zi storage'da). Fon boshqa turga o'tib saqlansa — yuklangan rasm o'chiriladi.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Spinner, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { adminApi, errorMessage, type AppImageTheme } from "@/lib/api";
import { BACKGROUND_IMAGE, DEFAULT_PRIMARY, appearanceCss, contrast, deriveColors, isHex, isSafeAssetUrl, isSafeImageUrl, type Appearance } from "@/lib/appearance";
import { compressImage } from "@/lib/image-compress";
import { applyAppearance, useAppearanceSettings } from "@/providers/appearance-provider";
import { useT } from "@/i18n";

const PRESETS = ["#f2b705", "#e8590c", "#e11d48", "#7c3aed", "#2563eb", "#0d9488", "#16a34a", "#334155"];
type BgKind = "default" | "color" | "image";
const kindOf = (v: string | null | undefined): BgKind => (v === "upload" || isSafeImageUrl(v) ? "image" : isHex(v) ? "color" : "default");
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_MAX_MB = 25;

/** Yorug'/qorong'i fon: standart · rang · rasm (sudrab tashlash yoki tanlash → siqiladi → yuklanadi) */
function BgField({
  label,
  theme,
  value,
  imageUrl,
  onChange,
  testid,
}: {
  label: string;
  theme: AppImageTheme;
  value: string | null | undefined;
  /** Shu mavzu uchun serverdagi (yoki yangi yuklangan) rasm URL'i */
  imageUrl: string | null | undefined;
  onChange: (value: string, imageUrl?: string) => void;
  testid: string;
}) {
  const { t } = useT();
  const [kind, setKind] = useState<BgKind>(kindOf(value));
  const [color, setColor] = useState(isHex(value) ? value : "#f4f2ec");
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const shownUrl = value === "upload" || kind === "image" ? (isSafeAssetUrl(imageUrl) ? imageUrl : isSafeImageUrl(value) ? value : null) : null;

  const pick = (k: BgKind) => {
    setKind(k);
    setError(null);
    if (k === "color") onChange(color);
    else if (k === "image") onChange(isSafeAssetUrl(imageUrl) ? "upload" : (value ?? "default"));
    else onChange("default");
  };

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!IMAGE_TYPES.includes(file.type)) return setError(t("appearance.bg.badType"));
    if (file.size > IMAGE_MAX_MB * 1024 * 1024) return setError(t("appearance.bg.tooBig", { n: IMAGE_MAX_MB }));
    setProgress(0);
    try {
      const { blob, ext } = await compressImage(file, 1920);
      const img = await adminApi.uploadAppImage(BACKGROUND_IMAGE, theme, blob, `${BACKGROUND_IMAGE}-${theme}.${ext}`, {
        onProgress: (l, tot) => setProgress(tot ? Math.round((l / tot) * 100) : 0),
        timeoutMs: 120_000,
      });
      onChange("upload", img.url);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void upload(e.dataTransfer.files?.[0]);
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
            <div
              role="button"
              tabIndex={0}
              className={cn("bg-drop", over && "over", progress !== null && "busy")}
              onClick={() => progress === null && fileRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), fileRef.current?.click())}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
              aria-label={t("appearance.bg.drop")}
              data-testid={`${testid}-drop`}
            >
              {shownUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin oldindan ko'rish, tashqi/versiyali URL
                <img src={shownUrl} alt="" className="bg-drop-thumb" data-testid={`${testid}-thumb`} />
              ) : (
                <span className="bg-drop-icon">
                  <I.Image size={22} />
                </span>
              )}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-text">{progress !== null ? t("appearance.bg.uploading", { n: progress }) : shownUrl ? t("appearance.bg.replace") : t("appearance.bg.drop")}</span>
                <span className="block text-xs text-muted">{t("appearance.bg.dropHint", { n: IMAGE_MAX_MB })}</span>
              </span>
              <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(",")} className="hidden" onChange={(e) => void upload(e.target.files?.[0])} data-testid={`${testid}-file`} />
            </div>
            {progress !== null && (
              <div className="progress thin" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <i style={{ width: `${progress}%` }} />
              </div>
            )}
            {error && <p className="text-xs text-danger" data-testid={`${testid}-error`}>{error}</p>}
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
    setMsg(null);
    const themes: AppImageTheme[] = ["light", "dark"];
    // "Rasm" tanlangan, lekin hali yuklanmagan
    if (themes.some((th) => a[`background_${th}`] === "upload" && !a.images?.[th])) {
      setMsg({ tone: "danger", text: t("appearance.bg.needImage") });
      return;
    }
    setBusy(true);
    try {
      const { images: _images, ...appearance } = a;
      void _images;
      await adminApi.saveAppSettings({ appearance: { ...appearance, primary_color: primary } });
      // Fon rasmdan boshqa turga o'tdi — storage'dagi rasm o'chiriladi (yetim fayl qolmasin)
      for (const th of themes) {
        if (appearance[`background_${th}`] !== "upload" && saved.images?.[th]) await adminApi.deleteAppImage(BACKGROUND_IMAGE, th).catch(() => undefined);
      }
      await reload();
      // Fon maydonlari serverdagi YANGI qiymatdan qayta boshlanadi (reload'dan keyin — eski holat olib qolinmasin)
      setDraft(null);
      setVersion((v) => v + 1);
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
      // Yuklangan fon rasmlari ham o'chiriladi (storage'da yetim qolmasin)
      for (const th of ["light", "dark"] as const) {
        if (saved.images?.[th]) await adminApi.deleteAppImage(BACKGROUND_IMAGE, th).catch(() => undefined);
      }
      await reload();
      // Fon maydonlari serverdagi YANGI qiymatdan qayta boshlanadi (reload'dan keyin — eski holat olib qolinmasin)
      setDraft(null);
      setVersion((v) => v + 1);
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
              <BgField
                key={`l${version}`}
                label={t("appearance.bgLight")}
                theme="light"
                value={a.background_light}
                imageUrl={a.images?.light}
                onChange={(v, url) => set({ background_light: v, ...(url ? { images: { ...a.images, light: url } } : {}) })}
                testid="bg-light"
              />
              <BgField
                key={`d${version}`}
                label={t("appearance.bgDark")}
                theme="dark"
                value={a.background_dark}
                imageUrl={a.images?.dark}
                onChange={(v, url) => set({ background_dark: v, ...(url ? { images: { ...a.images, dark: url } } : {}) })}
                testid="bg-dark"
              />
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
