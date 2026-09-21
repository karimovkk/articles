"use client";

/**
 * Ochiladigan panellar uchun umumiy asos (Select, DatePicker, Menu):
 *  - `DropdownPanel` — `document.body` ga portal; trigger ostida/ustida `position: fixed` joylashuv
 *    (viewport'ga sig'masa yuqoriga ochiladi), scroll/resize/o'lcham o'zgarishida DOM'ga to'g'ridan-to'g'ri yoziladi
 *    (React holatisiz — qayta render yo'q);
 *  - `useOutsideClose` — tashqariga bosish / Esc → yopish.
 * Brauzerning native popover'lari ishlatilmaydi — hammasi qo'lbola.
 */
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, type CSSProperties, type ReactNode, type RefObject } from "react";
import { cn } from "./cn";

export type Align = "start" | "end";

export interface DropdownPos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "bottom" | "top";
}

const GAP = 6;
const VIEWPORT_PAD = 8;

export function computePosition(rect: DOMRect, opts: { align?: Align; minWidth?: number; matchWidth?: boolean; panelHeight?: number; panelWidth?: number }): DropdownPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = opts.matchWidth ? Math.max(rect.width, opts.minWidth ?? 0) : Math.max(opts.minWidth ?? 0, opts.panelWidth ?? rect.width);
  const below = vh - rect.bottom - GAP - VIEWPORT_PAD;
  const above = rect.top - GAP - VIEWPORT_PAD;
  const wanted = opts.panelHeight ?? 320;
  const placement: DropdownPos["placement"] = below >= Math.min(wanted, 200) || below >= above ? "bottom" : "top";
  const maxHeight = Math.max(120, Math.floor(placement === "bottom" ? below : above));
  let left = opts.align === "end" ? rect.right - width : rect.left;
  left = Math.max(VIEWPORT_PAD, Math.min(left, vw - width - VIEWPORT_PAD));
  const top = placement === "bottom" ? rect.bottom + GAP : Math.max(VIEWPORT_PAD, rect.top - GAP - Math.min(wanted, maxHeight));
  return { top, left, width, maxHeight, placement };
}

/** Tashqariga bosish (pointerdown) yoki Esc → `onClose`. Trigger va panel ichidagi bosishlar hisobga olinmaydi. */
export function useOutsideClose(open: boolean, refs: Array<RefObject<HTMLElement | null>>, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (refs.some((r) => r.current?.contains(target))) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
    };
    // refs massivi har render'da yangi — tarkibi barqaror
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);
}

export interface DropdownPanelProps {
  triggerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  align?: Align;
  minWidth?: number;
  /** Panel kengligi trigger'ga teng */
  matchWidth?: boolean;
  className?: string;
  style?: CSSProperties;
  role?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  /** default: `.menu` — ro'yxat; `plain` — o'z bezagi bilan (kalendar) */
  variant?: "menu" | "plain";
}

export function DropdownPanel({ triggerRef, panelRef, children, align, minWidth, matchWidth, className, style, variant = "menu", ...aria }: DropdownPanelProps) {
  // Joylashuv: layout effect'da DOM'ga yoziladi (birinchi paint'gacha), keyin scroll/resize/ResizeObserver ergashadi
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    if (!panel || !trigger) return;
    const apply = () => {
      const p = computePosition(trigger.getBoundingClientRect(), { align, minWidth, matchWidth, panelHeight: panel.scrollHeight, panelWidth: panel.offsetWidth });
      panel.style.top = `${p.top}px`;
      panel.style.left = `${p.left}px`;
      panel.style.width = matchWidth ? `${p.width}px` : "";
      panel.style.minWidth = minWidth ? `${minWidth}px` : "";
      panel.style.maxHeight = `${p.maxHeight}px`;
      panel.style.visibility = "";
      panel.dataset.placement = p.placement;
    };
    apply();
    const raf = requestAnimationFrame(apply);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(panel);
    window.addEventListener("resize", apply);
    window.addEventListener("scroll", apply, true);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", apply);
      window.removeEventListener("scroll", apply, true);
    };
  }, [triggerRef, panelRef, align, minWidth, matchWidth]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panelRef}
      {...aria}
      className={cn(variant === "menu" && "menu", "dropdown-panel", className)}
      style={{ position: "fixed", zIndex: 5500, top: 0, left: 0, overflowY: "auto", visibility: "hidden", ...style }}
    >
      {children}
    </div>,
    document.body,
  );
}
