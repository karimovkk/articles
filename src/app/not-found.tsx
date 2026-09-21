"use client";

import Link from "next/link";
import { useT } from "@/i18n";

export default function NotFound() {
  const { t } = useT();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-semibold text-text">404</p>
      <p className="text-muted">{t("common.pageNotFound")}</p>
      <Link href="/library" className="text-accent underline">
        {t("common.backToLibrary")}
      </Link>
    </div>
  );
}
