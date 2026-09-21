"use client";

/**
 * Katalogdagi "Sotib olish" paneli (FE-2.3, PM S-16):
 *   mehmon → login; buyurtma yo'q → POST /orders; PENDING → to'lov ko'rsatmasi + "To'ladim";
 *   AWAITING_REVIEW → kutish; REJECTED → sabab + qayta buyurtma; APPROVED → kutubxona.
 */
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { Alert, Button, Spinner, Textarea, buttonClass, formatDate } from "@/components/ui";
import { OrderStatusBadge } from "./order-status";
import { errorMessage, ordersApi, type Order } from "@/lib/api";
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
  const [note, setNote] = useState("");

  useEffect(() => {
    if (loading || !user) return;
    let alive = true;
    ordersApi
      .mine()
      .then((list) => {
        if (!alive) return;
        // Shu kitob uchun eng so'nggi buyurtma
        const mine = list.filter((o) => o.book_id === bookId).sort((a, b) => b.created_at.localeCompare(a.created_at));
        setOrder(mine[0] ?? null);
      })
      .catch(() => alive && setOrder(null));
    return () => {
      alive = false;
    };
  }, [user, loading, bookId]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      setOrder(await ordersApi.create(bookId));
      setNotice(t("orders.created"));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitReceipt(e: FormEvent) {
    e.preventDefault();
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      setOrder(await ordersApi.submitReceipt(order.id, note.trim()));
      setReceiptOpen(false);
      setNotice(null);
    } catch (err) {
      setError(errorMessage(err));
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

  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}
      {!active ? (
        <div className="space-y-2">
          {order?.status === "REJECTED" && (
            <Alert tone="danger">
              {t("orders.status.REJECTED")}
              {order.reject_reason ? ` — ${order.reject_reason}` : ""}
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void create()} loading={busy}>
              {t("orders.buyNow")}
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
                <form onSubmit={(e) => void submitReceipt(e)} className="space-y-2">
                  <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("orders.receiptPlaceholder")} />
                  <div className="flex gap-2">
                    <Button size="sm" type="submit" loading={busy}>
                      {t("orders.sendReceipt")}
                    </Button>
                    <Button size="sm" type="button" variant="ghost" onClick={() => setReceiptOpen(false)}>
                      {t("common.cancel")}
                    </Button>
                  </div>
                </form>
              ) : (
                <Button size="sm" onClick={() => setReceiptOpen(true)}>
                  {t("orders.paid")}
                </Button>
              )}
            </>
          )}
          {active.status === "AWAITING_REVIEW" && <p className="text-xs text-muted">{t("orders.awaitingHint")}</p>}
          {active.status === "APPROVED" && (
            <Link href={`/books/${bookId}`} className={buttonClass("primary", "sm")}>
              {t("orders.openBook")}
            </Link>
          )}
          <Link href="/profile" className="block text-xs font-bold text-accent-ink hover:underline">
            {t("orders.viewOrders")} →
          </Link>
        </div>
      )}
    </div>
  );
}
