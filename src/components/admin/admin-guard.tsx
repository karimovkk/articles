"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { Alert } from "@/components/ui";

/** Brauzer tomonidagi rol tekshiruvi — haqiqiy himoya backend `require_admin`da. */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <Alert>Bu bo&apos;lim faqat ADMIN roli uchun (PERMISSION_DENIED).</Alert>
        <Link href="/library" className="text-sm text-accent underline">
          Kutubxonaga qaytish
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
