"use client";

/**
 * Lug'at sahifasi (33.4–33.5): PDF'lardan qo'shilgan so'zlar — statistika, qidiruv (so'z/tarjima), kitob va holat
 * filtri, saralash; kartada talaffuz, "o'rgandim", tahrirlash, o'chirish va "PDF'da ochish" (o'sha bet + so'z
 * bo'rttiriladi). "Takrorlash" — flashcard rejimi. CSV eksport. Ma'lumot: `lib/api/vocabulary.ts`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Badge, EmptyState, IconButton, PageHeader, SearchInput, Select, Spinner, buttonClass, cn, formatDate, useConfirm } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { errorMessage, normalizeWord, vocabularyApi, VOCAB_EVENT, type VocabEntry } from "@/lib/api";
import { VocabDialog, type VocabFormValues } from "@/components/vocabulary/vocab-dialog";
import { VocabCards } from "@/components/vocabulary/vocab-cards";
import { canSpeak, speak } from "@/components/vocabulary/speak";
import { pdfHref } from "@/components/vocabulary/links";
import { useAuth } from "@/providers/auth-provider";
import { useT } from "@/i18n";

type Status = "all" | "learning" | "learned";
type Sort = "new" | "old" | "az";
type View = "list" | "cards";

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Kontekstda so'zni ajratib ko'rsatish (katta-kichik harfsiz) */
function Context({ text, word }: { text: string; word: string }) {
  const i = text.toLocaleLowerCase().indexOf(word.toLocaleLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + word.length)}</mark>
      {text.slice(i + word.length)}
    </>
  );
}

function toCsv(rows: VocabEntry[], head: string[]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [head.join(",")];
  for (const r of rows) lines.push([r.word, r.translation, r.context, r.bookTitle, r.articleTitle, r.page, r.learned ? "1" : "0", r.createdAt.slice(0, 10)].map(esc).join(","));
  // BOM — Excel o'zbek/kirill harflarini to'g'ri ochsin
  return "﻿" + lines.join("\r\n");
}

