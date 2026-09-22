"use client";

/**
 * Buyurtmalarim (buyurtma oqimi v1.0): PENDING → "To'ladim" (chek rasmi + izoh, multipart) → AWAITING_REVIEW →
 * admin (Telegram yoki web) APPROVED/REJECTED. AWAITING_REVIEW bo'lsa holat `GET /orders` bilan kuzatiladi.
 * Kitob nomi `OrderResponse` da bo'lmasa (eski backend) — katalogdan olinadi (kesh).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Spinner, formatDate } from "@/components/ui";
import { Price } from "@/components/catalog/price";
import { OrderStatusBadge } from "./order-status";
import { ReceiptForm } from "./receipt-form";
import { useOrderPoll } from "./use-order-poll";
import { catalogApi, ordersApi } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { env } from "@/lib/env";
import { useT } from "@/i18n";

export function MyOrders() {
  const { t } = useT();
  const { data: orders, error, reload } = useAsync(() => ordersApi.mine(), []);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [receiptFor, setReceiptFor] = useState<string | null>(null);
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

  return (
    <Card title={t("orders.title")}>
      <p className="mb-4 text-xs text-muted">{t("orders.description")}</p>
      {error && <Alert className="mb-3">{error}</Alert>}
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
                    <ReceiptForm
                      orderId={o.id}
                      compact
                      onDone={() => {
                        setReceiptFor(null);
                        reload();
                      }}
                      onCancel={() => setReceiptFor(null)}
                    />
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setReceiptFor(o.id)}>
                      {t("orders.paid")}
                    </Button>
                  )}
                </div>
              )}
              {o.status === "AWAITING_REVIEW" && (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-muted">
                  <Spinner className="mt-0.5 size-3 shrink-0" />
                  {t("orders.awaitingHint")}
                </p>
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
