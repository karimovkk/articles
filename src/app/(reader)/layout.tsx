import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

/** Reader — navigatsiyasiz, to'liq ekranli qobiq (auth guard saqlanadi). */
export default function ReaderLayout({ children }: { children: ReactNode }) {
  return <AppShell chromeless>{children}</AppShell>;
}
