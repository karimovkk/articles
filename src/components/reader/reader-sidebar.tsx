"use client";

import { useState, type FormEvent } from "react";
import { Button, Spinner, Textarea, cn, formatDate } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { useDebouncedCallback } from "@/lib/use-debounce";
import type { Annotation, SearchMatch, TocEntry } from "@/lib/api";
import { HIGHLIGHT_COLORS, getHighlightRects, normalizeColor } from "@/lib/reader/highlights";
import { useT, type DictKey } from "@/i18n";

export type SidebarTab = "toc" | "search" | "bookmarks" | "notes" | "highlights";

interface Props {
  tab: SidebarTab;
  onTab: (t: SidebarTab) => void;
  onClose: () => void;
  goToPage: (p: number) => void;
  currentPage: number;

  toc: TocEntry[] | null;
  tocAvailable: boolean;

  searchAvailable: boolean;
  searchHits: SearchMatch[] | null;
  searching: boolean;
  onSearch: (q: string) => void;

  annotations: Annotation[];
  onAddBookmark: () => void;
  onAddNote: (page: number, text: string) => Promise<void>;
  onUpdateNote: (a: Annotation, text: string) => Promise<void>;
  onDelete: (a: Annotation) => Promise<void>;
  onChangeColor: (a: Annotation, color: string) => Promise<void>;
}

const TABS: Array<{ id: SidebarTab; label: DictKey }> = [
  { id: "toc", label: "reader.tab.toc" },
  { id: "search", label: "reader.tab.search" },
  { id: "bookmarks", label: "reader.tab.bookmarks" },
  { id: "highlights", label: "reader.tab.highlights" },
  { id: "notes", label: "reader.tab.notes" },
];

export function ReaderSidebar(p: Props) {
  const { t } = useT();
  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-surface md:w-80">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="tabs wrap" role="tablist">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={p.tab === tab.id} onClick={() => p.onTab(tab.id)} className={cn("tab !h-7 !px-2.5 !text-xs", p.tab === tab.id && "active")}>
              {t(tab.label)}
            </button>
          ))}
        </div>
        <button type="button" onClick={p.onClose} className="icon-btn plain sm md:hidden" aria-label={t("common.close")}>
          <I.X size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-sm">
        {p.tab === "toc" && <TocPanel toc={p.toc} available={p.tocAvailable} goToPage={p.goToPage} />}
        {p.tab === "search" && <SearchPanel {...p} />}
        {p.tab === "bookmarks" && (
          <AnnotationList
            items={p.annotations.filter((a) => a.type === "BOOKMARK")}
            empty={t("reader.noBookmarks")}
            goToPage={p.goToPage}
            onDelete={p.onDelete}
            header={
              <Button size="sm" variant="secondary" onClick={p.onAddBookmark} className="mb-3 w-full">
                {t("reader.addBookmark", { n: p.currentPage })}
              </Button>
            }
          />
        )}
        {p.tab === "highlights" && (
          <AnnotationList
            items={p.annotations.filter((a) => a.type === "HIGHLIGHT")}
            empty={t("reader.noHighlights")}
            goToPage={p.goToPage}
            onDelete={p.onDelete}
            onChangeColor={p.onChangeColor}
          />
        )}
        {p.tab === "notes" && <NotesPanel {...p} />}
      </div>
    </aside>
  );
}

function TocPanel({ toc, available, goToPage }: { toc: TocEntry[] | null; available: boolean; goToPage: (p: number) => void }) {
  const { t } = useT();
  if (!available) return <p className="text-muted">{t("reader.tocUnavailable")}</p>;
  if (!toc) return <p className="text-muted">{t("common.loading")}</p>;
  if (toc.length === 0) return <p className="text-muted">{t("reader.tocEmpty")}</p>;
  // Tekis ro'yxat: `level` (1 = bo'lim, 2 = kichik bo'lim, …) chekinish bilan ko'rsatiladi
  return (
    <div className="space-y-0.5">
      {toc.map((e, i) => (
        <button
          key={i}
          onClick={() => e.page !== null && goToPage(e.page)}
          disabled={e.page === null}
          className="flex w-full items-start justify-between gap-2 rounded px-2 py-1 text-left hover:bg-bg disabled:opacity-60"
          style={{ paddingLeft: 8 + Math.max(0, (e.level ?? 1) - 1) * 12 }}
        >
          <span className="text-text">{e.title}</span>
          {e.page !== null && <span className="shrink-0 text-xs text-muted">{e.page}</span>}
        </button>
      ))}
    </div>
  );
}

function SearchPanel({ searchAvailable, searchHits, searching, onSearch, goToPage }: Props) {
  const { t } = useT();
  const [q, setQ] = useState("");
  // Jonli qidiruv: ≥2 belgi yozilgach 350 ms dan keyin; Enter — darhol
  const live = useDebouncedCallback((v: string) => onSearch(v.length >= 2 ? v : ""), 350);
  if (!searchAvailable) return <p className="text-muted">{t("reader.searchUnavailable")}</p>;
  return (
    <div className="space-y-3">
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          live.cancel();
          if (q.trim().length >= 2) onSearch(q.trim());
        }}
        className="input-wrap"
        role="search"
      >
        <I.Search size={16} />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            live.call(e.target.value.trim());
          }}
          placeholder={t("reader.searchPlaceholder")}
          className="input"
          aria-label={t("common.search")}
        />
        {searching && <Spinner className="absolute right-3 size-4 text-muted" />}
      </form>
      {searchHits && searchHits.length === 0 && <p className="text-muted">{t("reader.noResults")}</p>}
      {searchHits?.map((h, i) => (
        <button key={i} onClick={() => goToPage(h.page)} className="block w-full rounded-lg border border-border p-2 text-left hover:bg-bg">
          <p className="mb-1 text-xs text-muted">{t("common.pageN", { n: h.page })}</p>
          <p className="line-clamp-3 text-text [&_b]:bg-yellow-300/60 [&_mark]:bg-yellow-300/60" dangerouslySetInnerHTML={{ __html: sanitizeSnippet(h.snippet) }} />
        </button>
      ))}
    </div>
  );
}

