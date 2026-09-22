"use client";

/**
 * To'lov rekvizitlari (`GET /payment-info`): karta raqami (4 talik guruhlar, nusxalash), qabul qiluvchi, ko'rsatma.
 * Backend qiymatlari config'dan (qayta deploysiz o'zgaradi); bo'sh yoki so'rov xato bo'lsa — env'dagi
 * `NEXT_PUBLIC_PAYMENT_INSTRUCTIONS` zaxira. Bir sahifada bir necha buyurtma bo'lsa ham so'rov bitta (kesh).
 */
import { useEffect, useState } from "react";
import * as I from "@/components/ui/icons";
import { cn } from "@/components/ui";
import { ordersApi, type PaymentInfo } from "@/lib/api";
import { env } from "@/lib/env";
import { useT } from "@/i18n";

let cache: Promise<PaymentInfo | null> | null = null;
function loadPaymentInfo(): Promise<PaymentInfo | null> {
  cache ??= ordersApi.paymentInfo().catch(() => {
    cache = null; // keyingi safar qayta urinib ko'riladi
    return null;
  });
  return cache;
}

/** "8600123412341234" → "8600 1234 1234 1234" (raqam bo'lmagan belgilar saqlanmaydi) */
export function formatCard(v: string): string {
  const digits = v.replace(/\D/g, "");
  return digits ? digits.replace(/(\d{4})(?=\d)/g, "$1 ") : v;
}

export function PaymentDetails({ className }: { className?: string }) {
  const { t } = useT();
  const [info, setInfo] = useState<PaymentInfo | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadPaymentInfo().then((i) => alive && setInfo(i));
    return () => {
      alive = false;
    };
  }, []);

  const card = info?.card_number?.trim() ?? "";
  const recipient = info?.recipient?.trim() ?? "";
  const instructions = info?.instructions?.trim() || env.paymentInstructions || "";
  if (info === undefined || (!card && !recipient && !instructions)) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(card.replace(/\s/g, ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard ruxsati yo'q — foydalanuvchi qo'lda belgilaydi */
    }
  }

  return (
    <div className={cn("space-y-2 rounded-[14px] border border-border bg-surface-2 p-3", className)} data-testid="payment-details">
      {(card || recipient) && <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">{t("orders.payTo")}</p>}
      {card && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">{t("orders.cardNumber")}:</span>
          <span className="font-mono text-[15px] font-bold tracking-wide text-text select-all" data-testid="payment-card">
            {formatCard(card)}
          </span>
          <button type="button" className="btn ghost sm" onClick={() => void copy()} data-testid="payment-copy">
            {copied ? <I.Check size={14} /> : <I.Copy size={14} />}
            {copied ? t("orders.copied") : t("orders.copy")}
          </button>
        </div>
      )}
      {recipient && (
        <p className="text-sm">
          <span className="text-xs text-muted">{t("orders.recipient")}: </span>
          <span className="font-semibold text-text" data-testid="payment-recipient">
            {recipient}
          </span>
        </p>
      )}
      {instructions && <p className="whitespace-pre-wrap text-sm text-text-2">{instructions}</p>}
    </div>
  );
}
