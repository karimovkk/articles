"use client";

/**
 * Deklarativ async yuklash: `deps` o'zgarsa qayta so'raydi, `reload()` majburan yangilaydi.
 * setState faqat promise callback'larida chaqiriladi (react-hooks/set-state-in-effect ga mos).
 * Qayta yuklashda eski `data` saqlanadi (UI "miltillamaydi"); `loading` — hozirgi kalit hali kelmagan.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/client";

interface Result<T> {
  key: string;
  data: T | null;
  error: string | null;
}

export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]) {
  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });

  const [nonce, setNonce] = useState(0);
  const key = `${JSON.stringify(deps)}#${nonce}`;
  const [result, setResult] = useState<Result<T>>({ key: "", data: null, error: null });

  useEffect(() => {
    let alive = true;
    fnRef
      .current()
      .then((data) => {
        if (alive) setResult({ key, data, error: null });
      })
      .catch((e: unknown) => {
        if (alive) setResult((r) => ({ key, data: r.data, error: errorMessage(e) }));
      });
    return () => {
      alive = false;
    };
  }, [key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((updater: (prev: T | null) => T | null) => setResult((r) => ({ ...r, data: updater(r.data) })), []);

  return { data: result.data, error: result.error, loading: result.key !== key, reload, setData };
}
