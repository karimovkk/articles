"use client";

/**
 * Reader konteyneri. Oqim (API.md «Kitob o'qish»):
 *   1. GET /reader/{id}            — metadata (page_count, progress, features)
 *   2. GET /reader/{id}/watermark  — imzolangan watermark
 *   3. GET /reader/{id}/content    — Range bilan stream (PdfViewer ichida)
 *   4. GET/PUT /books/{id}/progress, /annotations, /search, /toc
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { Alert, Button, Spinner, cn } from "@/components/ui";
import {
  errorMessage,
  isApiError,
  readerApi,
  readingApi,
  type Annotation,
  type ReaderMeta,
  type SearchHit,
  type TocEntry,
  type WatermarkPayload,
} from "@/lib/api";
import { PdfViewer, type PdfViewerHandle } from "./pdf-viewer";
import { ReaderSidebar, type SidebarTab } from "./reader-sidebar";
import { WatermarkOverlay } from "./watermark-overlay";

const ZOOMS = [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];
const NIGHT_KEY = "a365.reader.night";

export function ReaderView({ bookId }: { bookId: string }) {
  const { user } = useAuth();
  const viewerRef = useRef<PdfViewerHandle>(null);

  const [meta, setMeta] = useState<ReaderMeta | null>(null);
  const [fatal, setFatal] = useState<{ code: string; message: string } | null>(null);
  const [watermark, setWatermark] = useState<WatermarkPayload | null>(null);

  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [pageCount, setPageCount] = useState(0);
  const [zoomIdx, setZoomIdx] = useState(3);
  // ReaderView faqat brauzerda (auth tekshiruvidan so'ng) render bo'ladi — lazy init xavfsiz
  const [night, setNight] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(NIGHT_KEY) === "1");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<SidebarTab>("toc");

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [toc, setToc] = useState<TocEntry[] | null>(null);
  const [searchHits, setSearchHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchAvailable, setSearchAvailable] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ page: number; text: string; x: number; y: number } | null>(null);

  const initialPage = useMemo(() => Math.max(1, meta?.progress?.current_page ?? 1), [meta]);

  // ---- Metadata + watermark + annotatsiyalar
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await readerApi.meta(bookId);
        if (cancelled) return;
        setMeta(m);
        setPageCount(m.page_count ?? 0);
        const start = Math.max(1, m.progress?.current_page ?? 1);
        setPage(start);
        setPageInput(String(start));
        setSearchAvailable(m.features?.search ?? m.features?.text_available ?? m.text_available ?? true);
      } catch (e) {
        if (cancelled) return;
        setFatal({ code: isApiError(e) ? e.code : "ERROR", message: errorMessage(e) });
        return;
      }
      readerApi
        .watermark(bookId)
        .then((w) => !cancelled && setWatermark(w))
        .catch(() => {
          // Watermark olinmasa ham o'qishga ruxsat bor; minimal label ko'rsatamiz
          if (!cancelled && user) setWatermark({ label: `${user.email ?? user.phone ?? user.id.slice(0, 8)} · ${new Date().toISOString().slice(0, 10)}` });
        });
      readingApi
        .listAnnotations(bookId)
        .then((a) => !cancelled && setAnnotations(a))
        .catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId, user]);

  // ---- Mundarija (bir marta)
  const tocAvailable = meta?.features?.toc !== false;
  useEffect(() => {
    if (!meta || !tocAvailable || toc !== null || tab !== "toc" || !sidebarOpen) return;
    readingApi
      .toc(bookId)
      .then(setToc)
      .catch(() => setToc([]));
  }, [meta, tocAvailable, toc, tab, sidebarOpen, bookId]);

  // ---- Progress'ni saqlash (debounce) — TZ §4.7
  const saveTimer = useRef<number | null>(null);
  const lastSaved = useRef<number>(0);
  const persistProgress = useCallback(
    (p: number) => {
      if (!pageCount || p === lastSaved.current) return;
      lastSaved.current = p;
      readingApi.saveProgress(bookId, { current_page: p, total_pages: pageCount }).catch(() => undefined);
    },
    [bookId, pageCount],
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

  // ---- Klaviatura
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") viewerRef.current?.goToPage(page + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") viewerRef.current?.goToPage(page - 1);
      if (e.key === "+" || e.key === "=") setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1));
      if (e.key === "-") setZoomIdx((z) => Math.max(0, z - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page]);

  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 2500);
  };

  const toggleNight = () => {
    setNight((n) => {
      window.localStorage.setItem(NIGHT_KEY, n ? "0" : "1");
      return !n;
    });
  };

  // ---- Annotatsiyalar
  const addAnnotation = async (input: Parameters<typeof readingApi.createAnnotation>[1]) => {
    try {
      const a = await readingApi.createAnnotation(bookId, input);
      setAnnotations((prev) => [a, ...prev]);
      return a;
    } catch (e) {
      showToast(errorMessage(e));
      throw e;
    }
  };
  const onAddBookmark = () => {
    if (annotations.some((a) => a.type === "BOOKMARK" && a.page === page)) {
      showToast("Bu sahifada xatcho'p allaqachon bor");
      return;
    }
    void addAnnotation({ type: "BOOKMARK", page, location: { page } }).then(() => showToast(`${page}-bet xatcho'plandi`));
  };
  const onAddNote = async (p: number, text: string) => {
    await addAnnotation({ type: "NOTE", page: p, note: text, text, location: { page: p } });
  };
  const onUpdateNote = async (a: Annotation, text: string) => {
    try {
      const u = await readingApi.updateAnnotation(bookId, a.id, { note: text, text });
      setAnnotations((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...u } : x)));
    } catch (e) {
      showToast(errorMessage(e));
    }
  };
  const onDelete = async (a: Annotation) => {
    try {
      await readingApi.deleteAnnotation(bookId, a.id);
      setAnnotations((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e) {
      showToast(errorMessage(e));
    }
  };
  const onHighlight = async () => {
    if (!selection) return;
    const s = selection;
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    await addAnnotation({ type: "HIGHLIGHT", page: s.page, text: s.text, color: "#fde047", location: { page: s.page } });
    showToast("Belgilandi");
  };

  const onSearch = async (q: string) => {
    setSearching(true);
    try {
      const r = await readingApi.search(bookId, q);
      setSearchAvailable(r.textAvailable);
      setSearchHits(r.hits);
    } catch (e) {
      showToast(errorMessage(e));
    } finally {
      setSearching(false);
    }
  };

  const goToPage = useCallback((p: number) => {
    viewerRef.current?.goToPage(p);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  // ---- Xatolik ekrani (403 BOOK_ACCESS_DENIED, 404 va h.k.)
  if (fatal) {
    const friendly =
      fatal.code === "BOOK_ACCESS_DENIED"
        ? "Bu kitobga ruxsatingiz yo'q yoki ruxsat bekor qilingan."
        : fatal.code.endsWith("_NOT_FOUND")
          ? "Kitob topilmadi."
          : fatal.message;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <Alert>{friendly}</Alert>
        <Link href="/library" className="text-sm text-accent underline">
          Kutubxonaga qaytish
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

  return (
    <div className={cn("flex h-dvh flex-col", night && "dark")}>
      {/* Toolbar */}
      <header className="z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-2 text-text sm:px-3">
        <Link href="/library" className="rounded-md px-2 py-1 text-sm text-muted hover:text-text" title="Kutubxona">
          ←
        </Link>
        <button onClick={() => setSidebarOpen((s) => !s)} className="rounded-md px-2 py-1 text-sm hover:bg-bg" title="Panel">
          ☰
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{meta.title}</p>
          {meta.author && <p className="truncate text-[11px] text-muted">{meta.author}</p>}
        </div>

        <form
          className="flex items-center gap-1 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(pageInput);
            if (Number.isFinite(n)) goToPage(n);
          }}
        >
          <input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            className="h-8 w-14 rounded-md border border-border bg-bg px-2 text-center text-sm"
            inputMode="numeric"
            aria-label="Sahifa"
          />
          <span className="text-muted">/ {pageCount || "…"}</span>
        </form>

        <div className="hidden items-center gap-1 sm:flex">
          <button onClick={() => setZoomIdx((z) => Math.max(0, z - 1))} className="rounded-md px-2 py-1 hover:bg-bg" title="Kichraytirish">
            −
          </button>
          <span className="w-12 text-center text-xs text-muted">{Math.round(ZOOMS[zoomIdx] * 100)}%</span>
          <button onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))} className="rounded-md px-2 py-1 hover:bg-bg" title="Kattalashtirish">
            +
          </button>
        </div>
        <button onClick={toggleNight} className="rounded-md px-2 py-1 hover:bg-bg" title={night ? "Kunduzgi rejim" : "Tungi rejim"}>
          {night ? "☀️" : "🌙"}
        </button>
        <button
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen?.();
          }}
          className="hidden rounded-md px-2 py-1 hover:bg-bg sm:block"
          title="To'liq ekran"
        >
          ⛶
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
              searchHits={searchHits}
              searching={searching}
              onSearch={onSearch}
              annotations={annotations}
              onAddBookmark={onAddBookmark}
              onAddNote={onAddNote}
              onUpdateNote={onUpdateNote}
              onDelete={onDelete}
            />
          </div>
        )}

        <div className="relative min-w-0 flex-1">
          <PdfViewer
            ref={viewerRef}
            bookId={bookId}
            initialPage={initialPage}
            zoom={ZOOMS[zoomIdx]}
            night={night}
            onReady={({ pageCount: n }) => setPageCount((c) => c || n)}
            onPageChange={onPageChange}
            onError={(m) => setFatal({ code: "CONTENT_ERROR", message: m })}
            onTextSelected={setSelection}
          />
          <WatermarkOverlay payload={watermark} night={night} />

          {selection && (
            <div className="absolute left-1/2 top-2 z-40 -translate-x-1/2 rounded-lg border border-border bg-surface p-1 shadow-lg">
              <Button size="sm" onClick={() => void onHighlight()}>
                ✎ Belgilash ({selection.page}-bet)
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelection(null)}>
                ✕
              </Button>
            </div>
          )}

          {toast && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-black/80 px-3 py-1.5 text-sm text-white">
              {toast}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
