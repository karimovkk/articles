import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { AppearanceProvider } from "@/providers/appearance-provider";
import { APPEARANCE_SCRIPT } from "@/lib/appearance";
import { LocaleEffect } from "@/i18n/locale-effect";
import { ConfirmProvider } from "@/components/ui/confirm";
import { env } from "@/lib/env";

// 43: minimalistik tipografiya — ikki shrift: matn, tugma, raqam — Manrope; sarlavhalar — Playfair Display (serif).
// Self-hosted (next/font). Playfair endi admin sarlavhalarida ham — oldindan yuklanadi.
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });
// 26.2: faqat ishlatiladigan qalinlik (700 + kursiv) — har ortiqcha qalinlik alohida fayl (≈30–50 KB)
const playfair = Playfair_Display({ subsets: ["latin", "cyrillic"], weight: ["700"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap" });

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
    <html lang="uz" suppressHydrationWarning className={`${manrope.variable} ${playfair.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* 44.8: admin tanlagan global ko'rinish (keshdan) — birinchi chizishdan oldin, rang "sakramasin" */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <AppearanceProvider />
          <LocaleEffect />
          <AuthProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
