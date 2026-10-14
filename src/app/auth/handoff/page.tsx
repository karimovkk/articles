"use client";

/**
 * 106: Mini App'dan saytga avtomatik kirish — `/auth/handoff?token=…` (bir martalik, 120 s).
 * Token `POST /auth/telegram/handoff/exchange` bilan sessiyaga almashtiriladi va manzildan darhol olib tashlanadi
 * (tarixda / referrer'da qolmasin); so'ng kutubxonaga. Eskirgan / ishlatilgan — tushunarli xabar va kirish havolasi.
 */
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Spinner, buttonClass } from "@/components/ui";
import { authApi, errorMessage, isApiError } from "@/lib/api";
import { useT } from "@/i18n";

/** Bir martalik token — dev'dagi StrictMode ikki marta chaqirsa ham bir marta almashtiriladi */
const started = new Set<string>();

function Handoff() {
  const { t } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const token = useRef(params.get("token"));

  useEffect(() => {
    const tok = token.current;
    if (!tok) {
      setError(t("tg.handoff.missing"));
      return;
    }
    window.history.replaceState(null, "", "/auth/handoff");
    if (started.has(tok)) return;
    started.add(tok);
    authApi
      .handoffExchange(tok)
      .then(() => router.replace("/library"))
      .catch((e) => setError(isApiError(e) && e.code === "INVALID_HANDOFF_TOKEN" ? t("tg.handoff.expired") : errorMessage(e)));
  }, [router, t]);

  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-6" data-testid="handoff">
      {error ? (
        <div className="w-full max-w-sm space-y-4 text-center">
          <Alert>{error}</Alert>
          <Link href="/login" className={buttonClass()}>
            {t("auth.login")}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-muted">
          <Spinner />
          <p className="text-sm">{t("tg.handoff.loading")}</p>
        </div>
      )}
    </main>
  );
}

export default function HandoffPage() {
  return (
    <Suspense fallback={null}>
      <Handoff />
    </Suspense>
  );
}
