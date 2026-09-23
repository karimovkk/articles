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
import { getHighlightRects, normalizeColor, rectsFromSelection, type HighlightRect } from "@/lib/reader/highlights";
import { drawCurl, edgeTable, progressForEdge } from "@/lib/reader/page-curl";
import { findTextRects } from "@/lib/reader/find-text";
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
  /** Qidiruv natijasi (17.5): shu sahifadagi mosliklar vaqtincha bo'rttiriladi; `nonce` — qayta bosilganda yangilash */
  searchHit?: { page: number; query: string; nonce: number } | null;
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
  { articleId, initialPage = 1, zoom, night, mode, highlights, searchHit, onReady, onPageChange, onError, onTextSelected, onProgress },
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
    } else if (window.getSelection()?.toString()) return;
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
  }, [visible, docRef, pageNumber, scale]);

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
      {found && (
        <div className="searchLayer pointer-events-none absolute inset-0" aria-hidden data-testid="search-hits" key={searchNonce}>
          {found.map((r, i) => (
            <div key={i} style={{ left: `${r[0] * 100}%`, top: `${r[1] * 100}%`, width: `${r[2] * 100}%`, height: `${r[3] * 100}%` }} />
          ))}
        </div>
      )}
      <div ref={textRef} className="textLayer" />
      {!rendered && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-gray-400">{pageNumber}</div>
      )}
    </div>
  );
}
