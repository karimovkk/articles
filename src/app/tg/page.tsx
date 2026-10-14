"use client";

/**
 * 106: Telegram Mini App kirish manzili (BotFather → Menu Button / Web App URL = `<sayt>/tg`). Kirishni
 * `TelegramMiniApp` (ildiz layout'da) bajaradi; bu sahifa kirish tugashini kutadi va katalogga o'tadi.
 * Oddiy brauzerda ochilsa — "Telegram ichida oching" va katalog havolasi.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Spinner, buttonClass } from "@/components/ui";
import { launchedInTelegram } from "@/lib/telegram";
import { useAuth } from "@/providers/auth-provider";
import { useT } from "@/i18n";
import { useHydrated } from "@/lib/use-hydrated";

const WAIT_MS = 10_000;

export default function TelegramEntryPage() {
  const { t } = useT();
  const router = useRouter();
  const hydrated = useHydrated();
  const { user } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const inTelegram = hydrated && launchedInTelegram();

  useEffect(() => {
    if (!inTelegram) return;
    const id = window.setTimeout(() => setTimedOut(true), WAIT_MS);
    return () => window.clearTimeout(id);
  }, [inTelegram]);
  // Kirildi (yoki kutish tugadi — mehmon sifatida ham katalog ochiq) → katalog
  useEffect(() => {
    if (inTelegram && (user || timedOut)) router.replace("/catalog");
  }, [inTelegram, user, timedOut, router]);

  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-6 text-center" data-testid="tg-entry">
      {!hydrated || inTelegram ? (
        <div className="flex flex-col items-center gap-3 text-muted">
          <Spinner />
          <p className="text-sm">{t("tg.loggingIn")}</p>
        </div>
      ) : (
        <div className="max-w-sm space-y-4">
          <p className="text-lg font-bold text-text">{t("tg.notTelegram.title")}</p>
          <p className="text-sm text-muted">{t("tg.notTelegram.body")}</p>
          <Link href="/catalog" className={buttonClass()}>
            {t("tg.toCatalog")}
          </Link>
        </div>
      )}
    </main>
  );
}
