"use client";

/**
 * 101: emoji qo'shiladigan matn maydoni — o'ng chetida 🙂 tugmasi, bosilganda Telegram'dagidek tanlagich:
 *  - barcha emojilar guruhlar bo'yicha (yuqorida guruh tugmalari, aylantirganda faol guruh belgilanadi);
 *  - qidiruv (inglizcha va ruscha kalit so'zlar — emojibase), "Yaqinda ishlatilganlar" (localStorage);
 *  - emoji kursor turgan joyga qo'yiladi, tanlagich ochiq qoladi (bir nechtasini ketma-ket qo'shish mumkin).
 * Ma'lumot (`emoji-data.json`, ~75 KB gzip) faqat tanlagich birinchi ochilganda yuklanadi.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type InputHTMLAttributes } from "react";
import { DropdownPanel, useOutsideClose } from "./dropdown";
import { cn } from "./cn";
import * as I from "./icons";
import { useT, type DictKey } from "@/i18n";

type EmojiGroup = { id: string; emojis: Array<[string, string]> };
let dataPromise: Promise<EmojiGroup[]> | null = null;
const loadEmojis = () => (dataPromise ??= import("@/lib/emoji/emoji-data.json").then((m) => (m.default as { groups: EmojiGroup[] }).groups));

const RECENT_KEY = "a365.emoji.recent";
const RECENT_MAX = 24;
const GROUP_ICON: Record<string, string> = {
  "smileys-emotion": "😀",
  "people-body": "👋",
  "animals-nature": "🐻",
  "food-drink": "🍔",
  "travel-places": "✈️",
  activities: "⚽",
  objects: "💡",
  symbols: "💕",
  flags: "🏁",
};

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}
function pushRecent(e: string): string[] {
  const next = [e, ...readRecent().filter((x) => x !== e)].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private rejim */
  }
  return next;
}

export function EmojiPicker({ onPick, testid = "emoji" }: { onPick: (emoji: string) => void; testid?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<EmojiGroup[] | null>(null);
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState("recent");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(open, [triggerRef, panelRef], close);

  useEffect(() => {
    if (!open) return;
    void loadEmojis().then(setGroups);
    requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
  }, [open]);

  // Qidiruv: har bir so'z biror kalit so'zning boshiga mos kelsin ("red hea" → ❤️)
  const found = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length || !groups) return null;
    const out: string[] = [];
    for (const g of groups)
      for (const [e, kw] of g.emojis) {
        const words = kw.split(" ");
        if (terms.every((tm) => words.some((w) => w.startsWith(tm)))) out.push(e);
      }
    return out;
  }, [q, groups]);

  const pick = (e: string) => {
    setRecent(pushRecent(e));
    onPick(e);
  };
  const jump = (id: string) => {
    setQ("");
    setActive(id);
    requestAnimationFrame(() => {
      const grid = gridRef.current;
      const sec = grid?.querySelector<HTMLElement>(`[data-group="${id}"]`);
      if (grid && sec) grid.scrollTo({ top: sec.offsetTop - grid.offsetTop });
    });
  };
  // Aylantirganda faol guruh
  const onScroll = () => {
    const grid = gridRef.current;
    if (!grid || found) return;
    let cur = "recent";
    grid.querySelectorAll<HTMLElement>("[data-group]").forEach((s) => {
      if (s.offsetTop - grid.offsetTop <= grid.scrollTop + 8) cur = s.dataset.group!;
    });
    setActive(cur);
  };

  const cell = (e: string, k: number | string) => (
    <button key={k} type="button" className="emoji-cell" onClick={() => pick(e)} title={e} data-testid={`${testid}-item`}>
      {e}
    </button>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cn("emoji-trigger", open && "on")}
        onClick={() => {
          if (!open) {
            setRecent(readRecent());
            setQ("");
            setActive("recent");
          }
          setOpen(!open);
        }}
        aria-label={t("emoji.open")}
        title={t("emoji.open")}
        aria-expanded={open}
        data-testid={`${testid}-btn`}
      >
        <I.Smile size={18} />
      </button>
      {open && (
        <DropdownPanel triggerRef={triggerRef} panelRef={panelRef} align="end" variant="plain" className="emoji-panel" role="dialog" aria-label={t("emoji.open")}>
          <div className="emoji-search">
            <I.Search size={15} />
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("emoji.search")} aria-label={t("emoji.search")} data-testid={`${testid}-search`} />
          </div>
          <div className="emoji-tabs" role="tablist">
            {recent.length > 0 && (
              <button type="button" role="tab" aria-selected={!found && active === "recent"} className={cn(!found && active === "recent" && "on")} onClick={() => jump("recent")} title={t("emoji.recent")}>
                <I.Clock size={16} />
              </button>
            )}
            {(groups ?? []).map((g) => (
              <button key={g.id} type="button" role="tab" aria-selected={!found && active === g.id} className={cn(!found && active === g.id && "on")} onClick={() => jump(g.id)} title={t(`emoji.group.${g.id}` as DictKey)} data-testid={`${testid}-tab`}>
                {GROUP_ICON[g.id] ?? "•"}
              </button>
            ))}
          </div>
          <div className="emoji-grid-wrap" ref={gridRef} onScroll={onScroll} data-testid={`${testid}-grid`}>
            {!groups ? (
              <div className="emoji-empty">
                <I.Loader size={18} className="animate-spin" />
              </div>
            ) : found ? (
              found.length ? (
                <div className="emoji-grid">{found.map(cell)}</div>
              ) : (
                <div className="emoji-empty">{t("emoji.empty")}</div>
              )
            ) : (
              <>
                {recent.length > 0 && (
                  <section data-group="recent">
                    <p className="emoji-head">{t("emoji.recent")}</p>
                    <div className="emoji-grid">{recent.map((e, k) => cell(e, `r${k}`))}</div>
                  </section>
                )}
                {groups.map((g) => (
                  <section key={g.id} data-group={g.id}>
                    <p className="emoji-head">{t(`emoji.group.${g.id}` as DictKey)}</p>
                    <div className="emoji-grid">{g.emojis.map(([e], k) => cell(e, k))}</div>
                  </section>
                ))}
              </>
            )}
          </div>
        </DropdownPanel>
      )}
    </>
  );
}

/** Emoji tugmali `Input`: emoji kursor joyiga qo'yiladi, so'ng kursor emojidan keyin */
export const EmojiInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: string; onValueChange: (v: string) => void; testid?: string }>(function EmojiInput(
  { value, onValueChange, className, testid, ...rest },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const insert = (e: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onValueChange(value.slice(0, start) + e + value.slice(end));
    requestAnimationFrame(() => el?.setSelectionRange(start + e.length, start + e.length));
  };
  return (
    <div className="input-wrap emoji-input">
      <input ref={inputRef} value={value} onChange={(e) => onValueChange(e.target.value)} className={cn("input", className)} {...rest} />
      <EmojiPicker onPick={insert} testid={testid} />
    </div>
  );
});
