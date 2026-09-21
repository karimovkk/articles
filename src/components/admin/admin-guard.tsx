"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { EmptyState, buttonClass } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { useT } from "@/i18n";

/** Brauzer tomonidagi rol tekshiruvi — haqiqiy himoya backend `require_admin`da. */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { t } = useT();
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <EmptyState
          className="w-full max-w-md bg-surface"
          icon={<I.Lock size={22} />}
          title={t("admin.onlyAdmin")}
          action={
            <Link href="/library" className={buttonClass("primary")}>
              <I.ArrowLeft size={16} />
              {t("common.backToLibrary")}
            </Link>
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}
