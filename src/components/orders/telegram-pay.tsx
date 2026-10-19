"use client";

/**
 * 56: to'lov — faqat Telegram bot orqali (Toliq vazifa §9). "To'lash" → `POST /orders/{id}/telegram-link` → `deep_link`:
 * bot foydalanuvchi va buyurtmani o'zi taniydi — karta raqami, chek va tasdiq botda. Oyna bosish paytida (sinxron)
 * ochiladi: so'rov tugagach ochilsa brauzer uni pop-up deb bloklaydi; bloklansa — shu tabda o'tiladi.
 * Natija (tasdiq/rad) sayt holat kuzatuvida ko'rinadi. `children` — tugma yonidagi amallar (masalan, bekor qilish).
 * 96: telefonda — bo'sh tab ochilmaydi va t.me veb-sahifasi orqali o'tilmaydi (bo'sh tab → t.me → ilova: "qotib qolish"):
 * to'g'ridan `tg://resolve?domain=…&start=…` — Telegram darhol ochiladi; ilova o'rnatilmagan bo'lsa (sahifa 1,5 s ichida
 * yashirinmasa) — oddiy `https://t.me/…` havolasi.
 * 101: "Buyurtma berish" ham botni darhol ochadi (`openTelegram`) — ikkinchi tugma bosilmaydi.
 * 109: Telegram Mini App ichida — bot havolasi ochilgach Mini App yopiladi (bot chati ko'rinsin).
 * 116: `close()` darhol — chat ochilganda Telegram Mini App'ni fonga o'tkazadi va taymer ishlamay qoladi.
 * 118: Mini App'da SDK `initData` siz qolsa (iPhone) ham — `telegramLinker()` (SDK yoki Telegram ko'prigi); ko'prik ham
 * bo'lmasa — oddiy telefon yo'liga (`tg://`, webview'da bloklanadi) tushmaydi: xato + diagnostika.
 */
import { useState, type ReactNode } from "react";
import { Alert, Button } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { errorMessage, isApiError, ordersApi, type Order } from "@/lib/api";
import { launchedInTelegram, telegramDiag, telegramLinker } from "@/lib/telegram";
import { t as tr, useT } from "@/i18n";

/** Telefon / planshet (sensorli, mobil OS) */
const isMobile = () => typeof window !== "undefined" && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));

/** `https://t.me/<bot>?start=<token>` → `tg://resolve?domain=<bot>&start=<token>` (ilova sxemasi) */
export function tgAppLink(deepLink: string, bot?: string | null, token?: string | null): string | null {
  try {
    const u = new URL(deepLink);
    const domain = bot || u.pathname.split("/").filter(Boolean)[0];
    const start = token || u.searchParams.get("start");
    if (!domain || !/^[A-Za-z0-9_]{3,64}$/.test(domain)) return null;
    return `tg://resolve?domain=${domain}${start ? `&start=${encodeURIComponent(start)}` : ""}`;
  } catch {
    return null;
  }
}

/** Havolani shu tabda ochish (ilova sxemasi uchun ham) */
function go(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** 96: telefon — ilova sxemasi (oraliq tab va veb-sahifa yo'q), ilova yo'q bo'lsa (1,5 s) — https */
function openOnPhone(deepLink: string, bot?: string | null, token?: string | null) {
  const app = tgAppLink(deepLink, bot, token);
  if (!app) return go(deepLink);
  let left = false;
  const onHide = () => {
    if (document.visibilityState === "hidden") left = true;
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onHide);
  go(app);
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onHide);
    if (!left && document.visibilityState === "visible") go(deepLink); // ilova ochilmadi — veb havola
  }, 1500);
}

/**
 * Buyurtma uchun Telegram botni ochish. BOSISH PAYTIDA (sinxron qismda) chaqirilishi kerak: kompyuterda oyna darhol
 * ochiladi (aks holda pop-up bloklanadi), so'ng `getOrderId` (masalan, buyurtma yaratish) va havola so'raladi.
 * Natija: "opened" | "none" (buyurtma yo'q — oyna yopildi) | "unavailable" (bot sozlanmagan). Xato — tashqariga.
 */
export async function openTelegram(getOrderId: () => Promise<string | null>): Promise<"opened" | "none" | "unavailable"> {
  // 106: Telegram Mini App ichida — bot havolasi Telegram'ning o'zida (`openTelegramLink`), yangi oyna ochilmaydi
  const tg = telegramLinker();
  if (!tg && launchedInTelegram()) throw new Error(`${tr("tg.noBridge")} [${telegramDiag()}]`);
  const mobile = isMobile();
  const win = mobile || tg ? null : window.open("", "_blank");
  try {
    const id = await getOrderId();
    if (!id) {
      win?.close();
      return "none";
    }
    const { deep_link, bot_username, token } = await ordersApi.telegramLink(id);
    if (!deep_link) {
      win?.close();
      return "unavailable";
    }
    if (tg) {
      tg.openTelegramLink(deep_link);
      // 109: Bot API 7.0+ da Mini App o'zi yopilmaydi va bot chati uning ortida qoladi — yopiladi, to'lov chatda ko'rinadi
      // 116: taymersiz — chat ochilgach Mini App fonda, `setTimeout` ishlamay qoladi
      tg.close();
    } else if (mobile) openOnPhone(deep_link, bot_username, token);
    else if (win) {
      win.opener = null;
      win.location.href = deep_link;
    } else go(deep_link);
    return "opened";
  } catch (e) {
    win?.close();
    throw e;
  }
}

/** `opened` — bot tashqarida (buyurtma berilganda) allaqachon ochilgan */
export function TelegramPay({ order, onStale, compact, opened: openedOutside = false, children }: { order: Order; onStale?: () => void; compact?: boolean; opened?: boolean; children?: ReactNode }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedHere, setOpened] = useState(false);
  const opened = openedOutside || openedHere;
  const awaiting = order.status === "AWAITING_REVIEW";

  const pay = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await openTelegram(async () => order.id);
      if (r === "unavailable") setError(t("orders.tg.unavailable"));
      else setOpened(true);
    } catch (e) {
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
