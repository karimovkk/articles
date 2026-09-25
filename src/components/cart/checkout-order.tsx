"use client";

/**
 * 35.3: savatchadan yaratilgan buyurtma — kitoblar (asl/chegirmali narx), jami va chegirma, holat; PENDING —
 * to'lov rekvizitlari + "To'ladim" (chek), AWAITING_REVIEW — kuzatiladi (chekni almashtirish mumkin), APPROVED —
 * kutubxonaga havola. Chek yuborish va bekor qilish — mavjud buyurtma oqimi (`/orders/{id}/receipt`, `/cancel`).
 */
import { useState } from "react";
import Link from "next/link";
import { Price } from "@/components/catalog/price";
import { OrderStatusBadge } from "@/components/orders/order-status";
import { PaymentDetails } from "@/components/orders/payment-info";
import { ReceiptForm } from "@/components/orders/receipt-form";
import { useOrderPoll } from "@/components/orders/use-order-poll";
import { Alert, Button, Spinner, buttonClass, formatDate, useConfirm } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { errorMessage, ordersApi, type Order } from "@/lib/api";
import { clearOwnedBooks } from "@/lib/owned-books";
import { useT } from "@/i18n";

export function CheckoutOrder({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const { t } = useT();
  const confirm = useConfirm();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = order.status === "PENDING" || order.status === "AWAITING_REVIEW";

  const refresh = () =>
    ordersApi
      .get(order.id)
      .then((o) => {
        if (o.status === "APPROVED" && order.status !== "APPROVED") clearOwnedBooks();
        onChange(o);
      })
      .catch(() => undefined);
  useOrderPoll(order.status === "AWAITING_REVIEW", () => void refresh());

  const cancel = async () => {
    const ok = await confirm({ title: t("orders.cancel"), message: t("orders.cancelConfirm"), confirmLabel: t("orders.cancel"), tone: "danger" });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await ordersApi.cancel(order.id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const items = order.items ?? [];
  const discount = Number(order.discount ?? 0);

  return (
    <section className="cart-card checkout-order" data-testid="checkout-order" data-status={order.status}>
      <div className="checkout-head">
        <h2 className="cart-summary-title">{t("cart.orderTitle", { n: items.length || 1 })}</h2>
        <OrderStatusBadge status={order.status} />
        <span className="text-xs text-muted">{formatDate(order.created_at)}</span>
      </div>
      {error && <Alert>{error}</Alert>}

      {items.length > 0 && (
        <ul className="checkout-items">
          {items.map((i) => (
            <li key={i.book_id}>
              <span className="user-text">{i.book_title ?? i.book_id.slice(0, 8)}</span>
              <span className="checkout-item-price">
                {Number(i.unit_price) < Number(i.list_price) && (
                  <s>
                    <Price value={i.list_price} />
                  </s>
                )}
                <Price value={i.unit_price} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <dl className="cart-lines">
        {discount > 0 && (
          <div className="is-discount">
            <dt>{t("cart.discount")}</dt>
            <dd>
              −<Price value={order.discount} />
            </dd>
          </div>
        )}
        <div className="is-total">
          <dt>{t("cart.total")}</dt>
          <dd data-testid="checkout-total">
            <Price value={order.amount} />
          </dd>
        </div>
      </dl>

      {order.status === "PENDING" && <PaymentDetails />}
      {open && receiptOpen && (
        <ReceiptForm
          orderId={order.id}
          replace={order.status === "AWAITING_REVIEW"}
          onDone={(o) => {
            onChange(o);
            setReceiptOpen(false);
          }}
          onCancel={() => setReceiptOpen(false)}
          onStale={() => {
            setReceiptOpen(false);
            void refresh();
          }}
        />
      )}
      {order.status === "AWAITING_REVIEW" && (
        <p className="flex items-start gap-2 text-xs text-muted" data-testid="awaiting-hint">
          <Spinner className="mt-0.5 size-3.5 shrink-0" />
          {t("orders.awaitingHint")}
        </p>
      )}
      {open && !receiptOpen && (
        <div className="flex flex-wrap gap-2">
          {order.status === "PENDING" ? (
            <Button onClick={() => setReceiptOpen(true)} icon={<I.Upload size={15} />} data-testid="checkout-paid">
              {t("orders.paid")}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setReceiptOpen(true)} icon={<I.Upload size={15} />}>
              {t("orders.replaceReceipt")}
            </Button>
          )}
          <Button variant="danger-ghost" loading={busy} onClick={() => void cancel()} data-testid="checkout-cancel">
            {t("orders.cancel")}
          </Button>
        </div>
      )}
      {order.status === "APPROVED" && (
        <div className="space-y-2">
          <Alert tone="success">{t("orders.approvedTitle")}</Alert>
          <Link href="/library" className={buttonClass("primary", "sm")}>
            <I.Library size={15} />
            {t("orders.goLibrary")}
          </Link>
        </div>
      )}
      {(order.status === "REJECTED" || order.status === "CANCELLED") && (
        <Alert tone={order.status === "REJECTED" ? "danger" : "info"}>
          {order.status === "REJECTED" ? t("orders.rejectedTitle") : t("orders.status.CANCELLED")}
          {order.reject_reason && <span className="block">{order.reject_reason}</span>}
        </Alert>
      )}
      <Link href="/profile" className="block text-xs font-bold text-accent-ink hover:underline">
        {t("orders.viewOrders")} →
      </Link>
    </section>
  );
}
