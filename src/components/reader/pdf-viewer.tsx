"use client";

/**
 * PDF.js asosidagi reader.
 *  - Hujjat `openProtectedPdf` orqali ochiladi: bo'laklar Range so'rovlari bilan,
 *    Bearer + avtomatik refresh (lib/reader/range-transport.ts).
 *  - Ikki rejim (S-29=C): "scroll" — uzluksiz; "page" — varaqlash (bitta sahifa,
 *    ekranga sig'adi, oldingi/keyingi, swipe).
 *  - Sahifalar IntersectionObserver bilan faqat ko'rinish yaqinida render qilinadi.
 *  - Har sahifada matn qatlami (tanlash, highlight) va highlight overlay qatlami.
 *  - Nusxalash cheklovi (S-41): copy/cut/drag hodisalari bloklanadi; tanlash
 *    highlight uchun ochiq qoladi.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { loadPdfJs, openProtectedPdf } from "@/lib/reader/range-transport";
import { getHighlightRects, normalizeColor, rectsFromSelection, type HighlightRect } from "@/lib/reader/highlights";
import type { Annotation } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { useT } from "@/i18n";

export type ViewMode = "scroll" | "page";

export interface PdfViewerHandle {
  goToPage: (page: number) => void;
}

export interface TextSelection {
  page: number;
  text: string;
  /** Toolbar joylashuvi uchun (viewport koordinatalari) */
  x: number;
  y: number;
  /** Sahifaga nisbatan ulush-koordinatalar (highlight uchun) */
  rects: HighlightRect[];
}

export interface PdfViewerProps {
  articleId: string;
  initialPage?: number;
  /** 1 = ekranga moslash; 1.5 = 150% */
  zoom: number;
  night: boolean;
  mode: ViewMode;
  /** Sahifa ustida chiziladigan highlight'lar (type=HIGHLIGHT) */
  highlights?: Annotation[];
  onReady?: (info: { pageCount: number; size: number }) => void;
  onPageChange?: (page: number) => void;
  /** `error` — asl xato (ApiError bo'lsa kod bo'yicha xabar ko'rsatish uchun) */
  onError?: (message: string, error?: unknown) => void;
  onTextSelected?: (sel: TextSelection | null) => void;
  onProgress?: (loaded: number, total: number) => void;
}

const RENDER_MARGIN = "150% 0px";
const PAGE_GAP = 16;
const MAX_PAGE_WIDTH = 1100;
const SWIPE_MIN_X = 60;
const SWIPE_MAX_Y = 50;

interface PageHighlight {
  id: string;
  color: string;
  rects: HighlightRect[];
}

