/**
 * Highlight koordinatalari (FE-5.2) va ranglar (FE-5.5, S-32).
 *
 * Koordinata formati — backend `annotations.location_data` (opaque JSON, ≤ 32 KB) ichida:
 *   { page: number, rects: [[x, y, w, h], ...] }
 * Har rect sahifa o'lchamiga nisbatan 0–1 ulushlarda saqlanadi, shu sababli
 * zoom/DPR/ekran o'lchamidan qat'i nazar joyida qoladi. Backend tasdiqlagan
 * (2026-09-21): ichki tuzilish tekshirilmaydi, o'zgarmagan holda qaytadi.
 */
import type { Annotation } from "@/lib/api/types";
import type { DictKey } from "@/i18n";

/** [x, y, w, h] — sahifa kengligi/balandligiga nisbatan ulush (0–1). */
export type HighlightRect = [number, number, number, number];

export interface HighlightColor {
  id: string;
  hex: string;
  /** Lug'at kaliti (`color.*`) — `t(labelKey)` */
  labelKey: DictKey;
}

/** 8 xil rang (S-32). `hex` annotatsiyaning `color` maydonida saqlanadi. */
export const HIGHLIGHT_COLORS: readonly HighlightColor[] = [
  { id: "yellow", hex: "#fde047", labelKey: "color.yellow" },
  { id: "green", hex: "#86efac", labelKey: "color.green" },
  { id: "blue", hex: "#93c5fd", labelKey: "color.blue" },
  { id: "pink", hex: "#f9a8d4", labelKey: "color.pink" },
  { id: "orange", hex: "#fdba74", labelKey: "color.orange" },
  { id: "purple", hex: "#c4b5fd", labelKey: "color.purple" },
  { id: "red", hex: "#fca5a5", labelKey: "color.red" },
  { id: "teal", hex: "#5eead4", labelKey: "color.teal" },
];

export const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLORS[0].hex;

/** Noma'lum/bo'sh rang bo'lsa default qaytadi (eski yozuvlar uchun). */
export function normalizeColor(color?: string | null): string {
  if (!color) return DEFAULT_HIGHLIGHT_COLOR;
  return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_HIGHLIGHT_COLOR;
}

const MAX_RECTS = 200;

/** `location_data.rects` (eski: `location.rects`) ni xavfsiz o'qiydi; noto'g'ri elementlar tashlab yuboriladi. */
export function getHighlightRects(a: Annotation): HighlightRect[] {
  const raw = (a.location_data ?? a.location)?.rects;
  if (!Array.isArray(raw)) return [];
  const out: HighlightRect[] = [];
  for (const r of raw) {
    if (!Array.isArray(r) || r.length !== 4) continue;
    if (!r.every((n) => typeof n === "number" && Number.isFinite(n))) continue;
    out.push(r as HighlightRect);
    if (out.length >= MAX_RECTS) break;
  }
  return out;
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Brauzer Selection'idan sahifa elementiga nisbatan ulush-koordinatalar oladi.
 * Sahifadan tashqaridagi (boshqa sahifa) bo'laklar tashlab yuboriladi; bir
 * qatordagi ko'plab kichik rect'lar bittaga birlashtiriladi.
 */
export function rectsFromSelection(sel: Selection, pageEl: HTMLElement): HighlightRect[] {
  if (sel.rangeCount === 0) return [];
  const page = pageEl.getBoundingClientRect();
  if (page.width <= 0 || page.height <= 0) return [];

  const merged: Array<{ l: number; t: number; r: number; b: number }> = [];
  for (let i = 0; i < sel.rangeCount; i++) {
    for (const cr of Array.from(sel.getRangeAt(i).getClientRects())) {
      if (cr.width < 1 || cr.height < 1) continue;
      // Sahifa chegarasiga kesish; umuman kesishmasa — boshqa sahifa
      const l = Math.max(cr.left, page.left);
      const r = Math.min(cr.right, page.right);
      const t = Math.max(cr.top, page.top);
      const b = Math.min(cr.bottom, page.bottom);
      if (r - l < 1 || b - t < 1) continue;

      const h = b - t;
      const line = merged.find((m) => Math.abs(m.t - t) < h * 0.5 && Math.abs(m.b - m.t - h) < h * 0.5);
      if (line) {
        line.l = Math.min(line.l, l);
        line.r = Math.max(line.r, r);
        line.t = Math.min(line.t, t);
        line.b = Math.max(line.b, b);
      } else {
        merged.push({ l, t, r, b });
      }
    }
  }

  return merged.slice(0, MAX_RECTS).map(
    (m) =>
      [
        round4((m.l - page.left) / page.width),
        round4((m.t - page.top) / page.height),
        round4((m.r - m.l) / page.width),
        round4((m.b - m.t) / page.height),
      ] as HighlightRect,
  );
}