export default function VocabularyPage() {
  const { t } = useT();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [items, setItems] = useState<VocabEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [search, setSearch] = useState("");
  const [book, setBook] = useState("all");
  const [status, setStatus] = useState<Status>("all");
  const [sort, setSort] = useState<Sort>("new");
  const [view, setView] = useState<View>("list");
  const [editing, setEditing] = useState<VocabEntry | null>(null);
  // Oynaga barqaror boshlang'ich qiymat (har renderda yangi obyekt — forma qayta tiklanib qolmasin)
  const editInitial = useMemo<VocabFormValues>(() => (editing ? { word: editing.word, translation: editing.translation ?? "", context: editing.context ?? "" } : EMPTY), [editing]);

  const userId = user?.id;
  const load = useCallback(
    (force = false) => {
      if (!userId) return;
      setLoading(true);
      setError(null);
      vocabularyApi
        .listAll(userId, { force })
        .then((list) => {
          setItems(list);
          setLoadedAt(Date.now());
        })
        .catch((e: unknown) => setError(errorMessage(e)))
        .finally(() => setLoading(false));
    },
    [userId],
  );
  useEffect(() => {
    if (!userId) return;
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [userId, load]);

  const replace = (e: VocabEntry) => setItems((prev) => prev?.map((x) => (x.id === e.id ? e : x)) ?? prev);

  // ---- Filtr va saralash
  const books = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of items ?? []) if (v.bookId) map.set(v.bookId, v.bookTitle ?? "—");
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);
  const shown = useMemo(() => {
    const q = normalizeWord(search);
    let list = (items ?? []).filter(
      (v) =>
        (book === "all" || v.bookId === book) &&
        (status === "all" || (status === "learned" ? v.learned : !v.learned)) &&
        (!q || normalizeWord(v.word).includes(q) || normalizeWord(v.translation ?? "").includes(q)),
    );
    list = list.slice().sort((a, b) => (sort === "az" ? a.word.localeCompare(b.word) : sort === "old" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));
    return list;
  }, [items, search, book, status, sort]);

  const stats = useMemo(() => {
    const list = items ?? [];
    return {
      total: list.length,
      learned: list.filter((v) => v.learned).length,
      week: loadedAt ? list.filter((v) => loadedAt - Date.parse(v.createdAt) < WEEK).length : 0,
    };
  }, [items, loadedAt]);

  // ---- Amallar
  const toggleLearned = async (v: VocabEntry) => {
    try {
      replace(await vocabularyApi.update(v, { learned: !v.learned }));
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const saveEdit = async (values: VocabFormValues) => {
    if (!editing) return;
    try {
      replace(await vocabularyApi.update(editing, { word: values.word, translation: values.translation || null, context: values.context || null }));
      setEditing(null);
    } catch (e) {
      throw new Error(errorMessage(e));
    }
  };
  const remove = async (v: VocabEntry) => {
    const ok = await confirm({ title: t("vocab.delete"), message: t("vocab.deleteConfirm", { word: v.word }), confirmLabel: t("vocab.delete"), tone: "danger" });
    if (!ok) return;
    try {
      await vocabularyApi.remove(v);
      setItems((prev) => prev?.filter((x) => x.id !== v.id) ?? prev);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const exportCsv = () => {
    const csv = toCsv(shown, [t("vocab.word"), t("vocab.translation"), t("vocab.context"), t("nav.library"), t("reader.tab.toc"), "page", t("vocab.learned"), "date"]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lugat-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Boshqa oynada (reader) so'z qo'shilsa/o'zgarsa — ro'yxat yangilanadi
  useEffect(() => {
    const on = () => load();
    window.addEventListener(VOCAB_EVENT, on);
    return () => window.removeEventListener(VOCAB_EVENT, on);
  }, [load]);

  const empty = items !== null && items.length === 0;

  return (
    <div className="vocab-page">
      <PageHeader
        eyebrow={t("vocab.eyebrow")}
        title={t("vocab.title")}
        description={t("vocab.sub")}
        icon={<I.Languages size={26} />}
        actions={
          items && (
            <div className="flex flex-wrap gap-2" data-testid="vocab-stats">
              <Badge tone="accent">
                <I.Book size={13} /> {t("vocab.stat.total", { n: stats.total })}
              </Badge>
              <Badge tone="success">
                <I.CheckCircle size={13} /> {t("vocab.stat.learned", { n: stats.learned })}
              </Badge>
              <Badge>
                <I.Sparkles size={13} /> {t("vocab.stat.week", { n: stats.week })}
              </Badge>
            </div>
          )
        }
      />

      {!empty && (
        <div className="vocab-toolbar">
          <div className="tabs vocab-tabs" role="tablist" aria-label={t("vocab.title")}>
            {(["list", "cards"] as View[]).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} className={cn("tab", view === v && "active")} onClick={() => setView(v)} data-testid={`vocab-view-${v}`}>
                {v === "list" ? <I.List size={15} /> : <I.Layers size={15} />}
                {t(v === "list" ? "vocab.view.list" : "vocab.view.cards")}
              </button>
            ))}
          </div>
          <SearchInput placeholder={t("vocab.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="vocab-search" aria-label={t("vocab.search")} data-testid="vocab-search" />
          <Select value={book} onChange={setBook} options={[{ value: "all", label: t("vocab.filter.allBooks") }, ...books]} className="vocab-select" aria-label={t("vocab.filter.allBooks")} data-testid="vocab-book" />
          <Select
            value={status}
            onChange={(v) => setStatus(v as Status)}
            options={[
              { value: "all", label: t("vocab.filter.all") },
              { value: "learning", label: t("vocab.filter.learning") },
              { value: "learned", label: t("vocab.filter.learned") },
            ]}
            className="vocab-select"
            aria-label={t("vocab.filter.all")}
            data-testid="vocab-status"
          />
          {view === "list" && (
            <Select
              value={sort}
              onChange={(v) => setSort(v as Sort)}
              options={[
                { value: "new", label: t("vocab.sort.new") },
                { value: "old", label: t("vocab.sort.old") },
                { value: "az", label: t("vocab.sort.az") },
              ]}
              className="vocab-select"
              aria-label={t("vocab.sort.new")}
              data-testid="vocab-sort"
            />
          )}
          <div className="vocab-toolbar-end">
            {loading && items && <Spinner className="size-4 text-muted" />}
            <button type="button" className={buttonClass("secondary", "sm")} onClick={exportCsv} disabled={!shown.length} title={t("vocab.exportTitle")} data-testid="vocab-export">
              <I.Download size={15} />
              {t("vocab.export")}
            </button>
            <IconButton label={t("vocab.refresh")} onClick={() => load(true)} data-testid="vocab-refresh">
              <I.Refresh size={17} />
            </IconButton>
          </div>
        </div>
      )}

      {error && <Alert className="mb-4">{error}</Alert>}

      {loading && !items ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted">
          <Spinner />
          <p className="text-sm">{t("vocab.loading")}</p>
        </div>
      ) : empty ? (
        <EmptyState
          icon={<I.Languages size={22} />}
          title={t("vocab.empty.title")}
          description={t("vocab.empty.desc")}
          action={
            <Link href="/library" className={buttonClass("primary")}>
              {t("vocab.empty.cta")}
              <I.ArrowRight size={16} />
            </Link>
          }
          className="vocab-empty"
        />
      ) : view === "cards" ? (
        <VocabCards entries={shown} onLearned={async (v) => replace(await vocabularyApi.update(v, { learned: true }))} />
      ) : shown.length === 0 ? (
        <EmptyState icon={<I.Search size={22} />} title={t("vocab.noResults")} />
      ) : (
        <div className={cn("vocab-grid", loading && "opacity-70")} data-testid="vocab-grid">
          {shown.map((v) => (
            <article key={v.id} className={cn("vocab-card", v.learned && "is-learned")} data-testid="vocab-card" data-word={v.word}>
              <div className="vocab-card-head">
                <h3 className="vocab-word user-text">{v.word}</h3>
                {canSpeak() && (
                  <IconButton size="sm" variant="plain" label={t("vocab.listen")} onClick={() => speak(v.word)}>
                    <I.Volume size={16} />
                  </IconButton>
                )}
                {v.learned && (
                  <Badge tone="success" dot className="ml-auto">
                    {t("vocab.learned")}
                  </Badge>
                )}
              </div>
              {v.translation ? (
                <p className="vocab-tr user-text" data-testid="vocab-card-translation">
                  {v.translation}
                </p>
              ) : (
                <button type="button" className="vocab-add-tr" onClick={() => setEditing(v)} data-testid="vocab-add-translation">
                  <I.Plus size={14} />
                  {t("vocab.addTranslation")}
                </button>
              )}
              {v.context && (
                <blockquote className="vocab-context user-text">
                  <Context text={v.context} word={v.word} />
                </blockquote>
              )}
              <p className="vocab-source user-text">
                <I.BookOpen size={13} />
                <span>{[v.bookTitle, v.articleTitle].filter(Boolean).join(" · ") || "—"}</span>
                {v.page != null && <span className="vocab-pageno">{t("vocab.pageN", { n: v.page })}</span>}
                <span className="vocab-date">{formatDate(v.createdAt)}</span>
              </p>
              <div className="vocab-actions">
                {v.articleId && (
                  <Link href={pdfHref(v)} className={buttonClass("primary", "sm")} data-testid="vocab-open-pdf">
                    <I.BookOpen size={14} />
                    {t("vocab.openInPdf")}
                  </Link>
                )}
                <button type="button" className={buttonClass(v.learned ? "ghost" : "secondary", "sm")} onClick={() => void toggleLearned(v)} data-testid="vocab-learned">
                  {v.learned ? <I.RotateCcw size={14} /> : <I.Check size={14} />}
                  {t(v.learned ? "vocab.markLearning" : "vocab.markLearned")}
                </button>
                <span className="vocab-actions-end">
                  <IconButton size="sm" variant="plain" label={t("vocab.edit")} onClick={() => setEditing(v)} data-testid="vocab-edit">
                    <I.Pencil size={15} />
                  </IconButton>
                  <IconButton size="sm" variant="danger" label={t("vocab.delete")} onClick={() => void remove(v)} data-testid="vocab-delete">
                    <I.Trash size={15} />
                  </IconButton>
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      <VocabDialog
        open={!!editing}
        mode="edit"
        initial={editInitial}
        onSave={saveEdit}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

const EMPTY: VocabFormValues = { word: "", translation: "", context: "" };
