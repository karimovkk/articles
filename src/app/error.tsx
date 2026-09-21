"use client";

import { Button } from "@/components/ui";
import { useT } from "@/i18n";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-xl font-semibold text-text">{t("common.errorTitle")}</p>
      <p className="max-w-md text-sm text-muted">{error.message || t("common.unknownError")}</p>
      <Button onClick={reset}>{t("common.retry")}</Button>
    </div>
  );
}
