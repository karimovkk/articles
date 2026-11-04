"use client";

/**
 * 124: "maqolada qancha qoldi" — faqat shu qurilmada (backend talab qilmaydi).
 * Vaqt faqat haqiqiy o'qishda yig'iladi: sahifa ko'rinib tursa va oxirgi 2 daqiqada harakat (aylantirish,
 * bosish, tugma) bo'lsa. O'qish tezligi shu seansda o'lchanadi.
 */
import { useEffect, useRef, useState } from "react";

const IDLE_MS = 120_000;
/** Tezlik hali o'lchanmagan bo'lsa — bir bet uchun taxmin (soniya) */
const DEFAULT_SEC_PER_PAGE = 75;

export interface ReadingSession {
  /** Maqola oxirigacha taxminiy daqiqa; bet soni noma'lum bo'lsa — null */
  minutesLeft: number | null;
}

export function useReadingSession({ page, pageCount, enabled }: { page: number; pageCount: number; enabled: boolean }): ReadingSession {
  const lastAct = useRef(0);
  // seans: o'qilgan soniya va boshlang'ich bet (tezlikni o'lchash uchun)
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [startPage, setStartPage] = useState(page);
  const [maxPage, setMaxPage] = useState(page);
  if (page > maxPage) setMaxPage(page);
  if (startPage === 1 && page > 1 && sessionSeconds === 0) setStartPage(page);

  useEffect(() => {
    if (!enabled) return;
    lastAct.current = Date.now();
    const act = () => (lastAct.current = Date.now());
    const evs = ["pointerdown", "keydown", "wheel", "scroll", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, act, { passive: true, capture: true }));
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible" || Date.now() - lastAct.current > IDLE_MS) return;
      setSessionSeconds((n) => n + 1);
    }, 1000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, act, { capture: true }));
      window.clearInterval(id);
    };
  }, [enabled]);

  let minutesLeft: number | null = null;
  if (pageCount > 0) {
    const advanced = maxPage - startPage;
    const perPage = advanced >= 2 && sessionSeconds > 20 ? Math.min(600, Math.max(15, sessionSeconds / advanced)) : DEFAULT_SEC_PER_PAGE;
    const pagesLeft = Math.max(0, pageCount - page + 0.5);
    minutesLeft = Math.max(1, Math.round((pagesLeft * perPage) / 60));
    if (page >= pageCount) minutesLeft = 0;
  }
  return { minutesLeft };
}
