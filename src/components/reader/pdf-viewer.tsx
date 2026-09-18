"use client";

/**
 * PDF.js asosidagi uzluksiz (continuous) reader.
 *  - Hujjat `openProtectedPdf` orqali ochiladi: bo'laklar Range so'rovlari bilan,
 *    Bearer + avtomatik refresh (lib/reader/range-transport.ts).
 *  - Sahifalar IntersectionObserver bilan faqat ko'rinish yaqinida render qilinadi.
 *  - Har sahifada matn qatlami (tanlash, highlight) mavjud.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { loadPdfJs, openProtectedPdf } from "@/lib/reader/range-transport";
import { Spinner } from "@/components/ui";

export interface PdfViewerHandle {
  goToPage: (page: number) => void;
}

export interface PdfViewerProps {
  bookId: string;
  initialPage?: number;
  /** 1 = kenglikka moslash; 1.5 = 150% */
  zoom: number;
  night: boolean;
  onReady?: (info: { pageCount: number; size: number }) => void;
  onPageChange?: (page: number) => void;
  onError?: (message: string) => void;
  onTextSelected?: (sel: { page: number; text: string; x: number; y: number } | null) => void;
  onProgress?: (loaded: number, total: number) => void;
}

const RENDER_MARGIN = "150% 0px";

export const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer(
  { bookId, initialPage = 1, zoom, night, onReady, onPageChange, onError, onTextSelected, onProgress },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const destroyRef = useRef<(() => void) | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [baseWidth, setBaseWidth] = useState(0); // scale=1 dagi sahifa kengligi (pt)
  const [aspect, setAspect] = useState(1.4142);
  const [containerWidth, setContainerWidth] = useState(0);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const initialJumpDone = useRef(false);
  const currentPageRef = useRef(initialPage);

  // ---- Hujjatni ochish
  useEffect(() => {
    let cancelled = false;
    initialJumpDone.current = false;
    openProtectedPdf(bookId, (loaded, total) => {
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
        onError?.(e instanceof Error ? e.message : "Kitobni ochib bo'lmadi");
      });
    return () => {
      cancelled = true;
      destroyRef.current?.();
      destroyRef.current = null;
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat bookId o'zgarganda qayta ochiladi
  }, [bookId]);

  // ---- Konteyner kengligi
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const scale = baseWidth && containerWidth ? (Math.min(containerWidth - 32, 1100) / baseWidth) * zoom : 1;
  const pageWidth = Math.round(baseWidth * scale);
  const pageHeight = Math.round(pageWidth * aspect);

  // ---- Joriy sahifani aniqlash (scroll)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !pageCount) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const center = el.scrollTop + el.clientHeight / 3;
        const stride = pageHeight + 16;
        const page = Math.min(pageCount, Math.max(1, Math.floor(center / stride) + 1));
        if (page !== currentPageRef.current) {
          currentPageRef.current = page;
          onPageChange?.(page);
        }
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [pageCount, pageHeight, onPageChange]);

  const goToPage = useCallback(
    (page: number) => {
      const el = containerRef.current;
      if (!el || !pageCount) return;
      const p = Math.min(pageCount, Math.max(1, page));
      el.scrollTo({ top: (p - 1) * (pageHeight + 16), behavior: "auto" });
      currentPageRef.current = p;
      onPageChange?.(p);
    },
    [pageCount, pageHeight, onPageChange],
  );

  useImperativeHandle(ref, () => ({ goToPage }), [goToPage]);

  // Dastlabki sahifaga o'tish (progress'dan davom etish)
  useEffect(() => {
    if (!pageCount || !pageHeight || initialJumpDone.current) return;
    initialJumpDone.current = true;
    if (initialPage > 1) goToPage(initialPage);
  }, [pageCount, pageHeight, initialPage, goToPage]);

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
      onTextSelected({ page: Number(pageEl.dataset.page), text: text.slice(0, 2000), x: rect.left + rect.width / 2, y: rect.top });
    };
    el.addEventListener("mouseup", onUp);
    el.addEventListener("touchend", onUp);
    return () => {
      el.removeEventListener("mouseup", onUp);
      el.removeEventListener("touchend", onUp);
    };
  }, [onTextSelected]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-auto ${night ? "reader-night bg-[#0b0d12]" : "bg-[#e9ebef]"}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {pageCount === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-muted">
          <Spinner />
          <p className="text-sm">
            Kitob yuklanmoqda…
            {loadProgress && loadProgress.total > 0 && ` ${Math.round((loadProgress.loaded / loadProgress.total) * 100)}%`}
          </p>
        </div>
      )}
      {pageCount > 0 && (
        <div className="mx-auto flex flex-col items-center gap-4 py-4" style={{ width: pageWidth }}>
          {Array.from({ length: pageCount }, (_, i) => (
            <PdfPage key={i + 1} pageNumber={i + 1} docRef={docRef} scale={scale} width={pageWidth} height={pageHeight} />
          ))}
        </div>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ */

function PdfPage({
  pageNumber,
  docRef,
  scale,
  width,
  height,
}: {
  pageNumber: number;
  docRef: React.RefObject<PDFDocumentProxy | null>;
  scale: number;
  width: number;
  height: number;
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
      aria-label={`${pageNumber}-bet`}
    >
      <canvas ref={canvasRef} className="block" />
      <div ref={textRef} className="textLayer" />
      {!rendered && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-gray-400">{pageNumber}</div>
      )}
    </div>
  );
}
