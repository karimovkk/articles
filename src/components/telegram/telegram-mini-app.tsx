"use client";

/**
 * 106: Telegram Mini App — sayt Telegram ichida (bot menyusi) ochilganda:
 *  - SDK yuklanadi, `ready()` / `expand()`;
 *  - 110: kirish saytdagidek — telefon + parol (`/login`, `/register`). Parolsiz (`initData`) kirish va telefon
 *    ulashish (`requestContact`) yo'q: Mini App va sayt — bitta akkaunt, bitta kirish usuli;
 *  - kirgan foydalanuvchi uchun Telegram'ning pastki tugmasi (MainButton) "Saytda ochish":
 *    `POST /auth/telegram/handoff` → `openLink(url)` — sayt tashqi brauzerda shu akkaunt bilan kirgan holda ochiladi.
 * Oddiy brauzerda hech narsa qilmaydi (SDK ham yuklanmaydi).
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { authApi, errorMessage } from "@/lib/api";
import { loadTelegram, type TelegramWebApp } from "@/lib/telegram";
import { useAuth } from "@/providers/auth-provider";
import { useT } from "@/i18n";

export function TelegramMiniApp() {
  const { t } = useT();
  const { user } = useAuth();
  const [tg, setTg] = useState<TelegramWebApp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  // SDK
  useEffect(() => {
    let alive = true;
    void loadTelegram().then((w) => {
      if (!alive || !w) return;
      w.ready();
      w.expand();
      document.documentElement.dataset.telegram = "1";
      setTg(w);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Saytda ochish — avtomatik kirish havolasi (bir martalik, 120 s) shu bosishda olinadi
  const openSite = async () => {
    if (!tg || opening) return;
    setOpening(true);
    setError(null);
    tg.MainButton?.showProgress?.(false);
    try {
      const h = await authApi.telegramHandoff();
      tg.openLink(h.url);
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