/** Backend snippet'i <b>/<mark> bilan kelishi mumkin — faqat shu teglar qoldiriladi. */
function sanitizeSnippet(s: string): string {
  const escaped = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(/&lt;(\/?)(b|mark)&gt;/g, "<$1$2>");
}

function AnnotationList({
  items,
  empty,
  goToPage,
  onDelete,
  onChangeColor,
  header,
}: {
  items: Annotation[];
  empty: string;
  goToPage: (p: number) => void;
  onDelete: (a: Annotation) => Promise<void>;
  /** Berilsa (highlight'lar) — rang nuqtasi va palitra ko'rsatiladi */
  onChangeColor?: (a: Annotation, color: string) => Promise<void>;
  header?: React.ReactNode;
}) {
  const { t } = useT();
  const [paletteFor, setPaletteFor] = useState<string | null>(null);
  return (
    <div>
      {header}
      {items.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items
            .slice()
            .sort((a, b) => (a.page ?? 0) - (b.page ?? 0))
            .map((a) => {
              const color = normalizeColor(a.color);
              const hasRects = getHighlightRects(a).length > 0;
              const pageNo = a.page ?? 1;
              return (
                <li key={a.id} className="rounded-lg border border-border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {onChangeColor && (
                        <button
                          type="button"
                          onClick={() => setPaletteFor((id) => (id === a.id ? null : a.id))}
                          className="size-4 shrink-0 rounded-full border border-black/10"
                          style={{ background: color }}
                          title={t("reader.changeColor")}
                          aria-label={t("reader.changeColor")}
                        />
                      )}
                      <button onClick={() => goToPage(pageNo)} className="text-xs font-medium font-bold text-accent-ink hover:underline">
                        {t("common.pageN", { n: pageNo })}
                      </button>
                      {onChangeColor && !hasRects && (
                        <span className="text-[10px] text-muted" title={t("reader.noPositionHint")}>
                          {t("reader.noPosition")}
                        </span>
                      )}
                    </div>
                    <button onClick={() => void onDelete(a)} className="text-xs text-muted hover:text-red-500">
                      {t("common.delete")}
                    </button>
                  </div>
                  {onChangeColor && paletteFor === a.id && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {HIGHLIGHT_COLORS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          title={t(c.labelKey)}
                          aria-label={t(c.labelKey)}
                          onClick={() => {
                            setPaletteFor(null);
                            void onChangeColor(a, c.hex);
                          }}
                          className={cn("size-5 rounded-full border-2 hover:scale-110", c.hex === color ? "border-text" : "border-transparent")}
                          style={{ background: c.hex }}
                        />
                      ))}
                    </div>
                  )}
                  {a.selected_text && (
                    <p className="mt-1 line-clamp-4 text-text">
                      {onChangeColor ? (
                        <mark className="rounded-sm px-0.5 text-inherit" style={{ background: `${color}80` }}>
                          {a.selected_text}
                        </mark>
                      ) : (
                        <>“{a.selected_text}”</>
                      )}
                    </p>
                  )}
                  {a.note_text && <p className="mt-1 text-muted">{a.note_text}</p>}
                  <p className="mt-1 text-[11px] text-muted">{formatDate(a.created_at)}</p>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}

function NotesPanel({ annotations, currentPage, goToPage, onAddNote, onUpdateNote, onDelete }: Props) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Annotation | null>(null);
  const [editText, setEditText] = useState("");
  const notes = annotations.filter((a) => a.type === "NOTE").sort((a, b) => (a.page ?? 0) - (b.page ?? 0));

  return (
    <div className="space-y-3">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setBusy(true);
          try {
            await onAddNote(currentPage, text.trim());
            setText("");
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-2"
      >
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("reader.notePlaceholder", { n: currentPage })} />
        <Button type="submit" size="sm" loading={busy} className="w-full">
          {t("reader.addNote")}
        </Button>
      </form>
      {notes.length === 0 && <p className="text-muted">{t("reader.noNotes")}</p>}
      <ul className="space-y-2">
        {notes.map((a) => (
          <li key={a.id} className="rounded-lg border border-border p-2">
            <div className="flex items-center justify-between">
              <button onClick={() => goToPage(a.page ?? 1)} className="text-xs font-medium font-bold text-accent-ink hover:underline">
                {t("common.pageN", { n: a.page ?? 1 })}
              </button>
              <div className="flex gap-2 text-xs">
                <button
                  className="text-muted hover:text-text"
                  onClick={() => {
                    setEditing(a);
                    setEditText(a.note_text ?? a.selected_text ?? "");
                  }}
                >
                  {t("common.edit")}
                </button>
                <button className="text-muted hover:text-red-500" onClick={() => void onDelete(a)}>
                  {t("common.delete")}
                </button>
              </div>
            </div>
            {editing?.id === a.id ? (
              <div className="mt-2 space-y-2">
                <Textarea rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      await onUpdateNote(a, editText.trim());
                      setEditing(null);
                    }}
                  >
                    {t("common.save")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-text">{a.note_text ?? a.selected_text}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
