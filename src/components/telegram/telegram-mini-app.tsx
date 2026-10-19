"use client";

/**
 * 106: Telegram Mini App — sayt Telegram ichida (bot menyusi) ochilganda:
 *  - SDK yuklanadi, `ready()` / `expand()`;
 *  - parolsiz kirish: `initData` (o'zgartirilmasdan) → `POST /auth/telegram/webapp` — Mini App sessiyasida bir marta;
 *  - Telegram'ning pastki tugmasi (MainButton) "Saytda ochish": `POST /auth/telegram/handoff` → `openLink(url)` —
 *    sayt tashqi brauzerda shu akkaunt bilan kirgan holda ochiladi; 115: domen — `env.siteUrl` (articles365.uz).
 *  - 111: Mini App'da faqat sotib olish va kirish/ro'yxat sahifalari — boshqa manzil → `/catalog`.
 * Oddiy brauzerda hech narsa qilmaydi (SDK ham yuklanmaydi).
 */
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { authApi, errorMessage, isApiError, tokenStore } from "@/lib/api";
import { env } from "@/lib/env";
import { loadTelegram, miniAppAllowed, type TelegramWebApp } from "@/lib/telegram";
import { useInTelegram } from "@/lib/use-in-telegram";
import { useAuth } from "@/providers/auth-provider";
import { useT } from "@/i18n";

/** Shu Mini App sessiyasida kirildi (initData xeshi — o'zi saqlanmaydi) */
const LOGIN_KEY = "a365.tg.login";

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function sGet(store: () => Storage, k: string): string | null {
  try {
    return store().getItem(k);
  } catch {
    return null;
  }
}
function sSet(store: () => Storage, k: string, v: string) {
  try {
    store().setItem(k, v);
  } catch {
    /* private rejim */
  }
}

/** 115: backend havolasining manzili (`/auth/handoff?token=…`) saqlanadi, domen — `env.siteUrl` */
function onSite(url: string): string {
  if (!env.siteUrl) return url;
  try {
    const u = new URL(url);
    return `${env.siteUrl}${u.pathname}${u.search}${u.hash}`;
  } catch {
    return url;
  }
}

export function TelegramMiniApp() {
  const { t } = useT();
  const { user } = useAuth();
  const [tg, setTg] = useState<TelegramWebApp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const inTelegram = useInTelegram();
  const pathname = usePathname();
  const router = useRouter();

  // 111: ruxsat etilmagan sahifa (o'qish, kutubxona, profil…) — katalogga; ular saytda ("Saytda ochish")
  useEffect(() => {
    if (inTelegram && !miniAppAllowed(pathname)) router.replace("/catalog");
  }, [inTelegram, pathname, router]);

  // SDK + parolsiz kirish
  useEffect(() => {
    let alive = true;
    void loadTelegram().then(async (w) => {
      if (!alive || !w) return;
      w.ready();
      w.expand();
      document.documentElement.dataset.telegram = "1";
      setTg(w);
      const key = hash(w.initData);
      if (sGet(() => sessionStorage, LOGIN_KEY) === key && tokenStore.getAccess()) return;
      try {
        await authApi.telegramWebApp(w.initData);
        sSet(() => sessionStorage, LOGIN_KEY, key);
      } catch (e) {
        if (alive) setError(isApiError(e) && e.code === "TELEGRAM_AUTH_FAILED" ? t("tg.authFailed") : errorMessage(e));
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bir marta (sahifa ochilganda)
  }, []);

  // Saytda ochish — avtomatik kirish havolasi (bir martalik, 120 s) shu bosishda olinadi
  const openSite = async () => {
    if (!tg || opening) return;
    setOpening(true);
    setError(null);
    tg.MainButton?.showProgress?.(false);
    try {
      const h = await authApi.telegramHandoff();
      tg.openLink(onSite(h.url));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      tg.MainButton?.hideProgress?.();
      setOpening(false);
    }
  };

  // Telegram'ning pastki tugmasi (bo'lmasa — sahifadagi tugma)
  const mainButton = tg?.MainButton;
  useEffect(() => {
    if (!mainButton || !user) return;
    const onClick = () => void openSite();
    mainButton.setText(t("tg.openSite"));
    mainButton.onClick(onClick);
    mainButton.show();
    return () => {
      mainButton.offClick(onClick);
      mainButton.hide();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openSite har render'da yangi; tugma bir marta ulanadi
  }, [mainButton, user, t]);

  if (!tg) return null;
  const showFallback = !!user && !mainButton;
  if (!error && !showFallback) return null;
  return (
    <div className="tg-dock" data-testid="tg-dock">
      {error && (
        <div className="tg-card danger" role="alert" data-testid="tg-error">
          <I.AlertTriangle size={18} />
          <p className="min-w-0 flex-1 text-sm">{error}</p>
          <button type="button" className="icon-btn plain sm" onClick={() => setError(null)} aria-label={t("common.close")}>
            <I.X size={16} />
          </button>
        </div>
      )}
      {showFallback && (
        <Button className="w-full" onClick={() => void openSite()} loading={opening} icon={<I.ArrowUpRight size={16} />} data-testid="tg-open-site">
          {t("tg.openSite")}
        </Button>
      )}
    </div>
  );
}