export const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer(
  { articleId, initialPage = 1, zoom, night, mode, highlights, onReady, onPageChange, onError, onTextSelected, onProgress },
  ref,
) {
  const { t } = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const destroyRef = useRef<(() => void) | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [baseWidth, setBaseWidth] = useState(0); // scale=1 dagi sahifa kengligi (pt)
  const [aspect, setAspect] = useState(1.4142);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  // Joriy sahifa: scroll rejimida scroll'dan, page rejimida navigatsiyadan yangilanadi
  const [pageNo, setPageNo] = useState(initialPage);
  const currentPageRef = useRef(initialPage);

  // ---- Hujjatni ochish
  useEffect(() => {
    let cancelled = false;
    openProtectedPdf(articleId, (loaded, total) => {
      setLoadProgress({ loaded, total });
      onProgress?.(loaded, total);
    })
      .then(async ({ doc, destroy }) => {
        if (cancelled) {
          destroy();
          return;
        }
        docRef.current = doc;
        destroyRef.current = destroy;
        const first = await doc.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        setBaseWidth(vp.width);
        setAspect(vp.height / vp.width);
        setPageCount(doc.numPages);
        onReady?.({ pageCount: doc.numPages, size: 0 });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        onError?.(e instanceof Error ? e.message : t("reader.openFailed"), e);
      });
    return () => {
      cancelled = true;
      destroyRef.current?.();
      destroyRef.current = null;
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat articleId o'zgarganda qayta ochiladi
  }, [articleId]);

  // ---- Konteyner o'lchami
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // Yashirin holat (display:none — @media print) o'tkazib yuboriladi: masshtab o'zgarmasin
      if (width > 0 && height > 0) setBox({ w: width, h: height });
    });
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Scroll rejimi: kenglikka moslash; page rejimi: butun sahifa ekranga sig'adi
  const scale = useMemo(() => {
    if (!baseWidth || !box.w) return 1;
    const fitW = Math.min(box.w - 32, MAX_PAGE_WIDTH) / baseWidth;
    if (mode === "scroll" || !box.h) return fitW * zoom;
    const fitH = (box.h - 32) / (baseWidth * aspect);
    return Math.min(fitW, fitH) * zoom;
  }, [baseWidth, box, mode, aspect, zoom]);
  const pageWidth = Math.round(baseWidth * scale);
  const pageHeight = Math.round(pageWidth * aspect);
  const stride = pageHeight + PAGE_GAP;

  // ---- Highlight'larni sahifa bo'yicha guruhlash
  const highlightsByPage = useMemo(() => {
    const map = new Map<number, PageHighlight[]>();
    for (const a of highlights ?? []) {
      const rects = getHighlightRects(a);
      if (!rects.length || a.page === null) continue;
      const list = map.get(a.page) ?? [];
      list.push({ id: a.id, color: normalizeColor(a.color), rects });
      map.set(a.page, list);
    }
    return map;
  }, [highlights]);

  const setCurrent = useCallback(
    (p: number) => {
      if (p === currentPageRef.current) return;
      currentPageRef.current = p;
      setPageNo(p);
      onPageChange?.(p);
    },
    [onPageChange],
  );

  // ---- Joriy sahifani aniqlash (faqat scroll rejimi)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !pageCount || mode !== "scroll") return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const center = el.scrollTop + el.clientHeight / 3;
        setCurrent(Math.min(pageCount, Math.max(1, Math.floor(center / stride) + 1)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [pageCount, stride, mode, setCurrent]);

  const goToPage = useCallback(
    (page: number) => {
      const el = containerRef.current;
      if (!el || !pageCount) return;
      const p = Math.min(pageCount, Math.max(1, page));
      if (mode === "scroll") {
        el.scrollTo({ top: (p - 1) * stride, behavior: "auto" });
      } else {
        el.scrollTo({ top: 0, behavior: "auto" });
      }
      setCurrent(p);
    },
    [pageCount, stride, mode, setCurrent],
  );

  useImperativeHandle(ref, () => ({ goToPage }), [goToPage]);

  // Chop etish dialogi (display:none) scroll holatini yo'qotadi — yopilgach joriy sahifa tiklanadi
  useEffect(() => {
    let remembered = 0;
    const before = () => {
      remembered = currentPageRef.current;
    };
    const after = () => {
      if (remembered) requestAnimationFrame(() => goToPage(remembered));
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [goToPage]);

  // Joriy sahifani joyida ushlab turish: dastlabki ochilish (progress'dan davom etish),
  // rejim almashishi va zoom/o'lcham o'zgarishi (stride) — scroll rejimida sahifa boshiga suriladi
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !pageCount) return;
    el.scrollTo({ top: mode === "scroll" ? (currentPageRef.current - 1) * stride : 0, behavior: "auto" });
  }, [mode, stride, pageCount]);

  // ---- Matn tanlash → highlight taklifi
  useEffect(() => {
    if (!onTextSelected) return;
    const el = containerRef.current;
    if (!el) return;
    const onUp = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!sel || sel.isCollapsed || !text) {
        onTextSelected(null);
        return;
      }
      const node = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
      const pageEl = node?.closest<HTMLElement>("[data-page]");
      if (!pageEl) return;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      onTextSelected({
        page: Number(pageEl.dataset.page),
        text: text.slice(0, 2000),
        x: rect.left + rect.width / 2,
        y: rect.top,
        rects: rectsFromSelection(sel, pageEl),
      });
    };
    el.addEventListener("mouseup", onUp);
    el.addEventListener("touchend", onUp);
    return () => {
      el.removeEventListener("mouseup", onUp);
      el.removeEventListener("touchend", onUp);
    };
  }, [onTextSelected]);

  // ---- Swipe (page rejimi, mobil)
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s || mode !== "page") return;
    if (window.getSelection()?.toString()) return; // matn tanlanayotgan bo'lsa varaqlanmaydi
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < SWIPE_MIN_X || Math.abs(dy) > SWIPE_MAX_Y) return;
    goToPage(currentPageRef.current + (dx < 0 ? 1 : -1));
  };

  const block = (e: React.SyntheticEvent) => e.preventDefault();
  // Progress'dagi sahifa hujjatdan katta bo'lsa (fayl almashtirilgan) — oxirgi sahifa
  const shownPage = Math.min(pageNo, pageCount || pageNo);

  return (
    <div
      className={`relative h-full w-full ${night ? "reader-night bg-[#0b0d12]" : "bg-[#e9ebef]"}`}
      onContextMenu={block}
      onCopy={block}
      onCut={block}
      onDragStart={block}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div ref={containerRef} className="h-full w-full overflow-auto">
        {pageCount === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-muted">
            <Spinner />
            <p className="text-sm">
              {t("reader.loading")}
              {loadProgress && loadProgress.total > 0 && ` ${Math.round((loadProgress.loaded / loadProgress.total) * 100)}%`}
            </p>
          </div>
        )}

        {pageCount > 0 && mode === "scroll" && (
          <div className="mx-auto flex flex-col items-center py-4" style={{ width: pageWidth, gap: PAGE_GAP }}>
            {Array.from({ length: pageCount }, (_, i) => (
              <PdfPage
                key={i + 1}
                pageNumber={i + 1}
                docRef={docRef}
                scale={scale}
                width={pageWidth}
                height={pageHeight}
                highlights={highlightsByPage.get(i + 1)}
                label={t("common.pageN", { n: i + 1 })}
              />
            ))}
          </div>
        )}

        {pageCount > 0 && mode === "page" && (
          <div className="flex min-h-full items-center justify-center py-4">
            {/* key — sahifa almashganda toza render (rendered=false) */}
            <PdfPage
              key={shownPage}
              pageNumber={shownPage}
              docRef={docRef}
              scale={scale}
              width={pageWidth}
              height={pageHeight}
              highlights={highlightsByPage.get(shownPage)}
              label={t("common.pageN", { n: shownPage })}
            />
          </div>
        )}
      </div>

      {pageCount > 0 && mode === "page" && (
        <>
          <PageNavButton side="left" disabled={shownPage <= 1} onClick={() => goToPage(shownPage - 1)} label={t("reader.prevPage")} />
          <PageNavButton side="right" disabled={shownPage >= pageCount} onClick={() => goToPage(shownPage + 1)} label={t("reader.nextPage")} />
        </>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ */

function PageNavButton({ side, disabled, onClick, label }: { side: "left" | "right"; disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`absolute top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/90 text-lg text-text shadow-md backdrop-blur hover:bg-surface disabled:opacity-30 sm:flex ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}

function PdfPage({
  pageNumber,
  docRef,
  scale,
  width,
  height,
  highlights,
  label,
}: {
  pageNumber: number;
  docRef: React.RefObject<PDFDocumentProxy | null>;
  scale: number;
  width: number;
  height: number;
  highlights?: PageHighlight[];
  label: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (!e.isIntersecting) setRendered(false);
      },
      { rootMargin: RENDER_MARGIN },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) {
      // Uzoq sahifalar xotiradan bo'shatiladi
      const c = canvasRef.current;
      if (c) {
        c.width = 0;
        c.height = 0;
      }
      if (textRef.current) textRef.current.replaceChildren();
      return;
    }
    const doc = docRef.current;
    const canvas = canvasRef.current;
    const textDiv = textRef.current;
    if (!doc || !canvas || !textDiv) return;

    let cancelled = false;
    let task: RenderTask | null = null;
    let page: PDFPageProxy | null = null;

    (async () => {
      const pdfjs = await loadPdfJs();
      page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      task = page.render({ canvas, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      await task.promise;
      if (cancelled) return;
      textDiv.replaceChildren();
      textDiv.style.setProperty("--scale-factor", String(viewport.scale));
      const textLayer = new pdfjs.TextLayer({ textContentSource: await page.getTextContent(), container: textDiv, viewport });
      await textLayer.render();
      if (!cancelled) setRendered(true);
    })().catch((e: unknown) => {
      if ((e as { name?: string })?.name !== "RenderingCancelledException") console.error(`[reader] page ${pageNumber}`, e);
    });

    return () => {
      cancelled = true;
      task?.cancel();
      page?.cleanup();
    };
  }, [visible, docRef, pageNumber, scale]);

  return (
    <div
      ref={wrapRef}
      data-page={pageNumber}
      className="reader-page relative shrink-0 bg-white shadow-md"
      style={{ width, height }}
      aria-label={label}
    >
      <canvas ref={canvasRef} className="block" />
      {highlights && highlights.length > 0 && (
        <div className="highlightLayer pointer-events-none absolute inset-0" aria-hidden>
          {highlights.map((h) =>
            h.rects.map((r, i) => (
              <div
                key={`${h.id}-${i}`}
                style={{ left: `${r[0] * 100}%`, top: `${r[1] * 100}%`, width: `${r[2] * 100}%`, height: `${r[3] * 100}%`, background: h.color }}
              />
            )),
          )}
        </div>
      )}
      <div ref={textRef} className="textLayer" />
      {!rendered && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-gray-400">{pageNumber}</div>
      )}
    </div>
  );
}
