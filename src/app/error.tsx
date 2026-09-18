"use client";

import { Button } from "@/components/ui";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-xl font-semibold text-text">Xatolik yuz berdi</p>
      <p className="max-w-md text-sm text-muted">{error.message || "Noma'lum xatolik"}</p>
      <Button onClick={reset}>Qayta urinish</Button>
    </div>
  );
}
