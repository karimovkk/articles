"use client";

/**
 * 67: admin "Reklama" (broadcast) — rasm (ixtiyoriy) + matn botga /start bosgan barcha faol foydalanuvchilarga.
 * `POST /admin/broadcast` (multipart `text`, `file`) → serverda fonda yuboriladi; holat `GET /admin/broadcast/{id}`
 * (har 2.5 s, DONE/FAILED gacha) — "Yuborildi N/M · xato K"; tarix — `GET /admin/broadcast`.
 * Haqiqiy foydalanuvchilarga ketadi va qaytarib bo'lmaydi — yuborishdan oldin tasdiq so'raladi. Matn: rasm bilan
 * ≤ 1024, faqat matn ≤ 4096 belgi (Telegram cheklovi). Katta rasm yuborishdan oldin siqiladi (JPEG, ≤ 1600 px).
 */
import { useEffect, useRef, useState, type DragEvent } from "react";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner, Textarea, cn, formatDate, useConfirm } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { adminApi, errorMessage, type Broadcast } from "@/lib/api";
import { compressImage } from "@/lib/image-compress";
import { useAsync } from "@/lib/use-async";
import { formatNumber, useT, type DictKey } from "@/i18n";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 10;
const CAPTION_MAX = 1024;
const TEXT_MAX = 4096;
const running = (b: Broadcast) => b.status === "PENDING" || b.status === "SENDING";
const tone = (s: string) => (s === "DONE" ? "success" : s === "FAILED" ? "danger" : s === "SENDING" ? "info" : "neutral");

