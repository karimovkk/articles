"use client";

/** Modal oyna: portal, Esc / tashqariga bosish → yopish, body scroll bloklanadi, fokus birinchi maydonga. */
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n";
import { cn } from "./cn";
import * as I from "./icons";

export interface ModalProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  /** Pastki amallar (ixtiyoriy) */
  footer?: ReactNode;
  "data-testid"?: string;
}

export function Modal({ open, title, onClose, children, size = "md", icon, footer, "data-testid": testId }: ModalProps) {
  const { t } = useT();
  const id = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => {
      const box = boxRef.current;
      if (!box || box.contains(document.activeElement)) return;
      const first = box.querySelector<HTMLElement>("[autofocus], input, textarea, [role='combobox'], button:not([data-close])");
      (first ?? box).focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} role="dialog" aria-modal aria-labelledby={id} tabIndex={-1} className={cn("modal", size !== "md" && size)} data-testid={testId}>
        <div className="modal-head">
          {icon && <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-2">{icon}</span>}
          <h2 id={id} className="modal-title">
            {title}
          </h2>
          <button type="button" className="icon-btn plain sm" aria-label={t("common.close")} title={t("common.close")} onClick={onClose} data-close>
            <I.X size={17} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
