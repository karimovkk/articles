"use client";

/**
 * Qo'lbola Select (native `<select>` o'rniga): portal panel, klaviatura (↑ ↓ Home End Enter Esc, harf bilan sakrash),
 * 6+ variantda qidiruv, ARIA combobox/listbox. Qiymat — string (bo'sh string = "tanlanmagan").
 *
 *   <Select value={status} onChange={setStatus} options={[{ value: "", label: "Barchasi" }, …]} aria-label="Holat" />
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";
import { DropdownPanel, useOutsideClose } from "./dropdown";
import * as I from "./icons";
import { useT } from "@/i18n";

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  /** Kichik izoh (ikkinchi qator) */
  description?: string;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface SelectProps<V extends string = string> {
  value: V;
  onChange: (value: V) => void;
  options: ReadonlyArray<SelectOption<V>>;
  placeholder?: string;
  /** Qidiruv: `true`/`false` yoki avtomatik (≥ 6 variant) */
  searchable?: boolean;
  disabled?: boolean;
  size?: "md" | "sm";
  className?: string;
  /** Panel kengligi trigger'ga teng (default) yoki kontentga qarab */
  matchWidth?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** e2e uchun: trigger `data-testid` */
  "data-testid"?: string;
}

const SEARCH_THRESHOLD = 6;

export function Select<V extends string = string>({
  value,
  onChange,
  options,
  placeholder,
  searchable,
  disabled,
  size = "md",
  className,
  matchWidth = true,
  id,
  name,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "data-testid": testId,
}: SelectProps<V>) {
  const { t } = useT();
  const uid = useId();
  const listId = `${uid}-list`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const typeahead = useRef({ buf: "", at: 0 });

  const hasSearch = searchable ?? options.length >= SEARCH_THRESHOLD;
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q));
  }, [options, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(-1);
  }, []);
  // Ochilganda faol element — tanlangan variant (yoki birinchi mavjud)
  function openPanel() {
    const idx = options.findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : options.findIndex((o) => !o.disabled));
    setOpen(true);
  }
  useOutsideClose(open, [triggerRef, panelRef], close);

  // Qidiruv bo'lsa — ochilganda input'ga fokus
  useEffect(() => {
    if (!open || !hasSearch) return;
    const raf = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, hasSearch]);

  // Faol variant ko'rinadigan bo'lsin
  useEffect(() => {
    if (!open || active < 0) return;
    const el = panelRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function commit(opt: SelectOption<V>) {
    if (opt.disabled) return;
    onChange(opt.value);
    close();
    triggerRef.current?.focus();
  }

  function move(delta: number) {
    if (!filtered.length) return;
    let i = active;
    for (let n = 0; n < filtered.length; n++) {
      i = (i + delta + filtered.length) % filtered.length;
      if (!filtered[i].disabled) break;
    }
    setActive(i);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (disabled) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) openPanel();
        else move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) openPanel();
        else move(-1);
        break;
      case "Home":
        if (open) {
          e.preventDefault();
          setActive(filtered.findIndex((o) => !o.disabled));
        }
        break;
      case "End":
        if (open) {
          e.preventDefault();
          for (let i = filtered.length - 1; i >= 0; i--) if (!filtered[i].disabled) return setActive(i);
        }
        break;
      case "Enter":
      case " ":
        if (e.key === " " && hasSearch && open) return; // qidiruvda bo'sh joy — matn
        e.preventDefault();
        if (!open) openPanel();
        else if (active >= 0 && filtered[active]) commit(filtered[active]);
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          close();
        }
        break;
      case "Tab":
        if (open) close();
        break;
      default:
        // Harf bilan sakrash (qidiruvsiz rejimda)
        if (!hasSearch && e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
          const now = Date.now();
          const st = typeahead.current;
          st.buf = now - st.at < 700 ? st.buf + e.key.toLowerCase() : e.key.toLowerCase();
          st.at = now;
          const start = open ? active + 1 : 0;
          const list = open ? filtered : options;
          for (let n = 0; n < list.length; n++) {
            const i = (start + n) % list.length;
            if (!list[i].disabled && list[i].label.toLowerCase().startsWith(st.buf)) {
              if (open) setActive(i);
              else onChange(list[i].value);
              break;
            }
          }
        }
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-activedescendant={open && active >= 0 ? `${listId}-opt-${active}` : undefined}
        data-testid={testId}
        data-value={value}
        disabled={disabled}
        className={cn("select-trigger", size === "sm" && "sm", open && "open", className)}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={onKeyDown}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            {selected.icon}
            <span className="truncate">{selected.label}</span>
          </span>
        ) : (
          <span className="ph truncate">{placeholder ?? t("ui.select.placeholder")}</span>
        )}
        <I.ChevronDown size={16} />
      </button>
      {name && <input type="hidden" name={name} value={value} />}
      {open && (
        <DropdownPanel triggerRef={triggerRef} panelRef={panelRef} matchWidth={matchWidth} minWidth={180} id={listId} role="listbox" aria-label={ariaLabel} style={{ display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
          {hasSearch && (
            <div className="select-search">
              <div>
                <I.Search size={15} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder={t("common.search")}
                  aria-label={t("common.search")}
                  autoComplete="off"
                />
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-1.5">
            {filtered.length === 0 && <div className="menu-empty">{t("ui.select.noMatches")}</div>}
            {filtered.map((o, i) => {
              const isSel = o.value === value;
              return (
                <div
                  key={o.value}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={isSel}
                  aria-disabled={o.disabled || undefined}
                  data-index={i}
                  data-value={o.value}
                  className={cn("menu-item", isSel && "selected", i === active && "focused", o.disabled && "opacity-50")}
                  onMouseEnter={() => !o.disabled && setActive(i)}
                  onMouseDown={(e) => e.preventDefault()} // fokus trigger/qidiruvda qolsin
                  onClick={() => commit(o)}
                >
                  {o.icon}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.description && <span className="block truncate text-[11.5px] font-medium text-muted">{o.description}</span>}
                  </span>
                  {isSel && <I.Check size={15} />}
                </div>
              );
            })}
          </div>
        </DropdownPanel>
      )}
    </>
  );
}
