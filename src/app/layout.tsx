import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Caveat, Manrope, Playfair_Display, Unbounded } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { LocaleEffect } from "@/i18n/locale-effect";
import { ConfirmProvider } from "@/components/ui/confirm";
import { env } from "@/lib/env";

// Shriftlar: matn — Manrope, sarlavha/raqam — Unbounded (self-hosted, next/font)
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });
// 26.2: sarlavha shrifti faqat lotin qismida oldindan yuklanadi — interfeys lotin yozuvida; kirill matn
// (kitob nomi bo'lsa) tizim shriftida chiqadi, lekin har sahifada ≈50 KB kam yuklanadi.
const unbounded = Unbounded({ subsets: ["latin"], variable: "--font-unbounded", display: "swap" });
// Mijoz tomoni (16): hero/sarlavhalar — serif (Playfair Display), bezak yozuvi — Caveat. Faqat mijoz sahifalarida
// ishlatiladi — preload qilinmaydi (admin sahifalari ularni yuklamaydi)
// 26.2: faqat ishlatiladigan qalinlik (700 + kursiv) — har ortiqcha qalinlik alohida fayl (≈30–50 KB)
const playfair = Playfair_Display({ subsets: ["latin", "cyrillic"], weight: ["700"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap", preload: false });
const caveat = Caveat({ subsets: ["latin", "cyrillic"], weight: ["600"], variable: "--font-caveat", display: "swap", preload: false });

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
    <html lang="uz" suppressHydrationWarning className={`${manrope.variable} ${unbounded.variable} ${playfair.variable} ${caveat.variable}`}>
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
