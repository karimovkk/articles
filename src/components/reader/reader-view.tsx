"use client";

/**
 * Reader konteyneri — maqola bo'yicha (OpenAPI):
 *   1. GET /reader/articles/{id}            — metadata (page_count, processing_status, current_page, features)
 *   2. GET /reader/articles/{id}/watermark  — imzolangan watermark
 *   3. GET /reader/articles/{id}/content    — Range bilan stream (PdfViewer ichida)
 *   4. /articles/{id}/progress | reading-heartbeat | mark-read | annotations | search | toc
 *   5. GET /reader/books/{book_id}/articles — oldingi/keyingi maqola
 *
 * Himoya (TZ §4, S-41): chop etish (Ctrl+P, @media print) va saqlash (Ctrl+S) bloklanadi;
 * nusxalash PdfViewer'da bloklanadi. Bular klient tomonidagi to'siqlar — asosiy himoya backend.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { Alert, IconButton, Spinner, cn } from "@/components/ui";
import {
  errorMessage,
  isApiError,
  readerApi,
  readingApi,
  type Annotation,
  type ArticleListItem,
  type ReaderMeta,
  type SearchMatch,
  type TocEntry,
} from "@/lib/api";
import { HIGHLIGHT_COLORS, normalizeColor } from "@/lib/reader/highlights";
import { useT } from "@/i18n";
import * as I from "@/components/ui/icons";
import { PdfViewer, type PdfViewerHandle, type TextSelection, type ViewMode } from "./pdf-viewer";
import { ReaderSidebar, type SidebarTab } from "./reader-sidebar";
import { WatermarkOverlay, type WatermarkLike } from "./watermark-overlay";

const ZOOMS = [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];
const NIGHT_KEY = "a365.reader.night";
const MODE_KEY = "a365.reader.mode";
const COLOR_KEY = "a365.reader.hlcolor";
/** Faol o'qish vaqti (T1-21): har 30 s, faqat sahifa ko'rinayotganda (B10 — backend limiti aniqlanmagan) */
const HEARTBEAT_MS = 30_000;

/** localStorage'dan xavfsiz o'qish (ReaderView faqat brauzerda, auth'dan so'ng render bo'ladi). */
function readPref(key: string): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}
function writePref(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private rejim va h.k. */
  }
}

