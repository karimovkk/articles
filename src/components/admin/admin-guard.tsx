"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { Alert } from "@/components/ui";
import { useT } from "@/i18n";

/** Brauzer tomonidagi rol tekshiruvi — haqiqiy himoya backend `require_admin`da. */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { t } = useT();
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <Alert>{t("admin.onlyAdmin")}</Alert>
        <Link href="/library" className="text-sm text-accent underline">
          {t("common.backToLibrary")}
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
