"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { useT } from "@/i18n";

export default function NotFound() {
  const { t } = useT();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-7xl font-semibold tracking-tight text-text">404</p>
      <p className="font-semibold text-muted">{t("common.pageNotFound")}</p>
      <Link href="/library" className={buttonClass("primary")}>
        <I.ArrowLeft size={16} />
        {t("common.backToLibrary")}
      </Link>
    </div>
  );
}