export function ReaderView({ articleId }: { articleId: string }) {
  const { t } = useT();
  const { user } = useAuth();
  const viewerRef = useRef<PdfViewerHandle>(null);

  const [meta, setMeta] = useState<ReaderMeta | null>(null);
  const [fatal, setFatal] = useState<{ code: string; message: string } | null>(null);
  const [watermark, setWatermark] = useState<WatermarkLike | null>(null);
  const [siblings, setSiblings] = useState<ArticleListItem[]>([]);
  const [isRead, setIsRead] = useState(false);

  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [pageCount, setPageCount] = useState(0);
  const [zoomIdx, setZoomIdx] = useState(3);
  const [night, setNight] = useState(() => readPref(NIGHT_KEY) === "1");
  const [mode, setMode] = useState<ViewMode>(() => (readPref(MODE_KEY) === "page" ? "page" : "scroll"));
  const [hlColor, setHlColor] = useState(() => normalizeColor(readPref(COLOR_KEY)));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<SidebarTab>("toc");

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [toc, setToc] = useState<TocEntry[] | null>(null);
  const [searchHits, setSearchHits] = useState<SearchMatch[] | null>(null);
  // Natija bosilganda — PDF'da vaqtincha bo'rttiriladigan moslik (nonce: bir xil natija qayta bosilsa ham yonadi)
  const [searchHit, setSearchHit] = useState<{ page: number; query: string; nonce: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchAvailable, setSearchAvailable] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const initialPage = useMemo(() => Math.max(1, meta?.current_page ?? 1), [meta]);
  const highlights = useMemo(() => annotations.filter((a) => a.type === "HIGHLIGHT"), [annotations]);
  const ready = meta?.processing_status === "READY" && meta.features?.can_read !== false;

  // Oldingi / keyingi maqola (faqat READY)
  const { prev, next } = useMemo(() => {
    const list = siblings.filter((a) => a.processing_status === "READY").sort((a, b) => a.order_index - b.order_index);
    const i = list.findIndex((a) => a.article_id === articleId);
    return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
  }, [siblings, articleId]);

  // ---- Metadata + watermark + annotatsiyalar + progress + qo'shni maqolalar
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await readerApi.meta(articleId);
        if (cancelled) return;
        setMeta(m);
        setPageCount(m.page_count ?? 0);
        const start = Math.max(1, m.current_page ?? 1);
        setPage(start);
        setPageInput(String(start));
        setSearchAvailable(m.features?.can_search ?? m.text_extractable ?? true);
        readerApi
          .articles(m.book_id)
          .then((a) => !cancelled && setSiblings(a))
          .catch(() => undefined);
        if (m.processing_status !== "READY") return;
      } catch (e) {
        if (cancelled) return;
        setFatal({ code: isApiError(e) ? e.code : "ERROR", message: errorMessage(e) });
        return;
      }
      readerApi
        .watermark(articleId)
        .then((w) => !cancelled && setWatermark(w))
        .catch(() => {
          // Watermark olinmasa ham o'qishga ruxsat bor; minimal label ko'rsatamiz
          if (!cancelled && user) setWatermark({ watermark_text: `${user.email ?? user.phone ?? user.id.slice(0, 8)} · ${new Date().toISOString().slice(0, 10)}` });
        });
      readingApi
        .listAnnotations(articleId)
        .then((a) => !cancelled && setAnnotations(a))
        .catch(() => undefined);
      readingApi
        .getProgress(articleId)
        .then((p) => !cancelled && setIsRead(p.is_read))
        .catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [articleId, user]);

  // ---- Mundarija (bir marta)
  const tocAvailable = meta?.features?.has_toc !== false;
  useEffect(() => {
    if (!meta || !tocAvailable || toc !== null || tab !== "toc" || !sidebarOpen) return;
    readingApi
      .toc(articleId)
      .then(setToc)
      .catch(() => setToc([]));
  }, [meta, tocAvailable, toc, tab, sidebarOpen, articleId]);

  // ---- Progress'ni saqlash (debounce) — TZ §4.7
  const saveTimer = useRef<number | null>(null);
  const lastSaved = useRef<number>(0);
  const persistProgress = useCallback(
    (p: number) => {
      if (!pageCount || p === lastSaved.current) return;
      lastSaved.current = p;
      readingApi.saveProgress(articleId, { current_page: p, total_pages: pageCount }).catch(() => undefined);
    },
    [articleId, pageCount],
  );
  const onPageChange = useCallback(
    (p: number) => {
      setPage(p);
      setPageInput(String(p));
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => persistProgress(p), 1500);
    },
    [persistProgress],
  );
  // Sahifa yopilganda / reader'dan chiqilganda oxirgi sahifani darhol saqlash
  const latest = useRef({ page, persistProgress });
  useEffect(() => {
    latest.current = { page, persistProgress };
  }, [page, persistProgress]);
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      latest.current.persistProgress(latest.current.page);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  // ---- Faol o'qish vaqti: heartbeat (faqat ko'rinayotganda; yopilganda qoldiq keepalive bilan)
  useEffect(() => {
    if (!ready) return;
    let since = Date.now();
    const beat = (final = false) => {
      if (document.visibilityState !== "visible" && !final) {
        since = Date.now();
        return;
      }
      const seconds = Math.round((Date.now() - since) / 1000);
      since = Date.now();
      if (seconds >= 5) readingApi.heartbeat(articleId, Math.min(seconds, HEARTBEAT_MS / 1000 + 5), latest.current.page).catch(() => undefined);
    };
    const timer = window.setInterval(() => beat(), HEARTBEAT_MS);
    const onVis = () => {
      if (document.visibilityState === "hidden") beat(true);
      else since = Date.now();
    };
    const onHide = () => beat(true);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      beat(true);
    };
  }, [articleId, ready]);

  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((tx: string) => {
    setToast(tx);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2500);
  }, []);

  // ---- "O'qib bo'lindi" (FE-5.8): qo'lda + oxirgi sahifaga yetganda avtomatik
  const toggleRead = useCallback(
    async (value: boolean, silent = false) => {
      try {
        const p = await readingApi.markRead(articleId, value);
        setIsRead(p.is_read);
        if (!silent) showToast(p.is_read ? t("reader.markedRead") : t("reader.markedUnread"));
      } catch (e) {
        showToast(errorMessage(e));
      }
    },
    [articleId, showToast, t],
  );
  const autoMarked = useRef(false);
  useEffect(() => {
    if (!ready || !pageCount || isRead || autoMarked.current || page < pageCount) return;
    autoMarked.current = true;
    void toggleRead(true);
  }, [page, pageCount, isRead, ready, toggleRead]);

  // ---- Klaviatura: navigatsiya + chop etish/saqlash bloklash
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === "p" || k === "s")) {
        e.preventDefault();
        showToast(k === "p" ? t("reader.noPrint") : t("reader.noSave"));
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") viewerRef.current?.goToPage(page + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") viewerRef.current?.goToPage(page - 1);
      if (e.key === "+" || e.key === "=") setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1));
      if (e.key === "-") setZoomIdx((z) => Math.max(0, z - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, showToast, t]);

  const toggleNight = () => {
    setNight((n) => {
      writePref(NIGHT_KEY, n ? "0" : "1");
      return !n;
    });
  };
  const toggleMode = () => {
    setMode((m) => {
      const nextMode: ViewMode = m === "scroll" ? "page" : "scroll";
      writePref(MODE_KEY, nextMode);
      return nextMode;
    });
  };

  // ---- Annotatsiyalar
  const addAnnotation = async (input: Parameters<typeof readingApi.createAnnotation>[1]) => {
    try {
      const a = await readingApi.createAnnotation(articleId, input);
      setAnnotations((prev) => [a, ...prev]);
      return a;
    } catch (e) {
      showToast(errorMessage(e));
      throw e;
    }
  };
  const onAddBookmark = () => {
    if (annotations.some((a) => a.type === "BOOKMARK" && a.page === page)) {
      showToast(t("reader.bookmarkExists"));
      return;
    }
    void addAnnotation({ type: "BOOKMARK", page, location_data: { page } }).then(() => showToast(t("reader.bookmarked", { n: page })));
  };
  const onAddNote = async (p: number, text: string) => {
    await addAnnotation({ type: "NOTE", page: p, note_text: text, location_data: { page: p } });
  };
  const onUpdateNote = async (a: Annotation, text: string) => {
    try {
      const u = await readingApi.updateAnnotation(articleId, a.id, { note_text: text });
      setAnnotations((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...u } : x)));
    } catch (e) {
      showToast(errorMessage(e));
    }
  };
  const onDelete = async (a: Annotation) => {
    try {
      await readingApi.deleteAnnotation(articleId, a.id);
      setAnnotations((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e) {
      showToast(errorMessage(e));
    }
  };
  const onHighlight = async (color: string) => {
    if (!selection) return;
    const s = selection;
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    setHlColor(color);
    writePref(COLOR_KEY, color);
    // Optimistik: server javobida location_data bo'lmasa ham lokal nusxada rects saqlanadi
    const location_data = { page: s.page, rects: s.rects };
    try {
      const a = await readingApi.createAnnotation(articleId, { type: "HIGHLIGHT", page: s.page, selected_text: s.text, color, location_data });
      setAnnotations((prev) => [{ ...a, color: a.color ?? color, location_data: a.location_data ?? location_data }, ...prev]);
      showToast(t("reader.highlighted"));
    } catch (e) {
      showToast(errorMessage(e));
    }
  };
  const onChangeColor = async (a: Annotation, color: string) => {
    if (normalizeColor(a.color) === color) return;
    try {
      const u = await readingApi.updateAnnotation(articleId, a.id, { color });
      setAnnotations((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...u, color: u.color ?? color } : x)));
    } catch (e) {
      showToast(errorMessage(e));
    }
  };

  // Jonli qidiruv: faqat oxirgi so'rov natijasi qo'llanadi (eskirgan javob keyin kelsa — e'tiborsiz)
  const searchSeq = useRef(0);
  const onSearch = async (q: string) => {
    const seq = ++searchSeq.current;
    if (!q) {
      setSearchHits(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const r = await readingApi.search(articleId, q);
      if (seq !== searchSeq.current) return;
      setSearchAvailable(r.textAvailable);
      setSearchHits(r.hits);
    } catch (e) {
      if (seq === searchSeq.current) showToast(errorMessage(e));
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  };

  const goToPage = useCallback((p: number) => {
    viewerRef.current?.goToPage(p);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  // ---- Xatolik ekrani (403 BOOK_ACCESS_DENIED, 404 va h.k.)
  if (fatal) {
    const friendly = fatal.code === "BOOK_ACCESS_DENIED" ? t("reader.accessDenied") : fatal.code.endsWith("_NOT_FOUND") ? t("reader.notFound") : fatal.message;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <Alert>{friendly}</Alert>
        <Link href="/library" className="text-sm font-bold text-accent-ink underline">
          {t("common.backToLibrary")}
        </Link>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        <Spinner />
      </div>
    );
  }

  // ---- Maqola hali tayyor emas (PROCESSING/UPLOADING/FAILED)
  if (!ready) {
    const failed = meta.processing_status === "FAILED";
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        {!failed && <Spinner />}
        <p className="text-lg font-medium text-text">{meta.title}</p>
        <Alert tone={failed ? "danger" : "info"}>{failed ? t("reader.processingFailed") : t("reader.processing")}</Alert>
        <Link href={`/books/${meta.book_id}`} className="text-sm font-bold text-accent-ink underline">
          {t("reader.backToBook")}
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Faqat chop etishda ko'rinadi (globals.css @media print) */}
      <div className="print-notice hidden p-8 text-center text-lg">{t("reader.printNotice")}</div>

      <div className={cn("print-protected flex h-dvh flex-col", night && "dark")}>
        {/* Toolbar */}
        <header className="z-30 flex h-14 shrink-0 items-center gap-1 border-b border-border bg-surface px-1.5 text-text sm:gap-1.5 sm:px-3">
          <Link href={`/books/${meta.book_id}`} className="icon-btn plain" title={t("reader.backToBook")} aria-label={t("reader.backToBook")}>
            <I.ArrowLeft size={18} />
          </Link>
          <button type="button" onClick={() => setSidebarOpen((s) => !s)} className={cn("icon-btn plain", sidebarOpen && "bg-surface-2 text-text")} title={t("reader.panel")} aria-label={t("reader.panel")} aria-pressed={sidebarOpen}>
            <I.PanelLeft size={18} />
          </button>
          <div className="min-w-0 flex-1 pl-1">
            <p className="truncate text-[13.5px] font-bold">{meta.title}</p>
            {(prev || next) && (
              <p className="flex gap-3 text-[11px] font-semibold text-muted">
                {prev && (
                  <Link href={`/reader/${prev.article_id}`} className="inline-flex min-w-0 items-center gap-0.5 truncate hover:text-text" title={prev.title}>
                    <I.ChevronLeft size={12} /> {t("reader.prevArticle")}
                  </Link>
                )}
                {next && (
                  <Link href={`/reader/${next.article_id}`} className="inline-flex min-w-0 items-center gap-0.5 truncate hover:text-text" title={next.title}>
                    {t("reader.nextArticle")} <I.ChevronRight size={12} />
                  </Link>
                )}
              </p>
            )}
          </div>

          <form
            className="flex items-center gap-1.5 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(pageInput);
              if (Number.isFinite(n)) goToPage(n);
              // Fokus input'da qolsa klaviatura yorliqlari (←/→, +/−) ishlamaydi
              (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.blur();
            }}
          >
            <input value={pageInput} onChange={(e) => setPageInput(e.target.value)} className="input sm w-14 text-center font-bold tabular-nums" inputMode="numeric" aria-label={t("common.page")} />
            <span className="text-xs font-semibold text-muted">/ {pageCount || "…"}</span>
          </form>

          <div className="hidden items-center sm:flex">
            <button type="button" onClick={() => setZoomIdx((z) => Math.max(0, z - 1))} className="icon-btn plain sm" title={t("reader.zoomOut")} aria-label={t("reader.zoomOut")}>
              <I.ZoomOut size={16} />
            </button>
            <span className="w-11 text-center text-xs font-bold tabular-nums text-muted">{Math.round(ZOOMS[zoomIdx] * 100)}%</span>
            <button type="button" onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))} className="icon-btn plain sm" title={t("reader.zoomIn")} aria-label={t("reader.zoomIn")}>
              <I.ZoomIn size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void toggleRead(!isRead)}
            className={cn("btn ghost sm max-sm:!px-2", isRead && "text-success")}
            title={isRead ? t("reader.markUnread") : t("reader.markRead")}
            aria-label={isRead ? t("reader.markUnread") : t("reader.markRead")}
            aria-pressed={isRead}
          >
            {isRead ? <I.CheckCircle size={16} /> : <I.Check size={16} className="opacity-50" />}
            <span className="hidden md:inline">{t("reader.readLabel")}</span>
          </button>
          <button type="button" onClick={toggleMode} className="btn ghost sm max-sm:!px-2" title={mode === "scroll" ? t("reader.toPageMode") : t("reader.toScrollMode")} aria-label={t("reader.readingMode")}>
            {mode === "scroll" ? <I.Rows size={16} /> : <I.Columns size={16} />}
            <span className="hidden sm:inline">{mode === "scroll" ? t("reader.modeScroll") : t("reader.modePage")}</span>
          </button>
          <button type="button" onClick={toggleNight} className="icon-btn plain" title={night ? t("theme.light") : t("theme.dark")} aria-label={night ? t("theme.light") : t("theme.dark")}>
            {night ? <I.Sun size={18} /> : <I.Moon size={18} />}
          </button>
          <button
            type="button"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void document.documentElement.requestFullscreen?.();
            }}
            className="icon-btn plain hidden sm:inline-flex"
            title={t("reader.fullscreen")}
            aria-label={t("reader.fullscreen")}
          >
            <I.Maximize size={18} />
          </button>
        </header>

        <div className="relative flex min-h-0 flex-1">
          {sidebarOpen && (
            <div className="absolute inset-0 z-30 md:static md:z-auto md:w-80 md:shrink-0">
              <ReaderSidebar
                tab={tab}
                onTab={setTab}
                onClose={() => setSidebarOpen(false)}
                goToPage={goToPage}
                currentPage={page}
                toc={toc}
                tocAvailable={tocAvailable}
                searchAvailable={searchAvailable}
                onSearchHit={(h) => {
                  goToPage(h.page);
                  setSearchHit({ ...h, nonce: Date.now() });
                }}
                searchHits={searchHits}
                searching={searching}
                onSearch={onSearch}
                annotations={annotations}
                onAddBookmark={onAddBookmark}
                onAddNote={onAddNote}
                onUpdateNote={onUpdateNote}
                onDelete={onDelete}
                onChangeColor={onChangeColor}
              />
            </div>
          )}

          <div className="relative min-w-0 flex-1">
            <PdfViewer
              ref={viewerRef}
              articleId={articleId}
              initialPage={initialPage}
              zoom={ZOOMS[zoomIdx]}
              night={night}
              mode={mode}
              highlights={highlights}
              searchHit={searchHit}
              onReady={({ pageCount: n }) => setPageCount((c) => c || n)}
              onPageChange={onPageChange}
              onError={(m, e) => setFatal({ code: isApiError(e) ? e.code : "CONTENT_ERROR", message: e ? errorMessage(e, m) : m })}
              onTextSelected={setSelection}
            />
            {meta.features?.watermark !== false && <WatermarkOverlay payload={watermark} night={night} />}

            {selection && (
              <div className="absolute left-1/2 top-2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-surface p-1.5 pl-3 shadow-lg">
                <span className="px-1 text-xs text-muted">{t("reader.highlightAt", { n: selection.page })}</span>
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void onHighlight(c.hex)}
                    title={t(c.labelKey)}
                    aria-label={t("reader.highlightWith", { color: t(c.labelKey) })}
                    className={cn("size-6 rounded-full border-2 transition-transform hover:scale-110", c.hex === hlColor ? "border-text" : "border-transparent")}
                    style={{ background: c.hex }}
                  />
                ))}
                <IconButton size="sm" variant="plain" onClick={() => setSelection(null)} label={t("common.close")}>
                  <I.X size={15} />
                </IconButton>
              </div>
            )}

            {toast && (
              <div className="pointer-events-none absolute bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[var(--ink)] px-4 py-2 text-[13px] font-bold text-[var(--chalk)] shadow-lg">
                {toast}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
