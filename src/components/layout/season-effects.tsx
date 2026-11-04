"use client";

/**
 * 125: mavsumiy effekt qatlami (admin yoqadi — `settings.decor.season`). Faqat mijoz qobig'ida (`ClientShell`):
 * reader (o'qish) va admin sahifalarida yo'q. O'chirilgan bo'lsa — hech qanday kod yuklanmaydi; yoqilgan bo'lsa
 * canvas chunk'i brauzer bo'shaganda (birinchi chizishdan keyin) yuklanadi. Harakatni kamaytirish yoki trafik tejash
 * rejimida — o'chiq.
 */
import { useEffect, useState, type ComponentType } from "react";
import { activeSeason, type Season } from "@/lib/decor";
import { useDecor } from "@/providers/appearance-provider";
import { useMediaQuery } from "@/lib/use-media-query";

// `next/dynamic` chunk'ni oldindan yuklab qo'yadi — oddiy `import()` esa faqat effekt yoqilganda (o'chiq — 0 bayt)
type CanvasCmp = ComponentType<{ season: Season }>;
let SeasonCanvas: CanvasCmp | null = null;

export function SeasonEffects() {
  const { decor } = useDecor();
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [Canvas, setCanvas] = useState<CanvasCmp | null>(() => SeasonCanvas);
  const season = activeSeason(decor.season);
  const enabled = !!season && !reduced;

  useEffect(() => {
    if (!enabled || Canvas) return;
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    let alive = true;
    const load = () =>
      void import("./season-canvas").then((m) => {
        SeasonCanvas = m.default;
        if (alive) setCanvas(() => m.default);
      });
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(load, { timeout: 2500 });
      return () => {
        alive = false;
        w.cancelIdleCallback?.(id);
      };
    }
    const id = setTimeout(load, 1200);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [enabled, Canvas]);

  if (!enabled || !Canvas || !season) return null;
  return <Canvas season={season} />;
}
