"use client";

/**
 * 124: "O'qish qulayligi" (Aa) — bitta panelda: sahifa rangi (oq / sepiya / tun), diqqat rejimi va maqolada
 * taxminan qancha qoldi.
 */
import { useCallback, useId, useRef, useState } from "react";
import { cn } from "@/components/ui";
import { DropdownPanel, useOutsideClose } from "@/components/ui/dropdown";
import * as I from "@/components/ui/icons";
import { useT } from "@/i18n";
import { type ReadingSession } from "@/lib/reader/reading-session";

export type PageTone = "paper" | "sepia" | "night";

export function ComfortControl({ tone, onTone, onFocus, session, className }: { tone: PageTone; onTone: (t: PageTone) => void; onFocus: () => void; session: ReadingSession; className?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(open, [btnRef, panelRef], close);
  const id = useId();

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn("icon-btn plain comfort-btn max-[380px]:!size-8", open && "bg-surface-2 text-text", className)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={t("comfort.title")}
        title={t("comfort.title")}
        data-testid="comfort-open"
      >
        <I.TextSize size={19} />
      </button>
      {open && (
        <DropdownPanel triggerRef={btnRef} panelRef={panelRef} align="end" minWidth={290} variant="plain" className="music-panel" id={id} role="dialog" aria-label={t("comfort.title")}>
          <div className="music-body" data-testid="comfort-panel">
            <p className="music-section !mt-0">{t("comfort.tone")}</p>
            <div className="tone-pick" role="radiogroup" aria-label={t("comfort.tone")}>
              {(["paper", "sepia", "night"] as const).map((x) => (
                <button key={x} type="button" role="radio" aria-checked={tone === x} className={cn("tone-opt", `tone-${x}`, tone === x && "active")} onClick={() => onTone(x)} data-testid={`tone-${x}`}>
                  <span className="tone-swatch" aria-hidden>
                    Aa
                  </span>
                  {t(`comfort.tone.${x}`)}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn sm mt-3 w-full"
              onClick={() => {
                setOpen(false);
                onFocus();
              }}
              data-testid="focus-on"
            >
              <I.Focus size={15} />
              {t("comfort.focus")}
              <kbd className="kbd">F</kbd>
            </button>

            {session.minutesLeft !== null && (
              <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-text-2" data-testid="minutes-left">
                <I.Clock size={14} />
                {session.minutesLeft === 0 ? t("comfort.leftDone") : t("comfort.left", { n: session.minutesLeft })}
              </p>
            )}
          </div>
        </DropdownPanel>
      )}
    </>
  );
}
