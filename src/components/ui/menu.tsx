"use client";

/**
 * Qo'lbola Menu (dropdown amallar ro'yxati): trigger — istalgan element (render prop),
 * panel — portal, klaviatura (↑ ↓ Home End Enter Esc), `role="menu"/"menuitem"`.
 *
 *   <Menu trigger={(p) => <button {...p} className="icon-btn"><I.MoreHorizontal/></button>} align="end">
 *     <MenuItem icon={<I.Pencil/>} onSelect={...}>Tahrirlash</MenuItem>
 *     <MenuSep />
 *     <MenuItem tone="danger" onSelect={...}>O'chirish</MenuItem>
 *   </Menu>
 */
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { cn } from "./cn";
import { DropdownPanel, useOutsideClose, type Align } from "./dropdown";

export interface MenuTriggerProps {
  ref: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
}

function menuItems(panel: HTMLElement | null) {
  return Array.from(panel?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? []);
}

interface MenuCtx {
  close: () => void;
}
const Ctx = createContext<MenuCtx | null>(null);

export interface MenuProps {
  trigger: (props: MenuTriggerProps) => ReactNode;
  children: ReactNode;
  align?: Align;
  minWidth?: number;
  className?: string;
  "aria-label"?: string;
}

export function Menu({ trigger, children, align = "end", minWidth = 200, className, "aria-label": ariaLabel }: MenuProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(open, [triggerRef, panelRef], close);

  // Ochilganda birinchi elementga fokus
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => menuItems(panelRef.current)[0]?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  function onPanelKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const list = menuItems(panelRef.current);
    if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    const focus = (n: number) => list[(n + list.length) % list.length]?.focus();
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focus(i + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focus(i - 1);
        break;
      case "Home":
        e.preventDefault();
        focus(0);
        break;
      case "End":
        e.preventDefault();
        focus(list.length - 1);
        break;
      case "Tab":
        close();
        break;
    }
  }

  return (
    <Ctx.Provider value={{ close }}>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((v) => !v),
        onKeyDown: (e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        },
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? id : undefined,
      })}
      {open && (
        <DropdownPanel triggerRef={triggerRef} panelRef={panelRef} align={align} minWidth={minWidth} id={id} role="menu" aria-label={ariaLabel} className={className} onKeyDown={onPanelKey}>
          {children}
        </DropdownPanel>
      )}
    </Ctx.Provider>
  );
}

export interface MenuItemProps {
  children: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  /** Havola sifatida */
  href?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  selected?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function MenuItem({ children, icon, onSelect, href, tone = "default", disabled, selected, className, "data-testid": testId }: MenuItemProps) {
  const ctx = useContext(Ctx);
  const cls = cn("menu-item", tone === "danger" && "danger", selected && "selected", className);
  const handle = () => {
    if (disabled) return;
    onSelect?.();
    ctx?.close();
  };
  const role = selected === undefined ? "menuitem" : "menuitemradio";
  if (href && !disabled) {
    // Enter — havolaning o'z xatti-harakati; bo'sh joy — click
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        (e.currentTarget as HTMLElement).click();
      }
    };
    return (
      <Link href={href} role={role} aria-checked={selected} tabIndex={-1} className={cls} onClick={handle} onKeyDown={onKey} data-testid={testId}>
        {icon}
        <span className="min-w-0 flex-1 truncate">{children}</span>
      </Link>
    );
  }
  return (
    <button type="button" role={role} aria-checked={selected} tabIndex={-1} className={cls} disabled={disabled} onClick={handle} data-testid={testId}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

export function MenuSep() {
  return <div className="menu-sep" role="separator" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="menu-label">{children}</div>;
}
