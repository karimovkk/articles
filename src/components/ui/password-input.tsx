"use client";

/**
 * Parol maydoni: ko'z ikonkasi bilan ko'rsatish/yashirish (kursor joyi va fokus saqlanadi), Caps Lock ogohlantirishi.
 * `strength` — ro'yxatdan o'tishda kuch indikatori (0–4).
 */
import { forwardRef, useImperativeHandle, useRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "./cn";
import * as I from "./icons";
import { useT, type DictKey } from "@/i18n";

const STRENGTH_KEYS: DictKey[] = ["auth.strength.1", "auth.strength.2", "auth.strength.3", "auth.strength.4"];

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** Kuch indikatori (0–4); `undefined` — ko'rsatilmaydi */
  strength?: number;
  /** Chap ikonka (qulf) */
  withIcon?: boolean;
}

/** Oddiy kuch bahosi: uzunlik, harf registri, raqam, belgi → 0..4 */
export function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput({ className, strength, withIcon, onKeyDown, onKeyUp, onBlur, ...rest }, ref) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const [shown, setShown] = useState(false);
  const [caps, setCaps] = useState(false);

  function toggle() {
    const el = inputRef.current;
    const { selectionStart, selectionEnd } = el ?? {};
    setShown((v) => !v);
    // Fokus va kursor joyi turi almashgandan keyin ham saqlansin
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus({ preventScroll: true });
      if (selectionStart != null && selectionEnd != null) el.setSelectionRange(selectionStart, selectionEnd);
    });
  }
  const capsCheck = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.("CapsLock") ?? false);

  return (
    <div className="space-y-1.5">
      <div className={cn("input-wrap", className)}>
        {withIcon && <I.Lock size={16} />}
        <input
          ref={inputRef}
          type={shown ? "text" : "password"}
          className={cn("input pr-11", !withIcon && "!pl-3")}
          spellCheck={false}
          onKeyDown={(e) => {
            capsCheck(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            capsCheck(e);
            onKeyUp?.(e);
          }}
          onBlur={(e) => {
            setCaps(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        <button
          type="button"
          className="pw-eye"
          aria-label={shown ? t("auth.hidePassword") : t("auth.showPassword")}
          title={shown ? t("auth.hidePassword") : t("auth.showPassword")}
          aria-pressed={shown}
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()} // fokus input'da qolsin
          onClick={toggle}
          data-testid="pw-eye"
        >
          {shown ? <I.EyeOff size={17} /> : <I.Eye size={17} />}
        </button>
      </div>
      {caps && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-warning" data-testid="caps-warning">
          <I.AlertTriangle size={13} /> {t("auth.capsLock")}
        </p>
      )}
      {strength !== undefined && (
        <div className="flex items-center gap-2" data-testid="pw-strength" data-level={strength}>
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={cn("pw-bar", strength >= n && `lvl-${strength}`)} />
            ))}
          </div>
          <span className="w-16 text-right text-[11px] font-bold text-muted">{strength > 0 ? t(STRENGTH_KEYS[strength - 1]) : ""}</span>
        </div>
      )}
    </div>
  );
});
