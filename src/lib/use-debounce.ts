"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Jonli qidiruv uchun kechiktirilgan qiymat: `value` o'zgargach `ms` dan keyin `debounced` yangilanadi;
 * `flush()` (masalan, Enter bosilganda) darhol tenglashtiradi. Eskirgan javoblarni `useAsync` o'zi tashlab yuboradi.
 */
export function useDebounced<T>(value: T, ms = 300): [T, () => void] {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  const flush = useCallback(() => setDebounced(value), [value]);
  return [debounced, flush];
}

/**
 * Kechiktirilgan chaqiruv: `call(args)` — `ms` dan keyin oxirgi argumentlar bilan `fn`; `flush()` — kutmasdan;
 * `cancel()` — bekor. `fn` har render'da yangilanadi (eskirgan closure yo'q); unmount'da taymer tozalanadi.
 */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, ms = 300) {
  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });
  const timer = useRef<number | null>(null);
  const pending = useRef<A | null>(null);
  const cancel = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  }, []);
  const flush = useCallback(() => {
    const args = pending.current;
    cancel();
    if (args) fnRef.current(...args);
  }, [cancel]);
  const call = useCallback(
    (...args: A) => {
      cancel();
      pending.current = args;
      timer.current = window.setTimeout(flush, ms);
    },
    [cancel, flush, ms],
  );
  useEffect(() => cancel, [cancel]);
  return { call, flush, cancel };
}
