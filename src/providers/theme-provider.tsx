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
const WAVE_MS = 750;

function applyClass(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
  document.documentElement.style.colorScheme = t;
}

/** View Transitions bilan bosilgan nuqtadan aylana kengayib yangi mavzuni ochadi. */
function withWave(origin: ThemeOrigin | undefined, apply: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!origin || !doc.startViewTransition || reduced) return apply();
  const { x, y } = origin;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  document.documentElement.dataset.themeWave = "1";
  const vt = doc.startViewTransition(apply);
  vt.ready
    .then(() => {
      const anim = document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: WAVE_MS, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
      );
      return anim.finished;
    })
    .catch(() => undefined)
    .finally(() => {
      delete document.documentElement.dataset.themeWave;
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

const ThemeContext = createContext<{ theme: Theme; toggle: (origin?: ThemeOrigin) => void; setTheme: (t: Theme, origin?: ThemeOrigin) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyClass(theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme, origin?: ThemeOrigin) => {
    withWave(origin, () => {
      window.localStorage.setItem(KEY, t);
      applyClass(t); // sinxron — view transition snapshot'i yangi mavzuni olsin
      listeners.forEach((l) => l());
    });
  }, []);
  const toggle = useCallback((origin?: ThemeOrigin) => setTheme(theme === "dark" ? "light" : "dark", origin), [theme, setTheme]);

  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme faqat <ThemeProvider> ichida ishlaydi");
  return ctx;
}
