"use client";

import { useState, type FormEvent } from "react";
import { Button, Input, Textarea, cn, formatDate } from "@/components/ui";
import type { Annotation, SearchHit, TocEntry } from "@/lib/api";

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
  searchHits: SearchHit[] | null;
  searching: boolean;
  onSearch: (q: string) => void;

  annotations: Annotation[];
  onAddBookmark: () => void;
  onAddNote: (page: number, text: string) => Promise<void>;
  onUpdateNote: (a: Annotation, text: string) => Promise<void>;
  onDelete: (a: Annotation) => Promise<void>;
}

const TABS: Array<{ id: SidebarTab; label: string }> = [
  { id: "toc", label: "Mundarija" },
  { id: "search", label: "Qidiruv" },
  { id: "bookmarks", label: "Xatcho'plar" },
  { id: "highlights", label: "Belgilar" },
  { id: "notes", label: "Eslatmalar" },
];

export function ReaderSidebar(p: Props) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-surface md:w-80">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => p.onTab(t.id)}
              className={cn("rounded-md px-2 py-1 text-xs", p.tab === t.id ? "bg-bg text-text" : "text-muted hover:text-text")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={p.onClose} className="ml-2 text-muted hover:text-text md:hidden" aria-label="Yopish">
          ✕
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-sm">
        {p.tab === "toc" && <TocPanel toc={p.toc} available={p.tocAvailable} goToPage={p.goToPage} />}
        {p.tab === "search" && <SearchPanel {...p} />}
        {p.tab === "bookmarks" && (
          <AnnotationList
            items={p.annotations.filter((a) => a.type === "BOOKMARK")}
            empty="Xatcho'plar yo'q"
            goToPage={p.goToPage}
            onDelete={p.onDelete}
            header={
              <Button size="sm" variant="secondary" onClick={p.onAddBookmark} className="mb-3 w-full">
                {p.currentPage}-betga xatcho&apos;p qo&apos;shish
              </Button>
            }
          />
        )}
        {p.tab === "highlights" && (
          <AnnotationList
            items={p.annotations.filter((a) => a.type === "HIGHLIGHT")}
            empty="Belgilar yo'q. Sahifada matnni tanlab «Belgilash» tugmasini bosing."
            goToPage={p.goToPage}
            onDelete={p.onDelete}
          />
        )}
        {p.tab === "notes" && <NotesPanel {...p} />}
      </div>
    </aside>
  );
}

function TocPanel({ toc, available, goToPage }: { toc: TocEntry[] | null; available: boolean; goToPage: (p: number) => void }) {
  if (!available) return <p className="text-muted">Bu kitobda mundarija mavjud emas.</p>;
  if (!toc) return <p className="text-muted">Yuklanmoqda…</p>;
  if (toc.length === 0) return <p className="text-muted">Mundarija bo&apos;sh.</p>;
  const render = (items: TocEntry[], depth = 0) =>
    items.map((e, i) => (
      <div key={`${depth}-${i}`}>
        <button
          onClick={() => goToPage(e.page)}
          className="flex w-full items-start justify-between gap-2 rounded px-2 py-1 text-left hover:bg-bg"
          style={{ paddingLeft: 8 + (e.level ?? depth) * 12 }}
        >
          <span className="text-text">{e.title}</span>
          <span className="shrink-0 text-xs text-muted">{e.page}</span>
        </button>
        {e.children?.length ? render(e.children, depth + 1) : null}
      </div>
    ));
  return <div className="space-y-0.5">{render(toc)}</div>;
}

function SearchPanel({ searchAvailable, searchHits, searching, onSearch, goToPage }: Props) {
  const [q, setQ] = useState("");
  if (!searchAvailable) return <p className="text-muted">Bu kitobda matn qatlami yo&apos;q — qidiruv mavjud emas.</p>;
  return (
    <div className="space-y-3">
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (q.trim().length >= 2) onSearch(q.trim());
        }}
        className="flex gap-2"
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kitob ichida qidirish…" />
        <Button type="submit" size="md" loading={searching}>
          →
        </Button>
      </form>
      {searchHits && searchHits.length === 0 && <p className="text-muted">Hech narsa topilmadi.</p>}
      {searchHits?.map((h, i) => (
        <button key={i} onClick={() => goToPage(h.page)} className="block w-full rounded-lg border border-border p-2 text-left hover:bg-bg">
          <p className="mb-1 text-xs text-muted">{h.page}-bet</p>
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
  header,
}: {
  items: Annotation[];
  empty: string;
  goToPage: (p: number) => void;
  onDelete: (a: Annotation) => Promise<void>;
  header?: React.ReactNode;
}) {
  return (
    <div>
      {header}
      {items.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items
            .slice()
            .sort((a, b) => a.page - b.page)
            .map((a) => (
              <li key={a.id} className="rounded-lg border border-border p-2">
                <div className="flex items-center justify-between">
                  <button onClick={() => goToPage(a.page)} className="text-xs font-medium text-accent hover:underline">
                    {a.page}-bet
                  </button>
                  <button onClick={() => void onDelete(a)} className="text-xs text-muted hover:text-red-500">
                    O&apos;chirish
                  </button>
                </div>
                {a.text && <p className="mt-1 line-clamp-4 text-text">“{a.text}”</p>}
                {a.note && <p className="mt-1 text-muted">{a.note}</p>}
                <p className="mt-1 text-[11px] text-muted">{formatDate(a.created_at)}</p>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function NotesPanel({ annotations, currentPage, goToPage, onAddNote, onUpdateNote, onDelete }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Annotation | null>(null);
  const [editText, setEditText] = useState("");
  const notes = annotations.filter((a) => a.type === "NOTE").sort((a, b) => a.page - b.page);

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
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={`${currentPage}-bet uchun eslatma…`} />
        <Button type="submit" size="sm" loading={busy} className="w-full">
          Eslatma qo&apos;shish
        </Button>
      </form>
      {notes.length === 0 && <p className="text-muted">Eslatmalar yo&apos;q.</p>}
      <ul className="space-y-2">
        {notes.map((a) => (
          <li key={a.id} className="rounded-lg border border-border p-2">
            <div className="flex items-center justify-between">
              <button onClick={() => goToPage(a.page)} className="text-xs font-medium text-accent hover:underline">
                {a.page}-bet
              </button>
              <div className="flex gap-2 text-xs">
                <button
                  className="text-muted hover:text-text"
                  onClick={() => {
                    setEditing(a);
                    setEditText(a.note ?? a.text ?? "");
                  }}
                >
                  Tahrirlash
                </button>
                <button className="text-muted hover:text-red-500" onClick={() => void onDelete(a)}>
                  O&apos;chirish
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
                    Saqlash
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Bekor
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-text">{a.note ?? a.text}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
