import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

/** Reader — navigatsiyasiz, to'liq ekranli qobiq. 37: mehmon ham kiradi (tekin kitob); pullik — reader o'zi yo'naltiradi. */
export default function ReaderLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell chromeless allowGuest>
      {children}
    </AppShell>
  );
}
