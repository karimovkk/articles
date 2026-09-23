"use client";

/**
 * Katalogdagi "Sotib olish" paneli (FE-2.3, buyurtma oqimi v1.0):
 *   mehmon → login; buyurtma yo'q → POST /orders (409 ALREADY_HAS_ACCESS → "kutubxonangizda";
 *   409 ORDER_ALREADY_PENDING → `details.order_id` dagi mavjud buyurtma ochiladi);
 *   PENDING → to'lov rekvizitlari (`GET /payment-info`) + "To'ladim" (chek rasmi/PDF + izoh, multipart);
 *   AWAITING_REVIEW → kutish (chekni almashtirish mumkin), holat `GET /orders/{id}` bilan kuzatiladi;
 *   PENDING/AWAITING → "Bekor qilish" (CANCELLED); APPROVED → "Kitob kutubxonangizda"; REJECTED → sabab + qayta.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { Alert, Button, Spinner, buttonClass, formatDate, useConfirm } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { OrderStatusBadge } from "./order-status";
import { ReceiptForm } from "./receipt-form";
import { PaymentDetails } from "./payment-info";
import { useOrderPoll } from "./use-order-poll";
import { errorMessage, isApiError, ordersApi, type Order } from "@/lib/api";
import { clearOwnedBooks } from "@/lib/owned-books";
import { purchaseLink } from "@/lib/env";
import { useT } from "@/i18n";

export function OrderPanel({ bookId }: { bookId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
  const { user, loading } = useAuth();
  const [order, setOrder] = useState<Order | null | undefined>(undefined); // undefined = yuklanmoqda
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [owned, setOwned] = useState(false); // 409 ALREADY_HAS_ACCESS

  const statusRef = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    statusRef.current = order?.status;
  });

  // Shu kitob uchun eng so'nggi buyurtma (`GET /orders` — eng yangisi birinchi)
  const apply = useCallback(
    (next: Order | null) => {
      // Kuzatuv paytida tasdiqlandi — foydalanuvchiga darhol xabar
      if (statusRef.current === "AWAITING_REVIEW" && next?.status === "APPROVED") setNotice(t("orders.approvedTitle"));
      // Kutubxona o'zgardi — katalogdagi "Kutubxonada" keshi eskirdi (26.4)
      if (next?.status === "APPROVED" && statusRef.current !== "APPROVED") clearOwnedBooks();
      setOrder(next);
    },
    [t],
  );
  const load = useCallback(
    () =>
      ordersApi.mine().then((list) => {
        const mine = list.filter((o) => o.book_id === bookId).sort((a, b) => b.created_at.localeCompare(a.created_at));
        apply(mine[0] ?? null);
      }),
    [bookId, apply],
  );
  useEffect(() => {
    if (loading || !user) return;
    load().catch(() => setOrder(null));
  }, [user, loading, load]);
  // Kuzatuv — yengil `GET /orders/{id}` (bitta buyurtma)
  const orderId = order?.id;
  useOrderPoll(order?.status === "AWAITING_REVIEW", () => {
    if (orderId) void ordersApi.get(orderId).then(apply, () => undefined);
  });

  async function create() {
    setBusy(true);
    setError(null);
    try {
      setOrder(await ordersApi.create(bookId));
      setNotice(t("orders.created"));
    } catch (e) {
      const existingId = isApiError(e) && e.code === "ORDER_ALREADY_PENDING" ? (e.details as { order_id?: string } | null)?.order_id : undefined;
      if (isApiError(e) && e.code === "ALREADY_HAS_ACCESS") setOwned(true);
      else if (existingId) {
        // Ochiq buyurtma bor — xato o'rniga shu buyurtmani ko'rsatamiz
        setOrder(await ordersApi.get(existingId).catch(() => null));
        setNotice(t("orders.existingOpened"));
      } else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(o: Order) {
    const ok = await confirm({ title: t("orders.cancel"), message: t("orders.cancelConfirm"), confirmLabel: t("orders.cancel"), tone: "danger" });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      setOrder(await ordersApi.cancel(o.id));
      setReceiptOpen(false);
      setNotice(t("orders.cancelled"));
    } catch (e) {
      setError(errorMessage(e));
      if (isApiError(e) && e.code === "INVALID_ORDER_STATE") void load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  if (loading || (user && order === undefined)) return <Spinner />;
  // Mehmon uchun `order` holati ishlatilmaydi (effekt ham ishga tushmaydi)

  if (!user) {
    return (
      <div className="space-y-2">
        <Link href={`/login?next=${encodeURIComponent(`/catalog/${bookId}`)}`} className={buttonClass()}>
          {t("orders.loginToBuy")}
        </Link>
        <p className="text-xs text-muted">{t("catalog.buyHint")}</p>
      </div>
    );
  }

  const external = purchaseLink(bookId);
  // Yopilgan (rad etilgan / bekor qilingan) buyurtma — yangi buyurtma berish mumkin
  const active = order && order.status !== "REJECTED" && order.status !== "CANCELLED" ? order : null;

  if (owned) {
    return (
      <div className="space-y-3" data-testid="order-owned">
        <Alert tone="success">{t("orders.alreadyOwned")}</Alert>
        <Link href={`/books/${bookId}`} className={buttonClass("primary", "sm")}>
          <I.BookOpen size={15} />
          {t("orders.openBook")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="order-panel" data-status={order?.status ?? "NONE"}>
      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}
      {!active ? (
        <div className="space-y-2">
          {order?.status === "REJECTED" && (
            <Alert tone="danger">
              <span className="block font-bold">{t("orders.rejectedTitle")}</span>
              {order.reject_reason && (
                <span className="block" data-testid="reject-reason">
                  {t("orders.rejectReason")}: {order.reject_reason}
                </span>
              )}
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void create()} loading={busy}>
              {order?.status === "REJECTED" ? t("orders.retry") : t("orders.buyNow")}
            </Button>
            {external && (
              <a href={external} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                Telegram
              </a>
            )}
          </div>
          <p className="text-xs text-muted">{t("orders.description")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <OrderStatusBadge status={active.status} />
            <span className="text-xs text-muted">{formatDate(active.created_at)}</span>
          </div>
          {active.status === "PENDING" && <PaymentDetails />}
          {(active.status === "PENDING" || active.status === "AWAITING_REVIEW") && receiptOpen && (
            <ReceiptForm
              orderId={active.id}
              replace={active.status === "AWAITING_REVIEW"}
              onDone={(o) => {
                setOrder(o);
                setReceiptOpen(false);
                setNotice(null);
              }}
              onCancel={() => setReceiptOpen(false)}
              onStale={() => {
                setReceiptOpen(false);
                setError(t("error.INVALID_ORDER_STATE"));
                void load().catch(() => undefined);
              }}
            />
          )}
          {active.status === "AWAITING_REVIEW" && (
            <p className="flex items-start gap-2 text-xs text-muted" data-testid="awaiting-hint">
              <Spinner className="mt-0.5 size-3.5 shrink-0" />
              {t("orders.awaitingHint")}
            </p>
          )}
          {(active.status === "PENDING" || active.status === "AWAITING_REVIEW") && !receiptOpen && (
            <div className="flex flex-wrap gap-2">
              {active.status === "PENDING" ? (
                <Button size="sm" onClick={() => setReceiptOpen(true)}>
                  {t("orders.paid")}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setReceiptOpen(true)} icon={<I.Upload size={14} />} data-testid="replace-receipt">
                  {t("orders.replaceReceipt")}
                </Button>
              )}
              <Button size="sm" variant="danger-ghost" loading={busy} onClick={() => void cancel(active)} data-testid="cancel-order">
                {t("orders.cancel")}
              </Button>
            </div>
          )}
          {active.status === "APPROVED" && (
            <div className="space-y-2">
              {!notice && <Alert tone="success">{t("orders.approvedTitle")}</Alert>}
              <div className="flex flex-wrap gap-2">
                <Link href={`/books/${bookId}`} className={buttonClass("primary", "sm")}>
                  <I.BookOpen size={15} />
                  {t("orders.openBook")}
                </Link>
                <Link href="/library" className={buttonClass("secondary", "sm")}>
                  {t("orders.goLibrary")}
                </Link>
              </div>
            </div>
          )}
          <Link href="/profile" className="block text-xs font-bold text-accent-ink hover:underline">
            {t("orders.viewOrders")} →
          </Link>
        </div>
      )}
    </div>
  );
}
