import type { ReactNode } from "react";
import { PublicShell } from "@/components/layout/public-shell";

/** Public bo'lim (katalog) — auth talab qilinmaydi. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
