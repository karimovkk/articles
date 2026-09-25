"use client";

/**
 * Buyurtmalarim (buyurtma oqimi v1.0): PENDING → rekvizitlar + "To'ladim" (chek rasmi/PDF + izoh, multipart) →
 * AWAITING_REVIEW (chekni almashtirish mumkin) → admin (Telegram yoki web) APPROVED/REJECTED; ochiq buyurtmani
 * bekor qilish → CANCELLED. AWAITING_REVIEW bo'lsa ro'yxat `GET /orders` bilan kuzatiladi.
 * Kitob nomi `OrderResponse` da bo'lmasa (eski backend) — katalogdan olinadi (kesh).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Spinner, formatDate, useConfirm } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { Price } from "@/components/catalog/price";
import { OrderStatusBadge } from "./order-status";
import { ReceiptForm } from "./receipt-form";
import { PaymentDetails } from "./payment-info";
import { useOrderPoll } from "./use-order-poll";
import { catalogApi, errorMessage, ordersApi, type Order } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { useT } from "@/i18n";

export function MyOrders() {
  const { t } = useT();
  const { data: orders, error, reload } = useAsync(() => ordersApi.mine(), []);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [receiptFor, setReceiptFor] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const confirm = useConfirm();
  useOrderPoll(!!orders?.some((o) => o.status === "AWAITING_REVIEW"), reload);

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

  async function cancel(o: Order) {
    const ok = await confirm({ title: t("orders.cancel"), message: t("orders.cancelConfirm"), confirmLabel: t("orders.cancel"), tone: "danger" });
    if (!ok) return;
    setCancelling(o.id);
    setActionError(null);
    try {
      await ordersApi.cancel(o.id);
      setReceiptFor(null);
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setCancelling(null);
      reload();
    }
  }

  return (
    <Card title={t("orders.title")}>
      <p className="mb-4 text-xs text-muted">{t("orders.description")}</p>
      {(error ?? actionError) && <Alert className="mb-3">{error ?? actionError}</Alert>}
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
                  {(o.items?.length ?? 0) > 1 ? (
                    // 35: savatchadan — bir nechta kitob
                    <p className="font-bold text-text" data-testid="order-bundle">
                      {t("orders.itemsCount", { n: o.items!.length })}:{" "}
                      {o.items!.map((i, k) => (
                        <span key={i.book_id}>
                          {k > 0 && ", "}
                          <Link href={`/catalog/${i.book_id}`} className="hover:text-accent-ink">
                            {i.book_title || titles[i.book_id] || "…"}
                          </Link>
                        </span>
                      ))}
                    </p>
                  ) : (
                    <Link href={`/catalog/${o.book_id}`} className="font-bold text-text hover:text-accent-ink">
                      {o.book_title || titles[o.book_id] || "…"}
                    </Link>
                  )}
                  <p className="text-xs text-muted">
                    <Price value={o.amount} />
                    {Number(o.discount ?? 0) > 0 && (
                      <>
                        {" "}
                        · <span className="font-semibold text-success">{t("orders.discountLine", { amount: "" })}</span>
                        <Price value={o.discount} className="font-semibold text-success" />
                      </>
                    )}{" "}
                    · {formatDate(o.created_at)}
                  </p>
                </div>
                <OrderStatusBadge status={o.status} />
              </div>
              {(o.status === "PENDING" || o.status === "AWAITING_REVIEW") && (
                <div className="mt-2 space-y-2">
                  {o.status === "PENDING" && <PaymentDetails />}
                  {o.status === "AWAITING_REVIEW" && (
                    <p className="flex items-start gap-1.5 text-xs text-muted">
                      <Spinner className="mt-0.5 size-3 shrink-0" />
                      {t("orders.awaitingHint")}
                    </p>
                  )}
                  {receiptFor === o.id ? (
                    <ReceiptForm
                      orderId={o.id}
                      compact
                      replace={o.status === "AWAITING_REVIEW"}
                      onDone={() => {
                        setReceiptFor(null);
                        reload();
                      }}
                      onCancel={() => setReceiptFor(null)}
                      onStale={() => {
                        setReceiptFor(null);
                        setActionError(t("error.INVALID_ORDER_STATE"));
                        reload();
                      }}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setReceiptFor(o.id)} icon={o.status === "AWAITING_REVIEW" ? <I.Upload size={14} /> : undefined}>
                        {o.status === "PENDING" ? t("orders.paid") : t("orders.replaceReceipt")}
                      </Button>
                      <Button size="sm" variant="danger-ghost" loading={cancelling === o.id} onClick={() => void cancel(o)} data-testid="cancel-order">
                        {t("orders.cancel")}
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {o.status === "APPROVED" && (
                <Link href={`/books/${o.book_id}`} className="mt-1 inline-block text-xs font-bold text-accent-ink hover:underline">
                  {t("orders.openBook")} →
                </Link>
              )}
              {o.status === "REJECTED" && (
                <p className="mt-1 text-xs text-danger">
                  <span className="font-bold">{t("orders.rejectedTitle")}</span>
                  {o.reject_reason && (
                    <>
                      {" "}
                      {t("orders.rejectReason")}: {o.reject_reason}{" "}
                    </>
                  )}{" "}
                  <Link href={`/catalog/${o.book_id}`} className="font-bold underline">
                    {t("orders.retry")}
                  </Link>
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
