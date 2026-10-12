"use client";

/**
 * 95.5: admin — fon rasmining har qurilmada (telefon / planshet / kompyuter) ko'rinadigan qismi.
 * To'liq rasm ustida tanlangan qurilma ekraniga sig'adigan ramka: bosib yoki sudrab joyini tanlaydi. Pastda — uch
 * qurilmada qanday ko'rinishi. Natija `background-position` foizi (`settings.appearance.background_focus_*`).
 */
import { useRef, useState, type PointerEvent } from "react";
import { cn } from "@/components/ui";
import { BG_DEVICES, BG_DEVICE_ASPECT, type BgDevice, type BgFocus, type BgFocusPoint } from "@/lib/appearance";
import { useT } from "@/i18n";

const DEFAULT: BgFocusPoint = { x: 50, y: 0 }; // CSS standarti: center top

/** Rasm nisbati va ekran nisbatidan — `cover` da ko'rinadigan ulush (eni, bo'yi) */
const visible = (imgRatio: number, aspect: number) => (imgRatio > aspect ? { w: aspect / imgRatio, h: 1 } : { w: 1, h: imgRatio / aspect });

export function BgFocusEditor({ url, focus, onChange, testid }: { url: string; focus: BgFocus | null | undefined; onChange: (f: BgFocus) => void; testid: string }) {
  const { t } = useT();
  const [device, setDevice] = useState<BgDevice>("mobile");
  const [ratio, setRatio] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const point = (d: BgDevice) => focus?.[d] ?? DEFAULT;
  const v = ratio ? visible(ratio, BG_DEVICE_ASPECT[device]) : { w: 1, h: 1 };
  const p = point(device);
  const left = (1 - v.w) * (p.x / 100);
  const top = (1 - v.h) * (p.y / 100);

  const setFrom = (e: PointerEvent<HTMLDivElement>) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r || !ratio) return;
    const cx = (e.clientX - r.left) / r.width;
    const cy = (e.clientY - r.top) / r.height;
    const l = Math.min(Math.max(cx - v.w / 2, 0), 1 - v.w);
    const tp = Math.min(Math.max(cy - v.h / 2, 0), 1 - v.h);
    const next = { x: v.w < 1 ? Math.round((l / (1 - v.w)) * 1000) / 10 : 50, y: v.h < 1 ? Math.round((tp / (1 - v.h)) * 1000) / 10 : 50 };
    onChange({ ...(focus ?? {}), [device]: next });
  };

  return (
    <div className="bg-focus space-y-3" data-testid={testid}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-text">{t("appearance.focus.title")}</span>
        <div className="seg" role="group" aria-label={t("appearance.focus.title")}>
          {BG_DEVICES.map((d) => (
            <button key={d} type="button" className={cn(device === d && "active")} aria-pressed={device === d} onClick={() => setDevice(d)} data-testid={`${testid}-device-${d}`}>
              {t(`appearance.focus.${d}`)}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={boxRef}
        className="bg-focus-img"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setFrom(e);
        }}
        onPointerMove={(e) => dragging.current && setFrom(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        data-testid={`${testid}-img`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- admin oldindan ko'rish (versiyali URL) */}
        <img src={url} alt="" draggable={false} onLoad={(e) => setRatio(e.currentTarget.naturalWidth / Math.max(1, e.currentTarget.naturalHeight))} />
        {ratio && (
          <span
            className="bg-focus-frame"
            style={{ left: `${left * 100}%`, top: `${top * 100}%`, width: `${v.w * 100}%`, height: `${v.h * 100}%` }}
            data-testid={`${testid}-frame`}
          />
        )}
      </div>
      <p className="text-xs text-muted">{t("appearance.focus.hint")}</p>
      <div className="bg-focus-devices">
        {BG_DEVICES.map((d) => {
          const q = point(d);
          return (
            <button
              key={d}
              type="button"
              className={cn("bg-focus-device", d, device === d && "active")}
              onClick={() => setDevice(d)}
              style={{ backgroundImage: `url("${url}")`, backgroundPosition: `${q.x}% ${q.y}%` }}
              aria-label={t(`appearance.focus.${d}`)}
              data-testid={`${testid}-preview-${d}`}
            >
              <span>{t(`appearance.focus.${d}`)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
