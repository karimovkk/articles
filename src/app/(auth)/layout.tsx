import type { ReactNode } from "react";
import { env } from "@/lib/env";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-text">{env.appName}</h1>
          <p className="mt-1 text-sm text-muted">Himoyalangan elektron kutubxona</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
