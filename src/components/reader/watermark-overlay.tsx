"use client";

/**
 * Dinamik shaxsiy watermark (SECURITY.md §4): backend qaytargan HMAC-imzolangan
 * `watermark_text` butun o'quvchi maydoni ustiga plitka ko'rinishida qo'yiladi. Matn
 * foydalanuvchini aniqlashga imkon beradi (masked PII + trace id), lekin to'liq
 * shaxsiy ma'lumotni oshkor qilmaydi.
 */
import type { WatermarkPayload } from "@/lib/api";

export type WatermarkLike = Pick<WatermarkPayload, "watermark_text"> & Partial<WatermarkPayload>;

export function WatermarkOverlay({ payload, night }: { payload: WatermarkLike | null; night: boolean }) {
  if (!payload) return null;
  const label = payload.watermark_text || [payload.user_ref, payload.trace_id].filter(Boolean).join(" · ");
  // 95.3: o'qishga xalaqit bermasin — 24 → 9 ta (3 × 6 to'r, shaxmat tartibida), ochroq; har ekranda baribir bir
  // nechtasi ko'rinadi (skrinshot qilinsa — kimniki ekani aniqlanadi)
  const cells = Array.from({ length: 18 });
  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none overflow-hidden" aria-hidden data-testid="watermark-overlay">
      <div className="grid h-full w-full grid-cols-3 grid-rows-6 place-items-center">
        {cells.map((_, i) => (
          <span
            key={i}
            className={`-rotate-[22deg] whitespace-nowrap text-[12px] font-medium tracking-wide ${(Math.floor(i / 3) + (i % 3)) % 2 ? "invisible" : ""}`}
            style={{ color: night ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.045)" }}
            data-testid="watermark-cell"
          >
            {label}
          </span>
        ))}
      </div>
      {payload.trace_id && (
        <span className="absolute bottom-1 right-2 text-[11px]" style={{ color: night ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)" }}>
          {payload.trace_id}
        </span>
      )}
    </div>
  );
}
