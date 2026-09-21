"use client";

/**
 * Bazaviy UI to'plami — `design.css` sinflari ustida (tokenlar: src/app/design.css).
 * Qo'lbola boshqaruv elementlari alohida fayllarda va shu yerdan re-eksport qilinadi:
 * Select, DatePicker, Menu, Switch, ConfirmDialog (useConfirm), ikonkalar (`icons.tsx`).
 */
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import Link from "next/link";
import { formatDateTime, useT } from "@/i18n";
import { cn } from "./cn";
import * as I from "./icons";

export { cn } from "./cn";
export { Select, type SelectOption, type SelectProps } from "./select";
export { DatePicker, toISODate, parseISODate, formatISODate } from "./date-picker";
export { Menu, MenuItem, MenuSep, MenuLabel } from "./menu";
export { Switch } from "./switch";
export { ConfirmProvider, useConfirm, type ConfirmOptions } from "./confirm";
export { Modal, type ModalProps } from "./modal";

/* ---------- Button ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft" | "dark" | "danger-ghost";
type Size = "sm" | "md" | "lg";

const variantCls: Record<Variant, string> = {
  primary: "primary",
  secondary: "",
  ghost: "ghost",
  danger: "danger",
  soft: "soft",
  dark: "dark",
  "danger-ghost": "danger-ghost",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

/** Tugma sinflari — `<Link>`/`<a>` ni tugma ko'rinishida chizish uchun (a ichida button yaroqsiz HTML). */
export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn("btn", variantCls[variant], size !== "md" && size, className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
});

/** Faqat ikonka tugma (`.icon-btn`); `label` — aria-label (majburiy). */
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md";
  variant?: "default" | "plain" | "danger";
  badge?: number | string;
}
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, size = "md", variant = "default", badge, className, children, type = "button", ...rest }, ref) {
  return (
    <button ref={ref} type={type} aria-label={label} title={label} className={cn("icon-btn", size === "sm" && "sm", variant !== "default" && variant, className)} {...rest}>
      {children}
      {badge !== undefined && badge !== 0 && badge !== "" && <span className="dot">{badge}</span>}
    </button>
  );
});

/* ---------- Inputs ---------- */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { inputSize?: "sm" | "md" }>(function Input({ className, inputSize, ...rest }, ref) {
  return <input ref={ref} className={cn("input", inputSize === "sm" && "sm", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn("textarea", className)} {...rest} />;
});

/** Qidiruv input'i (ikonka bilan) */
export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function SearchInput({ className, ...rest }, ref) {
  return (
    <div className={cn("input-wrap", className)}>
      <I.Search size={16} />
      <input ref={ref} type="search" className="input" {...rest} />
    </div>
  );
});

/** Forma maydoni: yorliq + boshqaruv elementi (`<label>` — Input/Textarea bilan bevosita, qo'lbola Select/DatePicker'da yorliq bosilsa trigger ochiladi). */
export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn("field", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

/* ---------- Misc ---------- */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className ?? "size-5")} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Card({ className, children, title, actions, padded }: { className?: string; children: ReactNode; title?: ReactNode; actions?: ReactNode; padded?: boolean }) {
  if (title === undefined && !actions) return <div className={cn("card", padded && "card-body", className)}>{children}</div>;
  return (
    <div className={cn("card", className)}>
      <div className="card-header">
        <div className="card-title min-w-0 flex-1 truncate">{title}</div>
        {actions}
      </div>
      <div className={padded === false ? undefined : "card-body"}>{children}</div>
    </div>
  );
}

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

export function Badge({ children, tone = "neutral", dot, className }: { children: ReactNode; tone?: Tone; dot?: boolean; className?: string }) {
  return (
    <span className={cn("chip", tone !== "neutral" && tone, className)}>
      {dot && <span className="chip-dot" />}
      {children}
    </span>
  );
}

export function statusTone(status?: string | null): Tone {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE":
    case "READY":
    case "APPROVED":
      return "success";
    case "PROCESSING":
    case "UPLOADING":
    case "INACTIVE":
    case "DRAFT":
    case "PENDING":
    case "AWAITING_REVIEW":
      return "warning";
    case "BLOCKED":
    case "FAILED":
    case "REVOKED":
    case "REJECTED":
      return "danger";
    default:
      return "neutral";
  }
}

export function Alert({ children, tone = "danger", className }: { children: ReactNode; tone?: "danger" | "info" | "success" | "warning"; className?: string }) {
  const Icon = tone === "danger" ? I.XCircle : tone === "success" ? I.CheckCircle : tone === "warning" ? I.AlertTriangle : I.Info;
  return (
    <div className={cn("alert", tone, className)} role={tone === "danger" ? "alert" : "status"}>
      <Icon size={17} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function EmptyState({ title, description, action, icon, className }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn("empty", className)}>
      <div className="empty-icon">{icon ?? <I.Inbox size={22} />}</div>
      <p className="title">{title}</p>
      {description && <p className="desc">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Pagination({ page, pages, total, onChange }: { page: number; pages: number; total?: number; onChange: (p: number) => void }) {
  const { t } = useT();
  if (pages <= 1 && total === undefined) return null;
  return (
    <div className="pager">
      <span>{total !== undefined ? `${t("common.total")}: ${total}` : ""}</span>
      <div className="flex items-center gap-2">
        <IconButton size="sm" label={t("common.prev")} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <I.ChevronLeft size={16} />
        </IconButton>
        <span className="num tabular-nums">
          {page} / {Math.max(pages, 1)}
        </span>
        <IconButton size="sm" label={t("common.next")} disabled={page >= pages} onClick={() => onChange(page + 1)}>
          <I.ChevronRight size={16} />
        </IconButton>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, eyebrow, actions, icon, className }: { title: ReactNode; description?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn("page-head", className)}>
      {icon && <div className="page-icon">{icon}</div>}
      <div>
        {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-sub">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, icon, foot, href, className }: { label: ReactNode; value: ReactNode; icon?: ReactNode; foot?: ReactNode; href?: string; className?: string }) {
  const body = (
    <>
      <div className="stat-head">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <div className="stat-value">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cn("stat", className)}>
        {body}
      </Link>
    );
  }
  return <div className={cn("stat", className)}>{body}</div>;
}

/* ---------- Format ---------- */
export function formatDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return formatDateTime(d);
}

export function formatBytes(n?: number | null) {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}

/** Ism bosh harflari (avatar uchun) */
export function initials(name?: string | null, fallback = "?") {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function Avatar({ name, size, tone, className }: { name?: string | null; size?: "sm" | "md" | "lg"; tone?: "accent"; className?: string }) {
  return (
    <span className={cn("avatar", size && size !== "md" && size, tone, className)} aria-hidden>
      {initials(name)}
    </span>
  );
}
