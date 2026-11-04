import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Literata, Onest } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { AppearanceProvider } from "@/providers/appearance-provider";
import { APPEARANCE_SCRIPT } from "@/lib/appearance";
import { LocaleEffect } from "@/i18n/locale-effect";
import { ConfirmProvider } from "@/components/ui/confirm";
import { TelegramMiniApp } from "@/components/telegram/telegram-mini-app";
import { TELEGRAM_CAPTURE_SCRIPT } from "@/lib/telegram";
import { env } from "@/lib/env";

// 124: tipografiya — kitob o'qish ilovasi ruhida ikki shrift (ikkalasi OFL, next/font orqali self-hosted):
//  - Literata — sarlavhalar va "o'qish" matnlari (Google Play Books uchun yaratilgan serif; optik o'lcham o'qi bor)
//  - Onest — interfeys (tugma, forma, raqam); lotin + kirill, tinch va aniq grotesk
const onest = Onest({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-ui", display: "swap" });
const literata = Literata({ subsets: ["latin", "latin-ext", "cyrillic"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-serif-src", display: "swap" });

/**
 * Mavzuni birinchi paint'dan OLDIN qo'llash (hydration'gacha oq "flash" bo'lmasin):
 * localStorage `a365.theme` → bo'lmasa tizim afzalligi. ThemeProvider bilan bir xil mantiq.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('a365.theme');if(t!=='dark'&&t!=='light'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}var d=document.documentElement;d.classList.toggle('dark',t==='dark');d.style.colorScheme=t}catch(e){}})()`;

export const metadata: Metadata = {
  title: { default: env.appName, template: `%s · ${env.appName}` },
  description: "Himoyalangan elektron kutubxona — maqolalar faqat web-reader ichida o'qiladi.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning className={`${onest.variable} ${literata.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* 44.8: admin tanlagan global ko'rinish (keshdan) — birinchi chizishdan oldin, rang "sakramasin" */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
        {/* 117: Telegram Mini App — `#tgWebAppData` yo'naltirishdan oldin saqlanadi (SDK keyin yuklanadi) */}
        <script dangerouslySetInnerHTML={{ __html: TELEGRAM_CAPTURE_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <AppearanceProvider />
          <LocaleEffect />
          <AuthProvider>
            <ConfirmProvider>
              {children}
              {/* 106: Telegram Mini App — parolsiz kirish, telefon, "Saytda ochish" (oddiy brauzerda hech narsa qilmaydi) */}
              <TelegramMiniApp />
            </ConfirmProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
