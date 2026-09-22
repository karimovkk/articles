"use client";

/**
 * Admin: buyurtma chekini ko'rish (`GET /admin/orders/{id}/receipt`, B15). Fayl Bearer bilan blob sifatida olinadi
 * (maxfiy storage — to'g'ridan-to'g'ri URL yo'q), rasm — `<img>`, PDF — `<iframe>`; yangi oynada ochish havolasi.
 * Chek yo'q bo'lsa 404 `RECEIPT_NOT_FOUND` — tushunarli xabar.
 */
import { useEffect, useState } from "react";
import { Alert, Modal, Spinner, buttonClass } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { adminApi, errorMessage, type Order } from "@/lib/api";
import { useT } from "@/i18n";

export function ReceiptViewer({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { t } = useT();
  const [file, setFile] = useState<{ url: string; pdf: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const orderId = order?.id;

  useEffect(() => {
    if (!orderId) return;
    const ac = new AbortController();
    let url: string | null = null;
    adminApi
      .orderReceipt(orderId, ac.signal)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setFile({ url, pdf: blob.type.includes("pdf") });
      })
      .catch((e: unknown) => {
        if (!ac.signal.aborted) setError(errorMessage(e));
      });
    // Holat yangi buyurtma uchun ota komponentdagi `key` bilan tozalanadi
    return () => {
      ac.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [orderId]);

  return (
    <Modal open={!!order} onClose={onClose} title={t("admin.orders.receiptTitle")} icon={<I.Image size={18} />} size="lg" data-testid="receipt-viewer">
      {order?.receipt_note && <p className="mb-3 text-sm text-text-2">“{order.receipt_note}”</p>}
      {error ? (
        <Alert>{error}</Alert>
      ) : !file ? (
        <div className="grid h-64 place-items-center text-muted">
          <Spinner />
        </div>
      ) : file.pdf ? (
        <iframe src={file.url} title={t("orders.receiptPdf")} className="h-[65vh] w-full rounded-[12px] border border-border bg-white" data-testid="receipt-viewer-pdf" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- himoyalangan blob, next/image optimallashtira olmaydi
        <img src={file.url} alt={t("admin.orders.receiptTitle")} className="mx-auto max-h-[65vh] w-auto rounded-[12px] border border-border" data-testid="receipt-viewer-img" />
      )}
      {file && (
        <div className="mt-3 flex justify-end">
          <a href={file.url} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "sm")}>
            <I.ArrowUpRight size={15} />
            {t("admin.orders.openReceipt")}
          </a>
        </div>
      )}
    </Modal>
  );
}
