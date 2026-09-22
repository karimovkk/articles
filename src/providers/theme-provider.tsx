"use client";

/**
 * Mavzu (light/dark): localStorage + prefers-color-scheme tashqi store sifatida.
 * `toggle(origin)` — bosilgan nuqtadan "to'lqin" bilan almashadi (View Transitions API, `clip-path: circle()`);
 * API yo'q yoki `prefers-reduced-motion` bo'lsa — oddiy almashish. DOM sinfi (`.dark`) sinxron o'zgartiriladi,
 * shunda snapshot yangi mavzuni oladi.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

type Theme = "light" | "dark";
const KEY = "a365.theme";
export interface ThemeOrigin {
  x: number;
  y: number;
}
const WAVE_MS = 600;

function applyClass(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
  document.documentElement.style.colorScheme = t;
}

/** View Transitions bilan bosilgan nuqtadan aylana kengayib yangi mavzuni ochadi. */
let waveSeq = 0;
function withWave(origin: ThemeOrigin | undefined, apply: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void>; skipTransition: () => void } };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!origin || !doc.startViewTransition || reduced) return apply();
  const { x, y } = origin;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const seq = ++waveSeq; // ketma-ket bosilsa — faqat oxirgi to'lqin atributni olib tashlaydi
  document.documentElement.dataset.themeWave = "1";
  const vt = doc.startViewTransition(apply);
  // To'lqin paytida brauzer bosishlarni ::view-transition qatlamiga yutadi (target = <html>, Chrome'da
  // pointer-events ham yordam bermaydi). Bosilsa — to'lqin darhol tugatiladi va bosish asl elementga qayta yuboriladi.
  const onClick = (e: MouseEvent) => {
    if (e.target !== document.documentElement) return;
    e.stopPropagation();
    e.preventDefault();
    const { clientX, clientY } = e;
    vt.skipTransition();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.elementFromPoint(clientX, clientY);
        if (el && el !== document.documentElement) el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX, clientY, detail: 1, view: window }));
      }),
    );
  };
  document.addEventListener("click", onClick, true);
  vt.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: WAVE_MS, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
      );
      return vt.finished;
    })
    .catch(() => undefined)
    .finally(() => {
      document.removeEventListener("click", onClick, true);
      if (seq === waveSeq) delete document.documentElement.dataset.themeWave;
    });
}

/* localStorage + prefers-color-scheme — tashqi store sifatida */
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", cb);
  };
}
function getSnapshot(): Theme {
  const saved = window.localStorage.getItem(KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
const getServerSnapshot = (): Theme => "light";

const ThemeContext = createContext<{ theme: Theme; toggle: (origin?: ThemeOrigin) => void; setTheme: (t: Theme | ((cur: Theme) => Theme), origin?: ThemeOrigin) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyClass(theme);
  }, [theme]);

  // Yangi qiymat apply paytida (view transition callback'i ichida) hisoblanadi — ketma-ket tez bosilganda
  // eskirgan React holati emas, joriy saqlangan mavzu asos bo'ladi (ikki marta bosish = ikki almashish)
  const setTheme = useCallback((t: Theme | ((cur: Theme) => Theme), origin?: ThemeOrigin) => {
    withWave(origin, () => {
      const next = typeof t === "function" ? t(getSnapshot()) : t;
      window.localStorage.setItem(KEY, next);
      applyClass(next); // sinxron — view transition snapshot'i yangi mavzuni olsin
      listeners.forEach((l) => l());
    });
  }, []);
  const toggle = useCallback((origin?: ThemeOrigin) => setTheme((cur) => (cur === "dark" ? "light" : "dark"), origin), [setTheme]);

  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme faqat <ThemeProvider> ichida ishlaydi");
  return ctx;
}
