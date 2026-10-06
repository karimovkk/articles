"use client";

/**
 * 56: to'lov — faqat Telegram bot orqali (Toliq vazifa §9). "To'lash" → `POST /orders/{id}/telegram-link` → `deep_link`:
 * bot foydalanuvchi va buyurtmani o'zi taniydi — karta raqami, chek va tasdiq botda. Oyna bosish paytida (sinxron)
 * ochiladi: so'rov tugagach ochilsa brauzer uni pop-up deb bloklaydi; bloklansa — shu tabda o'tiladi.
 * Natija (tasdiq/rad) sayt holat kuzatuvida ko'rinadi. `children` — tugma yonidagi amallar (masalan, bekor qilish).
 */
import { useState, type ReactNode } from "react";
import { Alert, Button } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { errorMessage, isApiError, ordersApi, type Order } from "@/lib/api";
import { useT } from "@/i18n";

export function TelegramPay({ order, onStale, compact, children }: { order: Order; onStale?: () => void; compact?: boolean; children?: ReactNode }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const awaiting = order.status === "AWAITING_REVIEW";

  const pay = async () => {
    setError(null);
    const win = window.open("", "_blank");
    setBusy(true);
    try {
      const { deep_link } = await ordersApi.telegramLink(order.id);
      if (!deep_link) {
        win?.close();
        setError(t("orders.tg.unavailable"));
        return;
      }
      if (win) {
        win.opener = null;
        win.location.href = deep_link;
      } else window.location.href = deep_link;
      setOpened(true);
    } catch (e) {
      win?.close();
      if (isApiError(e) && e.code === "INVALID_ORDER_STATE") onStale?.();
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2" data-testid="tg-pay">
      <div className="flex flex-wrap gap-2">
        <Button size={compact ? "sm" : "md"} variant={awaiting ? "secondary" : "primary"} onClick={() => void pay()} loading={busy} icon={<I.Send size={15} />} data-testid="tg-pay-btn">
          {t(awaiting ? "orders.tg.open" : "orders.tg.pay")}
        </Button>
        {children}
      </div>
      <p className="text-xs text-muted" data-testid="tg-pay-note">
        {opened ? t("orders.tg.opened") : t(awaiting ? "orders.tg.awaitingNote" : "orders.tg.note")}
      </p>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
