import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { MusicScope } from "@/components/reader/music-scope";

/** Reader — navigatsiyasiz, to'liq ekranli qobiq. 37: mehmon ham kiradi (tekin kitob); pullik — reader o'zi yo'naltiradi. */
export default function ReaderLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell chromeless allowGuest>
      {/* 124: o'qish musiqasi maqolalar orasida to'xtamaydi — pleyer layout darajasida */}
      <MusicScope />
      {children}
    </AppShell>
  );
}
