"use client";

/**
 * PDF.js asosidagi reader.
 *  - Hujjat `openProtectedPdf` orqali ochiladi: bo'laklar Range so'rovlari bilan,
 *    Bearer + avtomatik refresh (lib/reader/range-transport.ts).
 *  - Ikki rejim (S-29=C): "scroll" — uzluksiz; "page" — varaqlash (bitta sahifa, ekranga sig'adi;
 *    `FlipStage`: 3D varaq animatsiyasi, sichqoncha bilan sudrab varaqlash, chekka zonalar, swipe).
 *  - Sahifalar IntersectionObserver bilan faqat ko'rinish yaqinida render qilinadi.
 *  - Har sahifada matn qatlami (tanlash, highlight) va highlight overlay qatlami.
 *  - Nusxalash cheklovi (S-41): copy/cut/drag hodisalari bloklanadi; tanlash
 *    highlight uchun ochiq qoladi.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { loadPdfJs, openProtectedPdf } from "@/lib/reader/range-transport";
import { getHighlightRects, normalizeColor, rectsFromClientRects, type HighlightRect } from "@/lib/reader/highlights";
import { drawCurl, edgeTable, progressForEdge } from "@/lib/reader/page-curl";
import { findTextRects } from "@/lib/reader/find-text";
import type { Annotation } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { useT } from "@/i18n";

export type ViewMode = "scroll" | "page";

export interface PdfViewerHandle {
  goToPage: (page: number) => void;
  /** Tanlovni bekor qilish (22.1 — o'z tanlov mexanizmi) */
  clearSelection: () => void;
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
  /** Qidiruv natijasi (17.5): shu sahifadagi mosliklar vaqtincha bo'rttiriladi; `nonce` — qayta bosilganda yangilash */
  searchHit?: { page: number; query: string; nonce: number } | null;
  /** Sahifadagi belgilangan joy bosildi (21.3) — rang almashtirish / o'chirish paneli uchun */
  onHighlightPick?: (id: string, x: number, y: number) => void;
  /** Suv belgisi matni — sahifa canvas'iga chiziladi (22.3: ekran suratida ham qoladi) */
  watermarkText?: string | null;
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
/** Qidiruv moslikari qancha vaqt ko'rinib turadi (CSS animatsiyasi bilan bir xil) */
const SEARCH_HIT_MS = 6000;
/** Sahifaning chekka ulushi (chap/o'ng) — sichqoncha bilan "varaq burchagidan" ushlab sudrash zonasi */
const GRAB_EDGE = 0.14;

interface PageHighlight {
  id: string;
  color: string;
  rects: HighlightRect[];
}