export default function AdminBroadcastPage() {
  const { t, locale } = useT();
  const confirm = useConfirm();
  const { data: history, reload } = useAsync(() => adminApi.broadcasts(50), []);
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<Broadcast | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const limit = image ? CAPTION_MAX : TEXT_MAX;
  const tooLong = text.trim().length > limit;
  const canSend = (!!text.trim() || !!image) && !tooLong && !busy;
  const statusLabel = (s: string) => t(`broadcast.status.${s}` as DictKey);

  // Oldindan ko'rish URL'i — almashtirilganda va chiqishda bo'shatiladi
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!TYPES.includes(f.type)) return setError(t("broadcast.badType"));
    if (f.size > MAX_MB * 1024 * 1024) return setError(t("broadcast.tooBig", { n: MAX_MB }));
    setImage({ file: f, url: URL.createObjectURL(f) });
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    pick(e.dataTransfer.files?.[0]);
  };

  // Jarayonni kuzatish — DONE/FAILED gacha
  useEffect(() => {
    if (!current || !running(current)) return;
    const id = window.setTimeout(() => {
      adminApi
        .broadcast(current.id)
        .then((b) => {
          setCurrent(b);
          if (!running(b)) reload();
        })
        .catch(() => setCurrent((c) => (c ? { ...c } : c))); // tarmoq xatosi — keyingi urinish
    }, 2500);
    return () => window.clearTimeout(id);
  }, [current, reload]);
  // Tarixda jarayondagilar bo'lsa — yangilanib turadi
  const anyRunning = !!history?.some(running);
  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(reload, 4000);
    return () => window.clearInterval(id);
  }, [anyRunning, reload]);

  async function send() {
    if (!canSend) return;
    const ok = await confirm({ title: t("broadcast.confirmTitle"), message: t("broadcast.confirmText"), confirmLabel: t("broadcast.send"), tone: "danger" });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      // Katta rasm — siqiladi (Telegram baribir qayta siqadi; yuklash tezlashadi)
      let file: Blob | null = image?.file ?? null;
      let name = image?.file.name;
      if (image && image.file.size > 500 * 1024) {
        const c = await compressImage(image.file, { maxWidth: 1600, maxHeight: 1600, quality: 0.85, type: "jpeg" }).catch(() => null);
        if (c && c.blob.size < image.file.size) {
          file = c.blob;
          name = `${(image.file.name.replace(/\.[^.]+$/, "") || "image")}.jpg`;
        }
      }
      setProgress(0);
      const b = await adminApi.sendBroadcast(text, file, name, { onProgress: (l, tot) => setProgress(tot ? Math.round((l / tot) * 100) : 0) });
      setCurrent(b);
      // Forma tozalanadi — bir xil reklama qayta yuborilib ketmasin
      setText("");
      setImage(null);
      if (fileRef.current) fileRef.current.value = "";
      reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const pct = current && current.total > 0 ? Math.round(((current.sent + current.failed) / current.total) * 100) : 0;

  return (
    <div className="space-y-5" data-testid="broadcast-page">
      <PageHeader title={t("broadcast.title")} description={t("broadcast.sub")} icon={<I.Send size={24} />} />

      {current && (
        <div className="bc-progress" data-testid="bc-progress" data-status={current.status} role="status">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-text">
              {running(current) ? <Spinner className="size-4" /> : current.status === "DONE" ? <I.CheckCircle size={16} className="text-success" /> : <I.AlertTriangle size={16} className="text-danger" />}
              {t("broadcast.progress", { sent: formatNumber(current.sent, locale), total: current.total ? formatNumber(current.total, locale) : "…", failed: formatNumber(current.failed, locale) })}
            </span>
            <Badge tone={tone(current.status)}>{statusLabel(current.status)}</Badge>
          </div>
          <div className="progress thin mt-2" aria-hidden>
            <i style={{ width: `${running(current) && !current.total ? 4 : pct}%` }} />
          </div>
        </div>
      )}

      <div className="bc-grid">
        <Card title={t("broadcast.compose")}>
          <div className="card-body space-y-4">
            {error && <Alert>{error}</Alert>}
            {image ? (
              <div className="bc-image" data-testid="bc-image-preview">
                {/* eslint-disable-next-line @next/next/no-img-element -- lokal blob oldindan ko'rish */}
                <img src={image.url} alt="" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{image.file.name}</p>
                  <p className="text-xs text-muted">{(image.file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setImage(null)} icon={<I.X size={14} />} data-testid="bc-remove-image">
                  {t("broadcast.removeImage")}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className={cn("bc-drop", over && "over")}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={onDrop}
                data-testid="bc-drop"
              >
                <I.Image size={20} />
                <span className="text-sm font-semibold text-text">{t("broadcast.addImage")}</span>
                <span className="text-xs text-muted">{t("broadcast.imageHint", { n: MAX_MB })}</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept={TYPES.join(",")} className="hidden" onChange={(e) => pick(e.target.files?.[0])} data-testid="bc-file" />
            <div>
              <Textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("broadcast.placeholder")} aria-label={t("broadcast.text")} data-testid="bc-text" />
              <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                <span className={cn(tooLong ? "font-semibold text-danger" : "text-muted")} data-testid={tooLong ? "bc-too-long" : undefined}>
                  {tooLong ? t("broadcast.tooLong", { n: limit }) : image ? t("broadcast.captionHint") : ""}
                </span>
                <span className={cn("tabular-nums", tooLong ? "font-semibold text-danger" : "text-muted")} data-testid="bc-counter">
                  {text.trim().length} / {limit}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void send()} disabled={!canSend} loading={busy} icon={<I.Send size={16} />} data-testid="bc-send">
                {t("broadcast.send")}
              </Button>
              {progress !== null && <span className="text-xs text-muted">{t("broadcast.uploading", { n: progress })}</span>}
            </div>
            <p className="text-xs text-muted">{t("broadcast.recipients")}</p>
          </div>
        </Card>

        {/* Telegram'dagi ko'rinish namunasi */}
        <Card title={t("broadcast.preview")}>
          <div className="card-body">
            <div className="bc-phone" data-testid="bc-preview">
              {image || text.trim() ? (
                <div className="bc-bubble">
                  {/* eslint-disable-next-line @next/next/no-img-element -- lokal blob oldindan ko'rish */}
                  {image && <img src={image.url} alt="" />}
                  {text.trim() && <p className="user-text">{text.trim()}</p>}
                  <span className="bc-time">{new Date().toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ) : (
                <p className="text-center text-xs text-muted">{t("broadcast.previewEmpty")}</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card title={t("broadcast.history")} padded={false}>
        {!history ? (
          <div className="p-5">
            <Spinner />
          </div>
        ) : history.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<I.Send size={22} />} title={t("broadcast.historyEmpty")} description={t("broadcast.historyEmptyHint")} />
          </div>
        ) : (
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="table" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>{t("broadcast.date")}</th>
                    <th>{t("broadcast.text")}</th>
                    <th className="text-right">{t("broadcast.result")}</th>
                    <th>{t("common.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((b) => (
                    <tr key={b.id} data-testid="bc-row">
                      <td className="muted whitespace-nowrap text-xs">{formatDate(b.created_at)}</td>
                      <td>
                        <span className="inline-flex max-w-[420px] items-center gap-2">
                          {b.has_image && (
                            <span title={t("broadcast.withImage")} className="text-muted" data-testid="bc-has-image">
                              <I.Image size={14} />
                            </span>
                          )}
                          <span className="truncate user-text">{b.caption || t("broadcast.imageOnly")}</span>
                        </span>
                      </td>
                      <td className="num whitespace-nowrap text-right">
                        {b.sent}/{b.total}
                        {b.failed > 0 && <span className="ml-1 text-xs text-danger">· {t("broadcast.failedN", { n: b.failed })}</span>}
                      </td>
                      <td>
                        <Badge tone={tone(b.status)}>{statusLabel(b.status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
