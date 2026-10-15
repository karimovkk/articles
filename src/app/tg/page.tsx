"use client";

/**
 * 106: Telegram Mini App kirish manzili (BotFather → Menu Button / Web App URL = `<sayt>/tg`). Telegram ichida darhol
 * katalogga o'tadi (110: mehmon sifatida — sotib olishda kirish/ro'yxatdan o'tish saytdagidek so'raladi).
 * Oddiy brauzerda ochilsa — "Telegram ichida oching" va katalog havolasi.
 */
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Spinner, buttonClass } from "@/components/ui";
import { launchedInTelegram } from "@/lib/telegram";
import { useT } from "@/i18n";
import { useHydrated } from "@/lib/use-hydrated";

export default function TelegramEntryPage() {
  const { t } = useT();
  const router = useRouter();
  const hydrated = useHydrated();
  const inTelegram = hydrated && launchedInTelegram();

  useEffect(() => {
    if (inTelegram) router.replace("/catalog");
  }, [inTelegram, router]);

  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-6 text-center" data-testid="tg-entry">
      {!hydrated || inTelegram ? (
        <Spinner />
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
