"use client";

/**
 * Katalogdagi "Sotib olish" paneli (FE-2.3, buyurtma oqimi v1.0):
 *   mehmon → login; buyurtma yo'q → POST /orders (409 ALREADY_HAS_ACCESS → "kutubxonangizda");
 *   PENDING → to'lov ko'rsatmasi + "To'ladim" (chek rasmi + izoh, multipart);
 *   AWAITING_REVIEW → kutish, holat `GET /orders` bilan kuzatiladi (admin Telegram'da tasdiqlaydi);
 *   APPROVED → "Kitob kutubxonangizda"; REJECTED → sabab + qayta buyurtma.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { Alert, Button, Spinner, buttonClass, formatDate } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { OrderStatusBadge } from "./order-status";
import { ReceiptForm } from "./receipt-form";
import { useOrderPoll } from "./use-order-poll";
import { errorMessage, isApiError, ordersApi, type Order } from "@/lib/api";
import { env, purchaseLink } from "@/lib/env";
import { useT } from "@/i18n";

export function OrderPanel({ bookId }: { bookId: string }) {
  const { t } = useT();
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
  const load = useCallback(
    () =>
      ordersApi.mine().then((list) => {
        const mine = list.filter((o) => o.book_id === bookId).sort((a, b) => b.created_at.localeCompare(a.created_at));
        const next = mine[0] ?? null;
        // Kuzatuv paytida tasdiqlandi — foydalanuvchiga darhol xabar
        if (statusRef.current === "AWAITING_REVIEW" && next?.status === "APPROVED") setNotice(t("orders.approvedTitle"));
        setOrder(next);
      }),
    [bookId, t],
  );
  useEffect(() => {
    if (loading || !user) return;
    load().catch(() => setOrder(null));
  }, [user, loading, load]);
  useOrderPoll(order?.status === "AWAITING_REVIEW", () => void load().catch(() => undefined));

  async function create() {
    setBusy(true);
    setError(null);
    try {
      setOrder(await ordersApi.create(bookId));
      setNotice(t("orders.created"));
    } catch (e) {
      if (isApiError(e) && e.code === "ALREADY_HAS_ACCESS") setOwned(true);
      else setError(errorMessage(e));
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
  const active = order && order.status !== "REJECTED" ? order : null;

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
          {active.status === "PENDING" && (
            <>
              {env.paymentInstructions && <p className="whitespace-pre-wrap text-sm text-text">{env.paymentInstructions}</p>}
              {receiptOpen ? (
                <ReceiptForm
                  orderId={active.id}
                  onDone={(o) => {
                    setOrder(o);
                    setReceiptOpen(false);
                    setNotice(null);
                  }}
                  onCancel={() => setReceiptOpen(false)}
                />
              ) : (
                <Button size="sm" onClick={() => setReceiptOpen(true)}>
                  {t("orders.paid")}
                </Button>
              )}
            </>
          )}
          {active.status === "AWAITING_REVIEW" && (
            <p className="flex items-start gap-2 text-xs text-muted" data-testid="awaiting-hint">
              <Spinner className="mt-0.5 size-3.5 shrink-0" />
              {t("orders.awaitingHint")}
            </p>
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
