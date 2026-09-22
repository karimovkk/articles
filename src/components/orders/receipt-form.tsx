"use client";

/**
 * "To'ladim" formasi (buyurtma oqimi v1.0): chek **rasmi yoki PDF** (tavsiya — JPEG/PNG/WebP/PDF, ≤ 10 MB, magic-bayt
 * tekshiruvi; HEIC → JPEG, brauzer uddalasa) + ixtiyoriy izoh → `POST /orders/{id}/receipt` (multipart). Tanlash yoki
 * sudrab tashlash, oldindan ko'rish (rasm — kichik rasm, PDF — fayl kartochkasi), yuklash progressi.
 * Rasmsiz (faqat izoh) yuborish ham mumkin — backend fallback'i. `replace` — AWAITING_REVIEW'da chekni almashtirish.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Textarea, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { errorMessage, isApiError, ordersApi, type Order } from "@/lib/api";
import { RECEIPT_MAX_MB, formatMb, heicToJpeg, receiptKind, validateReceipt } from "@/lib/uploads";
import { useT } from "@/i18n";

export function ReceiptForm({
  orderId,
  onDone,
  onCancel,
  onStale,
  compact,
  replace,
}: {
  orderId: string;
  onDone: (o: Order) => void;
  onCancel: () => void;
  /** 409 INVALID_ORDER_STATE — buyurtma boshqa joyda (Telegram) hal qilingan: ota komponent holatni yangilaydi */
  onStale?: () => void;
  compact?: boolean;
  replace?: boolean;
}) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ file: File; url: string; pdf: boolean } | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const file = picked?.file ?? null;
  const preview = picked?.url ?? null;
  const urlRef = useRef<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);

  // Oldindan ko'rish URL'i — almashtirilganda (setImage) va yopilganda bo'shatiladi
  const setImage = (f: File | null, pdf = false) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = f ? URL.createObjectURL(f) : null;
    setPicked(f && urlRef.current ? { file: f, url: urlRef.current, pdf } : null);
  };
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  async function pick(f: File | undefined | null) {
    if (!f) return;
    setError(null);
    setInfo(null);
    // HEIC (iPhone) — backend qabul qilmaydi: brauzer uddalasa JPEG'ga o'giramiz
    if ((await receiptKind(f)) === "heic") {
      const jpeg = await heicToJpeg(f);
      if (!jpeg) {
        setError(t("upload.receiptHeic"));
        return;
      }
      f = jpeg;
      setInfo(t("orders.heicConverted"));
    }
    const problem = await validateReceipt(f);
    if (problem) {
      setError(problem);
      return;
    }
    setImage(f, (await receiptKind(f)) === "pdf");
  }

  function clear() {
    setImage(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setProgress(0);
    try {
      const o = await ordersApi.submitReceipt(orderId, { file, note }, { onProgress: (loaded, total) => setProgress(total ? Math.round((loaded / total) * 100) : 0) });
      onDone(o);
    } catch (err) {
      setError(errorMessage(err));
      if (isApiError(err) && err.code === "INVALID_ORDER_STATE") onStale?.();
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3" data-testid="receipt-form">
      {!compact && <p className="text-sm font-bold text-text">{replace ? t("orders.replaceReceipt") : t("orders.receiptTitle")}</p>}
      {error && <Alert>{error}</Alert>}
      {info && <Alert tone="info">{info}</Alert>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
        data-testid="receipt-file"
      />
      {file && preview ? (
        <div className="flex items-center gap-3 rounded-[14px] border border-border bg-surface-2 p-2.5" data-testid="receipt-preview">
          {picked?.pdf ? (
            <span className="grid size-16 shrink-0 place-items-center rounded-[10px] bg-surface text-danger" aria-label={t("orders.receiptPdf")} data-testid="receipt-pdf">
              <I.FileText size={26} />
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- lokal blob oldindan ko'rish
            <img src={preview} alt="" className="size-16 shrink-0 rounded-[10px] object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text">{file.name}</p>
            <p className="text-xs text-muted">{formatMb(file.size)}</p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => inputRef.current?.click()} disabled={busy}>
            {t("orders.receiptChange")}
          </Button>
          <button type="button" className="icon-btn plain sm" aria-label={t("orders.receiptRemove")} title={t("orders.receiptRemove")} onClick={clear} disabled={busy}>
            <I.X size={15} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            "flex w-full flex-col items-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed px-4 py-5 text-center transition-colors",
            drag ? "border-accent bg-[var(--accent-softer)]" : "border-border-strong hover:border-accent hover:bg-[var(--accent-softer)]",
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void pick(e.dataTransfer.files?.[0]);
          }}
          data-testid="receipt-drop"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-text-2">
            <I.Image size={19} />
          </span>
          <span className="text-sm font-bold text-text">{t("orders.receiptPick")}</span>
          <span className="text-xs text-muted">{t("orders.receiptFormats", { max: RECEIPT_MAX_MB })}</span>
        </button>
      )}
      {!file && <p className="text-xs text-muted">{t("orders.receiptRecommended")}</p>}

      <label className="block space-y-1.5">
        <span className="text-xs font-bold text-text-2">{t("orders.receiptNoteLabel")}</span>
        <Textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("orders.receiptPlaceholder")} disabled={busy} />
      </label>

      {busy && (
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? 0}>
          <div className="mb-1 text-xs font-semibold text-muted">{t("orders.uploading", { n: progress ?? 0 })}</div>
          <div className="progress thin">
            <i style={{ width: `${progress ?? 0}%` }} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="submit" loading={busy} icon={<I.Send size={14} />} data-testid="receipt-submit">
          {t("orders.sendReceipt")}
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
