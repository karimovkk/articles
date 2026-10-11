"use client";

/**
 * 91: saqlanmagan o'zgarishlar. `dirty` bo'lsa:
 *  - tabni yopish / yangilash — brauzerning o'z tasdiq oynasi (beforeunload);
 *  - sahifadagi istalgan havola (Link: breadcrumbs, menyu, oldingi/keyingi) — `ask()` tasdig'i, rozi bo'lsa o'tiladi.
 * Brauzer "Orqaga" tugmasi (popstate) to'xtatilmaydi — App Router tarixini buzmaslik uchun.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function useUnsavedGuard(dirty: boolean, ask: () => Promise<boolean>) {
  const router = useRouter();
  const askRef = useRef(ask);
  useEffect(() => {
    askRef.current = ask;
  });
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    // Capture bosqichida — Link'ning o'z onClick'idan oldin
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.pathname === location.pathname && url.search === location.search) return; // shu sahifa (yoki #langar)
      e.preventDefault();
      e.stopPropagation();
      void askRef.current().then((ok) => {
        if (!ok) return;
        if (url.origin === location.origin) router.push(url.pathname + url.search + url.hash);
        else location.href = url.href;
      });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, router]);
}
