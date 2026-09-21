"use client";

/** Qo'lbola Switch (checkbox o'rniga): `role="switch"`, `aria-checked`, Space/Enter. */
import type { ReactNode } from "react";
import { cn } from "./cn";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

export function Switch({ checked, onChange, disabled, label, description, className, id, "aria-label": ariaLabel, "data-testid": testId }: SwitchProps) {
  const control = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      data-testid={testId}
      disabled={disabled}
      className={cn("switch", disabled && "opacity-50", !label && className)}
      onClick={() => onChange(!checked)}
    />
  );
  if (!label) return control;
  return (
    <label className={cn("flex cursor-pointer items-center gap-3", disabled && "cursor-not-allowed", className)}>
      {control}
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-text">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
    </label>
  );
}
