import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { LocaleEffect } from "@/i18n/locale-effect";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: { default: env.appName, template: `%s · ${env.appName}` },
  description: "Himoyalangan elektron kutubxona — kitoblar faqat web-reader ichida o'qiladi.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <LocaleEffect />
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
