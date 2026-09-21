"use client";

/**
 * Buyurtmalarim (PM S-16): PENDING → "To'ladim" (chek izohi) → AWAITING_REVIEW → admin APPROVED/REJECTED.
 * Kitob nomi `OrderResponse` da yo'q (B5) — katalogdan olinadi (kesh).
 */
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Alert, Button, Card, Spinner, Textarea, formatDate } from "@/components/ui";
import { Price } from "@/components/catalog/price";
import { OrderStatusBadge } from "./order-status";
import { catalogApi, errorMessage, ordersApi, type Order } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { env } from "@/lib/env";
import { useT } from "@/i18n";

export function MyOrders() {
  const { t } = useT();
  const { data: orders, error, reload } = useAsync(() => ordersApi.mine(), []);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [receiptFor, setReceiptFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Kitob nomlari (public katalog, keshlanadi)
  useEffect(() => {
    if (!orders) return;
    const missing = [...new Set(orders.filter((o) => !o.book_title).map((o) => o.book_id))].filter((id) => !titles[id]);
    if (!missing.length) return;
    let alive = true;
    Promise.all(missing.map((id) => catalogApi.find(id).then((c) => [id, c?.title ?? id.slice(0, 8)] as const).catch(() => [id, id.slice(0, 8)] as const))).then((pairs) => {
      if (alive) setTitles((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => {
      alive = false;
    };
  }, [orders, titles]);

  async function submitReceipt(e: FormEvent, o: Order) {
    e.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      await ordersApi.submitReceipt(o.id, note.trim());
      setReceiptFor(null);
      setNote("");
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={t("orders.title")}>
      <p className="mb-4 text-xs text-muted">{t("orders.description")}</p>
      {(error ?? actionError) && (
        <div className="mb-3">
          <Alert>{error ?? actionError}</Alert>
        </div>
      )}
      {!orders ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted">
          {t("orders.empty")}{" "}
          <Link href="/catalog" className="font-bold text-accent-ink hover:underline">
            {t("nav.catalog")} →
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {orders.map((o) => (
            <li key={o.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/catalog/${o.book_id}`} className="font-bold text-text hover:text-accent-ink">
                    {o.book_title || titles[o.book_id] || "…"}
                  </Link>
                  <p className="text-xs text-muted">
                    <Price value={o.amount} /> · {formatDate(o.created_at)}
                  </p>
                </div>
                <OrderStatusBadge status={o.status} />
              </div>
              {o.status === "PENDING" && (
                <div className="mt-2">
                  {env.paymentInstructions && <p className="mb-2 whitespace-pre-wrap text-xs text-muted">{env.paymentInstructions}</p>}
                  {receiptFor === o.id ? (
                    <form onSubmit={(e) => void submitReceipt(e, o)} className="space-y-2">
                      <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("orders.receiptPlaceholder")} />
                      <div className="flex gap-2">
                        <Button size="sm" type="submit" loading={busy}>
                          {t("orders.sendReceipt")}
                        </Button>
                        <Button size="sm" type="button" variant="ghost" onClick={() => setReceiptFor(null)}>
                          {t("common.cancel")}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setReceiptFor(o.id)}>
                      {t("orders.paid")}
                    </Button>
                  )}
                </div>
              )}
              {o.status === "AWAITING_REVIEW" && <p className="mt-1 text-xs text-muted">{t("orders.awaitingHint")}</p>}
              {o.status === "APPROVED" && (
                <Link href={`/books/${o.book_id}`} className="mt-1 inline-block text-xs font-bold text-accent-ink hover:underline">
                  {t("orders.openBook")} →
                </Link>
              )}
              {o.status === "REJECTED" && o.reject_reason && (
                <p className="mt-1 text-xs text-red-500">
                  {t("orders.rejectReason")}: {o.reject_reason}
                </p>
              )}
              {o.receipt_note && <p className="mt-1 text-xs text-muted">“{o.receipt_note}”</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
