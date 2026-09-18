"use client";

/**
 * Dinamik shaxsiy watermark (SECURITY.md §4): backend qaytargan HMAC-imzolangan
 * label butun o'quvchi maydoni ustiga plitka ko'rinishida qo'yiladi. Label
 * foydalanuvchini aniqlashga imkon beradi (masked PII + trace id), lekin
 * to'liq shaxsiy ma'lumotni oshkor qilmaydi.
 */
import type { WatermarkPayload } from "@/lib/api";

export function WatermarkOverlay({ payload, night }: { payload: WatermarkPayload | null; night: boolean }) {
  if (!payload) return null;
  const label = payload.label || [payload.user_ref, payload.trace_id].filter(Boolean).join(" · ");
  const cells = Array.from({ length: 24 });
  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none overflow-hidden" aria-hidden>
      <div className="grid h-full w-full grid-cols-3 grid-rows-8 place-items-center">
        {cells.map((_, i) => (
          <span
            key={i}
            className="-rotate-[22deg] whitespace-nowrap text-[13px] font-medium tracking-wide"
            style={{ color: night ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)" }}
          >
            {label}
          </span>
        ))}
      </div>
      {payload.trace_id && (
        <span className="absolute bottom-1 right-2 text-[10px]" style={{ color: night ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)" }}>
          {payload.trace_id}
        </span>
      )}
    </div>
  );
}
