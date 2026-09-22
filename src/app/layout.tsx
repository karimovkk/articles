import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope, Unbounded } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { LocaleEffect } from "@/i18n/locale-effect";
import { ConfirmProvider } from "@/components/ui/confirm";
import { env } from "@/lib/env";

// Shriftlar: matn — Manrope, sarlavha/raqam — Unbounded (self-hosted, next/font)
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });
const unbounded = Unbounded({ subsets: ["latin", "cyrillic"], variable: "--font-unbounded", display: "swap" });

/**
 * Mavzuni birinchi paint'dan OLDIN qo'llash (hydration'gacha oq "flash" bo'lmasin):
 * localStorage `a365.theme` → bo'lmasa tizim afzalligi. ThemeProvider bilan bir xil mantiq.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('a365.theme');if(t!=='dark'&&t!=='light'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}var d=document.documentElement;d.classList.toggle('dark',t==='dark');d.style.colorScheme=t}catch(e){}})()`;

export const metadata: Metadata = {
  title: { default: env.appName, template: `%s · ${env.appName}` },
  description: "Himoyalangan elektron kutubxona — kitoblar faqat web-reader ichida o'qiladi.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning className={`${manrope.variable} ${unbounded.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <LocaleEffect />
          <AuthProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