export const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer(
  { articleId, initialPage = 1, zoom, night, mode, highlights, searchHit, watermarkText, onReady, onPageChange, onError, onTextSelected, onProgress, onHighlightPick },
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

  /** Scroll rejimida: topilgan birinchi moslik ekran o'rtasiga keltiriladi */
  const onSearchRects = useCallback(
    (page: number, rects: HighlightRect[]) => {
      const el = containerRef.current;
      if (!el || mode !== "scroll" || !rects.length) return;
      const top = (page - 1) * stride + rects[0][1] * pageHeight;
      el.scrollTo({ top: Math.max(0, top - el.clientHeight / 3), behavior: "smooth" });
    },
    [mode, stride, pageHeight],
  );

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

  // O'z tanlov mexanizmi (22.1) holati
  const [pick, setPick] = useState<{ page: number; rects: HighlightRect[] } | null>(null);
  const clearSelection = useCallback(() => {
    setPick(null);
    onTextSelected?.(null);
  }, [onTextSelected]);
  useImperativeHandle(ref, () => ({ goToPage, clearSelection }), [goToPage, clearSelection]);

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

  // ---- Matn tanlash (22.1): brauzer tanlovi ISHLATILMAYDI — o'z mexanizmimiz.
  // Sabab: bufer (Ctrl/Cmd+C), Linux "primary selection", macOS "Look Up"/Services, sudrab tashlash va ekran
  // o'quvchilar hammasi brauzer tanloviga tayanadi. Biz sudrash bo'yicha Range quramiz, uni ekranda o'z
  // qatlamimizda ko'rsatamiz va faqat belgilash (highlight) uchun ishlatamiz — Selection bo'sh qoladi.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onTextSelected) return;

    type Caret = { node: Node; offset: number };
    const caretAt = (x: number, y: number, layer: Element): Caret | null => {
      const doc = document as Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      };
      let c: Caret | null = null;
      if (doc.caretRangeFromPoint) {
        const r = doc.caretRangeFromPoint(x, y);
        c = r ? { node: r.startContainer, offset: r.startOffset } : null;
      } else {
        const p = doc.caretPositionFromPoint?.(x, y);
        c = p ? { node: p.offsetNode, offset: p.offset } : null;
      }
      if (c && layer.contains(c.node) && c.node.nodeType === Node.TEXT_NODE) return c;
      // Zaxira: nuqta matn qatlamidan tashqarida (masalan, varaq ushlash zonasi ustida) — eng yaqin so'z
      let best: { node: Node; rect: DOMRect } | null = null;
      let bestD = Infinity;
      for (const sp of Array.from(layer.querySelectorAll("span"))) {
        const node = sp.firstChild;
        if (!node || node.nodeType !== Node.TEXT_NODE) continue;
        const r = sp.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
        const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = { node, rect: r };
        }
      }
      if (!best) return null;
      const len = best.node.textContent?.length ?? 0;
      const frac = Math.min(1, Math.max(0, (x - best.rect.left) / Math.max(1, best.rect.width)));
      return { node: best.node, offset: Math.round(frac * len) };
    };
    const rangeBetween = (layer: Element, a: Caret, b: Caret): Range | null => {
      if (!layer.contains(a.node) || !layer.contains(b.node)) return null;
      const pa = document.createRange();
      pa.setStart(a.node, a.offset);
      const pb = document.createRange();
      pb.setStart(b.node, b.offset);
      const fwd = pa.compareBoundaryPoints(Range.START_TO_START, pb) <= 0;
      const out = document.createRange();
      try {
        out.setStart(fwd ? a.node : b.node, fwd ? a.offset : b.offset);
        out.setEnd(fwd ? b.node : a.node, fwd ? b.offset : a.offset);
      } catch {
        return null;
      }
      return out.collapsed ? null : out;
    };

    let startPt: { x: number; y: number; id: number; page: HTMLElement } | null = null;
    let active = false;
    let timer = 0;

    const stop = () => {
      window.clearTimeout(timer);
      startPt = null;
      active = false;
      delete el.dataset.selecting;
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const pageEl = (e.target as HTMLElement)?.closest<HTMLElement>("[data-page]");
      if (!pageEl) return;
      startPt = { x: e.clientX, y: e.clientY, id: e.pointerId, page: pageEl };
      if (e.pointerType === "mouse") active = true;
      else {
        // Sensor: uzoq bosishdan keyin tanlov rejimi (aks holda varaqlash/scroll ishlaydi)
        timer = window.setTimeout(() => {
          active = true;
          el.dataset.selecting = "1";
        }, 350);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!startPt || e.pointerId !== startPt.id) return;
      if (!active) {
        if (Math.abs(e.clientX - startPt.x) > 8 || Math.abs(e.clientY - startPt.y) > 8) stop();
        return;
      }
      const layer = startPt.page.querySelector(".textLayer");
      if (!layer) return;
      const a = caretAt(startPt.x, startPt.y, layer);
      const b = caretAt(e.clientX, e.clientY, layer);
      if (!a || !b) return;
      const range = rangeBetween(layer, a, b);
      if (!range) return;
      if (e.pointerType !== "mouse") e.preventDefault();
      setPick({ page: Number(startPt.page.dataset.page), rects: rectsFromClientRects(Array.from(range.getClientRects()), startPt.page) });
    };
    const onUp = (e: PointerEvent) => {
      if (!startPt || e.pointerId !== startPt.id) {
        stop();
        return;
      }
      const page = startPt.page;
      const from = { x: startPt.x, y: startPt.y };
      const wasActive = active;
      stop();
      if (!wasActive) return;
      const layer = page.querySelector(".textLayer");
      const a = layer ? caretAt(from.x, from.y, layer) : null;
      const b = layer ? caretAt(e.clientX, e.clientY, layer) : null;
      const range = layer && a && b ? rangeBetween(layer, a, b) : null;
      const text = range?.toString().trim() ?? "";
      if (!range || !text) {
        setPick(null);
        onTextSelected(null);
        return;
      }
      const rects = rectsFromClientRects(Array.from(range.getClientRects()), page);
      const box = range.getBoundingClientRect();
      setPick({ page: Number(page.dataset.page), rects });
      onTextSelected({ page: Number(page.dataset.page), text: text.slice(0, 2000), x: box.left + box.width / 2, y: box.top, rects });
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove, { passive: false });
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", stop);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", stop);
      window.clearTimeout(timer);
    };
  }, [onTextSelected]);

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
                searchQuery={searchHit?.page === i + 1 ? searchHit.query : undefined}
                searchNonce={searchHit?.nonce}
                onSearchRects={onSearchRects}
                onHighlightPick={onHighlightPick}
                pickRects={pick?.page === i + 1 ? pick.rects : undefined}
                watermarkText={watermarkText}
                label={t("common.pageN", { n: i + 1 })}
              />
            ))}
          </div>
        )}

        {pageCount > 0 && mode === "page" && (
          <FlipStage
            current={shownPage}
            pageCount={pageCount}
            width={pageWidth}
            height={pageHeight}
            night={night}
            onCommit={goToPage}
            renderPage={(n) => (
              <PdfPage
                pageNumber={n}
                docRef={docRef}
                scale={scale}
                width={pageWidth}
                height={pageHeight}
                highlights={highlightsByPage.get(n)}
                searchQuery={searchHit?.page === n ? searchHit.query : undefined}
                searchNonce={searchHit?.nonce}
                onHighlightPick={onHighlightPick}
                pickRects={pick?.page === n ? pick.rects : undefined}
                watermarkText={watermarkText}
                label={t("common.pageN", { n })}
              />
            )}
            labels={{ prev: t("reader.prevPage"), next: t("reader.nextPage") }}
          />
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

type Flip = {
  /** 1 — oldinga (joriy varaq chapga ag'dariladi), -1 — orqaga (oldingi varaq chapdan qaytadi) */
  dir: 1 | -1;
  from: number;
  to: number;
  /** Sudrash bilan boshqarilmoqda */
  dragging: boolean;
  /** Tashqi navigatsiyadan (tugma, klaviatura, TOC) — keyingi kadrda o'zi yakuniga boradi */
  auto?: boolean;
};

/**
 * Varaqlash sahnasi (17): joriy va qo'shni sahifalar ustma-ust turadi (qo'shnilar oldindan render qilinadi).
 * Varaqlash paytida burilayotgan sahifa DOM'da yashiriladi va uning o'rniga `canvas` qatlamiga **egilgan qog'oz**
 * chiziladi (`drawCurl`): qog'oz umurtqadan tekis chiqadi, chekkasiga borib egiladi, 90° dan oshgan uchida orqa
 * tomoni ko'rinadi, ostidagi sahifaga soya tushadi. Qoplamadek 180° ag'darilmaydi.
 * Boshqaruv:
 *  - tashqaridan `current` o'zgarsa (tugma, klaviatura, sahifa raqami, TOC) — avtomatik animatsiya;
 *  - sichqoncha: sahifaning chekkasidan yoki fondan ushlab sudrash — varaq chekkasi kursorga aniq ergashadi,
 *    qo'yib yuborilganda tezlik va masofaga qarab varaqlanadi yoki joyiga qaytadi; fonni bosish — oldingi/keyingi;
 *  - sensor: istalgan joydan swipe (matn tanlanmagan bo'lsa).
 * Matn tanlash sahifa o'rtasida oddiy ishlaydi — u yerda sudrash boshlanmaydi.
 */
function FlipStage({
  current,
  pageCount,
  width,
  height,
  night,
  onCommit,
  renderPage,
  labels,
}: {
  current: number;
  pageCount: number;
  width: number;
  height: number;
  night: boolean;
  onCommit: (page: number) => void;
  renderPage: (n: number) => React.ReactNode;
  labels: { prev: string; next: string };
}) {
  const [displayed, setDisplayed] = useState(current);
  const [flip, setFlip] = useState<Flip | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(0);
  const rafRef = useRef(0);
  const flipRef = useRef<Flip | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; lastX: number; lastT: number; dir: 0 | 1 | -1; type: string } | null>(null);
  // `progress` ↔ varaq chekkasi jadvali (kursor ergashuvi uchun), sahifa kengligiga bog'liq
  const edgeTab = useMemo(() => (width > 0 ? edgeTable(width) : []), [width]);
  useLayoutEffect(() => {
    flipRef.current = flip;
  });

  const sheetOf = (f: Flip) => (f.dir === 1 ? f.from : f.to);
  const sourceCanvas = useCallback((n: number) => stageRef.current?.querySelector<HTMLCanvasElement>(`.flip-leaf[data-leaf="${n}"] canvas`) ?? null, []);

  // ---- Kadrni chizish
  const draw = useCallback(() => {
    const f = flipRef.current;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pxW = Math.round(width * dpr);
    const pxH = Math.round(height * dpr);
    if (cv.width !== pxW || cv.height !== pxH) {
      cv.width = pxW;
      cv.height = pxH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!f) return;
    const src = sourceCanvas(sheetOf(f));
    if (!src || !src.width) return;
    drawCurl({ ctx, src, srcW: src.width, srcH: src.height, w: width, h: height, progress: progressRef.current, night });
  }, [width, height, night, sourceCanvas]);

  const setProgress = useCallback(
    (p: number) => {
      progressRef.current = Math.max(0, Math.min(1, p));
      stageRef.current?.style.setProperty("--flip-progress", progressRef.current.toFixed(3));
      if (stageRef.current) stageRef.current.dataset.progress = progressRef.current.toFixed(2);
      draw();
    },
    [draw],
  );

  const stop = useCallback((f: Flip, done: boolean) => {
    cancelAnimationFrame(rafRef.current);
    if (done) {
      setDisplayed(f.to);
      if (f.to !== current) onCommit(f.to);
    }
    setFlip(null);
    flipRef.current = null;
    progressRef.current = 0;
    const st = stageRef.current;
    if (st) delete st.dataset.progress;
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (cv && ctx) ctx.clearRect(0, 0, cv.width, cv.height);
  }, [current, onCommit]);

  /** Varaqni tabiiy tugashga yuborish: masofa va tezlikka qarab davomiylik, easeOutCubic */
  const animateTo = useCallback(
    (target: 0 | 1, speed = 0) => {
      const f = flipRef.current;
      if (!f) return;
      const start = progressRef.current;
      const dist = target - start;
      if (Math.abs(dist) < 0.002) {
        stop(f, target === (f.dir === 1 ? 1 : 0));
        return;
      }
      const dur = Math.max(170, Math.min(560, 200 + Math.abs(dist) * 420 - Math.min(180, speed * 260)));
      const t0 = performance.now();
      cancelAnimationFrame(rafRef.current);
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        setProgress(start + dist * (1 - Math.pow(1 - k, 3)));
        if (k < 1) rafRef.current = requestAnimationFrame(step);
        else stop(f, target === (f.dir === 1 ? 1 : 0));
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [setProgress, stop],
  );

  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Tashqi navigatsiya (tugma, klaviatura, TOC): avtomatik varaqlash — holat render fazasida boshlanadi
  if (current !== displayed && !flip) {
    setFlip({ dir: current > displayed ? 1 : -1, from: displayed, to: current, dragging: false, auto: true });
  }
  useEffect(() => {
    if (!flip?.auto) return;
    const f = flip;
    const raf = requestAnimationFrame(() => {
      const src = sourceCanvas(f.dir === 1 ? f.from : f.to);
      if (reduced() || !src || !src.width) {
        stop(f, true); // animatsiyasiz (reduced motion yoki sahifa hali render bo'lmagan)
        return;
      }
      flipRef.current = f;
      setProgress(f.dir === 1 ? 0 : 1);
      animateTo(f.dir === 1 ? 1 : 0);
    });
    return () => cancelAnimationFrame(raf);
  }, [flip, animateTo, setProgress, sourceCanvas, stop]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  // O'lcham/mavzu o'zgarsa — joriy kadrni qayta chizamiz
  useEffect(() => {
    if (flipRef.current) draw();
  }, [draw]);

  const targetOf = (dir: 1 | -1) => displayed + dir;
  const canGo = (dir: 1 | -1) => targetOf(dir) >= 1 && targetOf(dir) <= pageCount;

  // ---- Sudrash (pointer events: sichqoncha, sensor, qalam)
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || flipRef.current) return;
    const stage = stageRef.current;
    if (!stage) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a")) return;
    if (e.pointerType === "mouse") {
      // Sahifa o'rtasi — matn tanlash uchun; chekka ulushi yoki fon — varaq ushlash zonasi
      const pageEl = target.closest<HTMLElement>(".reader-page");
      if (pageEl) {
        const r = pageEl.getBoundingClientRect();
        const fx = (e.clientX - r.left) / r.width;
        if (fx > GRAB_EDGE && fx < 1 - GRAB_EDGE) return;
      }
      e.preventDefault(); // matn tanlash boshlanmasin
    } else if (stageRef.current?.closest("[data-selecting]")) return; // sensorli tanlov faol
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastT: performance.now(), dir: 0, type: e.pointerType };
  };

  /** Kursor x'idan varaq chekkasi → progress (varaq barmoq ortidan keladi) */
  const progressFromPointer = (clientX: number) => {
    const book = stageRef.current?.querySelector(".flip-book")?.getBoundingClientRect();
    if (!book) return 0;
    return progressForEdge(edgeTab, Math.max(0, Math.min(width, clientX - book.left)));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (stageRef.current?.closest("[data-selecting]")) {
      drag.current = null; // matn tanlanmoqda — varaqlash boshlanmaydi
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.dir === 0) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      const dir: 1 | -1 = dx < 0 ? 1 : -1;
      const sheet = dir === 1 ? displayed : targetOf(dir);
      if (!canGo(dir) || !sourceCanvas(sheet)?.width) {
        drag.current = null;
        return;
      }
      d.dir = dir;
      try {
        stageRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* sintetik pointer (test) — capture shart emas */
      }
      const f: Flip = { dir, from: displayed, to: targetOf(dir), dragging: true };
      flipRef.current = f;
      setFlip(f);
      setProgress(dir === 1 ? 0 : 1);
    }
    d.lastX = e.clientX;
    d.lastT = performance.now();
    setProgress(progressFromPointer(e.clientX));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.dir === 0) {
      // Bosish (sudrashsiz): fonning chap/o'ng qismi — oldingi/keyingi (faqat sichqoncha)
      if (d.type === "mouse" && !(e.target as HTMLElement).closest(".reader-page")) {
        const r = stageRef.current?.getBoundingClientRect();
        if (r) {
          const dir: 1 | -1 = e.clientX < r.left + r.width / 2 ? -1 : 1;
          if (canGo(dir)) onCommit(targetOf(dir));
        }
      }
      return;
    }
    const f = flipRef.current;
    if (!f) return;
    const dt = Math.max(1, performance.now() - d.lastT);
    const vx = (e.clientX - d.lastX) / dt; // px/ms
    const p = progressRef.current;
    // Oldinga: progress 1 ga yaqinlashsa tugaydi; orqaga: 0 ga
    const done = f.dir === 1 ? p : 1 - p;
    const fast = f.dir === 1 ? vx < -0.4 : vx > 0.4;
    const slow = f.dir === 1 ? vx > 0.4 : vx < -0.4;
    const complete = !slow && (done > 0.45 || (fast && done > 0.08));
    setFlip({ ...f, dragging: false, auto: false });
    animateTo(complete ? (f.dir === 1 ? 1 : 0) : f.dir === 1 ? 0 : 1, Math.abs(vx));
  };

  // Ko'rsatiladigan sahifalar: joriy ± 1 (oldindan render) + animatsiya nishoni
  const pages = Array.from(new Set([displayed - 1, displayed, displayed + 1, flip?.to ?? displayed])).filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const sheet = flip ? sheetOf(flip) : null; // canvas'da chiziladi — DOM'da yashirin
  const under = flip ? (flip.dir === 1 ? flip.to : flip.from) : null;

  return (
    <div
      ref={stageRef}
      className={`flip-stage ${flip?.dragging ? "is-dragging" : ""}`}
      style={{ minHeight: "100%", ["--page-w" as string]: `${width}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      data-testid="flip-stage"
      data-flipping={flip ? "1" : undefined}
    >
      <div className="flip-zone left" aria-hidden data-can={canGo(-1) ? "1" : "0"} title={labels.prev} />
      <div className="flip-zone right" aria-hidden data-can={canGo(1) ? "1" : "0"} title={labels.next} />
      <div className="flip-book" style={{ width, height }} data-stack={pageCount > 1 ? "1" : undefined}>
        {pages.map((n) => {
          const isSheet = n === sheet;
          const visible = !flip ? n === displayed : n === under;
          return (
            <div
              key={n}
              className={`flip-leaf ${isSheet ? "is-flipping" : ""}`}
              style={{ zIndex: visible ? 2 : 1, visibility: visible ? "visible" : "hidden" }}
              data-leaf={n}
            >
              <div className="face front">{renderPage(n)}</div>
            </div>
          );
        })}
        <canvas ref={canvasRef} className="flip-canvas" style={{ width, height, display: flip ? "block" : "none" }} aria-hidden data-testid="flip-canvas" />
      </div>
    </div>
  );
}

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
  searchQuery,
  searchNonce,
  onSearchRects,
  onHighlightPick,
  pickRects,
  watermarkText,
  label,
}: {
  pageNumber: number;
  docRef: React.RefObject<PDFDocumentProxy | null>;
  scale: number;
  width: number;
  height: number;
  highlights?: PageHighlight[];
  /** Vaqtincha bo'rttiriladigan qidiruv so'zi (17.5) */
  searchQuery?: string;
  searchNonce?: number;
  onSearchRects?: (page: number, rects: HighlightRect[]) => void;
  /** Belgilangan joy bosildi (21.3) */
  onHighlightPick?: (id: string, x: number, y: number) => void;
  /** Foydalanuvchi sudrab tanlagan joy (22.1 — brauzer tanlovi o'rniga) */
  pickRects?: HighlightRect[];
  /** Canvas ichiga chiziladigan suv belgisi (22.3) */
  watermarkText?: string | null;
  label: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [found, setFound] = useState<HighlightRect[] | null>(null);

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
      // 22.3: suv belgisi sahifa piksellariga chiziladi — ekran suratida ham qoladi,
      // DOM'dan o'chirib tashlab bo'lmaydi
      if (watermarkText) drawWatermark(canvas, watermarkText, dpr);
      textDiv.replaceChildren();
      // pdfjs-dist 6: matn qatlami o'lchamlari shu o'zgaruvchidan hisoblanadi (bo'lmasa matn canvas bilan mos kelmaydi)
      textDiv.style.setProperty("--total-scale-factor", String(viewport.scale));
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
  }, [visible, docRef, pageNumber, scale, watermarkText]);

  // ---- Qidiruv natijasi: matn qatlamidan mosliklarni topib, vaqtincha bo'rttiramiz (CSS bilan so'nadi)
  useEffect(() => {
    if (!rendered || !searchQuery || !textRef.current || !wrapRef.current) {
      setFound(null);
      return;
    }
    const rects = findTextRects(textRef.current, wrapRef.current, searchQuery);
    setFound(rects.length ? rects : null);
    if (rects.length) onSearchRects?.(pageNumber, rects);
    const timer = window.setTimeout(() => setFound(null), SEARCH_HIT_MS + 400);
    return () => window.clearTimeout(timer);
  }, [rendered, searchQuery, searchNonce, pageNumber, onSearchRects, scale]);

  /** Bosilgan nuqta belgilangan joyga tushdimi? (matn qatlami ustida bo'lgani uchun klik shu yerda tekshiriladi) */
  function pickHighlight(e: React.MouseEvent<HTMLDivElement>) {
    if (!onHighlightPick || !highlights?.length) return;
    if (pickRects?.length) return; // matn tanlangan — avval tanlov paneli
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    const fx = (e.clientX - box.left) / box.width;
    const fy = (e.clientY - box.top) / box.height;
    const pad = 0.004;
    for (const h of highlights) {
      for (const r of h.rects) {
        if (fx >= r[0] - pad && fx <= r[0] + r[2] + pad && fy >= r[1] - pad && fy <= r[1] + r[3] + pad) {
          onHighlightPick(h.id, e.clientX, e.clientY);
          return;
        }
      }
    }
  }

  return (
    <div
      ref={wrapRef}
      data-page={pageNumber}
      className="reader-page relative shrink-0 bg-white shadow-md"
      style={{ width, height }}
      aria-label={label}
      onClick={pickHighlight}
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
      {pickRects && pickRects.length > 0 && (
        <div className="pickLayer pointer-events-none absolute inset-0" aria-hidden data-testid="pick-rects">
          {pickRects.map((r, i) => (
            <div key={i} style={{ left: `${r[0] * 100}%`, top: `${r[1] * 100}%`, width: `${r[2] * 100}%`, height: `${r[3] * 100}%` }} />
          ))}
        </div>
      )}
      {found && (
        <div className="searchLayer pointer-events-none absolute inset-0" aria-hidden data-testid="search-hits" key={searchNonce}>
          {found.map((r, i) => (
            <div key={i} style={{ left: `${r[0] * 100}%`, top: `${r[1] * 100}%`, width: `${r[2] * 100}%`, height: `${r[3] * 100}%` }} />
          ))}
        </div>
      )}
      {/* Matn qatlami faqat tanlash/qidiruv geometriyasi uchun — ekran o'quvchilarga berilmaydi (22.2) */}
      <div ref={textRef} className="textLayer" aria-hidden="true" role="presentation" />
      {!rendered && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-gray-400">{pageNumber}</div>
      )}
    </div>
  );
}

/** Sahifa canvas'iga diagonal plitka ko'rinishidagi suv belgisi (22.3) */
function drawWatermark(canvas: HTMLCanvasElement, text: string, dpr: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = "#101010";
  // Canvas CSS o'zgaruvchilarini tushunmaydi — aniq shrift ro'yxati
  ctx.font = `600 ${Math.max(11, Math.round(w / 62))}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const stepX = w / 2.2;
  const stepY = h / 7;
  for (let y = stepY / 2; y < h; y += stepY) {
    for (let x = stepX / 2, i = 0; x < w + stepX; x += stepX, i++) {
      ctx.save();
      ctx.translate(x + (Math.floor(y / stepY) % 2 ? stepX / 2 : 0), y);
      ctx.rotate((-22 * Math.PI) / 180);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}
