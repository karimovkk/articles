import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";

/** Admin bo'limi: auth guard (chromeless) → rol guard → o'z qobig'i (sidebar + topbar). */
export default function AdminGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell chromeless>
      <AdminGuard>
        <AdminShell>{children}</AdminShell>
      </AdminGuard>
    </AppShell>
  );
}
