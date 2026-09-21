"use client";

/**
 * `window.confirm()` o'rniga qo'lbola tasdiqlash oynasi.
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "...", message: "...", tone: "danger" })) { ... }
 *
 * `ConfirmProvider` root layout'da; oyna — `.modal` (Esc / tashqariga bosish = bekor).
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal } from "./modal";
import { useT } from "@/i18n";
import * as I from "./icons";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
const Ctx = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useT();
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    resolver.current?.(false); // oldingi ochiq so'rov bo'lsa — bekor
    setState(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setState(null);
  };

  const value = useMemo(() => confirm, [confirm]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal open={!!state} onClose={() => settle(false)} title={state?.title ?? ""} size="sm" data-testid="confirm-dialog" icon={state?.tone === "danger" ? <I.AlertTriangle size={20} /> : <I.Info size={20} />}>
        {state?.message && <p className="text-[14px] leading-relaxed text-text-2">{state.message}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn ghost" onClick={() => settle(false)} data-testid="confirm-cancel">
            {state?.cancelLabel ?? t("common.cancel")}
          </button>
          <button type="button" className={state?.tone === "danger" ? "btn danger" : "btn primary"} autoFocus onClick={() => settle(true)} data-testid="confirm-ok">
            {state?.confirmLabel ?? t("ui.confirm.ok")}
          </button>
        </div>
      </Modal>
    </Ctx.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const fn = useContext(Ctx);
  if (!fn) throw new Error("useConfirm: ConfirmProvider yo'q");
  return fn;
}
