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
const FLIP_MS = 480;
/** Sahifaning chekka ulushi (chap/o'ng) — sichqoncha bilan "varaq burchagidan" ushlab sudrash zonasi */
const GRAB_EDGE = 0.14;

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
            onCommit={goToPage}
            renderPage={(n) => (
              <PdfPage pageNumber={n} docRef={docRef} scale={scale} width={pageWidth} height={pageHeight} highlights={highlightsByPage.get(n)} label={t("common.pageN", { n })} />
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

type FlipState = {
  /** 1 — oldinga (joriy varaq chapga ag'dariladi), -1 — orqaga (oldingi varaq chapdan qaytadi) */
  dir: 1 | -1;
  from: number;
  to: number;
  /** Ag'darilayotgan varaqning burchagi: oldinga 0 → -180, orqaga -180 → 0 */
  angle: number;
  /** CSS transition bilan yakuniga yetkazilmoqda (sudrash tugagan yoki avtomatik) */
  settling: boolean;
  /** Sudrash bilan boshqarilmoqda — transition yo'q */
  dragging: boolean;
  /** Tashqi navigatsiyadan (avtomatik) — keyingi kadrda yakuniga yuboriladi */
  auto?: boolean;
};

/**
 * Varaqlash sahnasi: joriy va qo'shni sahifalar bir joyda ustma-ust turadi (qo'shnilar oldindan render qilinadi),
 * varaq almashishi 3D `rotateY` bilan (kitob varag'i kabi, orqa tomoni oq). Boshqaruv:
 *  - tashqaridan `current` o'zgarsa (tugma, klaviatura, sahifa raqami, TOC) — avtomatik animatsiya;
 *  - sichqoncha: sahifaning chap/o'ng chekkasidan yoki fondan ushlab sudrash (varaq kursorga ergashadi, yarmidan
 *    o'tsa/tez tortilsa varaqlanadi, aks holda qaytadi); fonning chap/o'ng qismini bosish — oldingi/keyingi;
 *  - sensor: istalgan joydan swipe (matn tanlanmagan bo'lsa).
 * Matn tanlash (highlight) sahifa o'rtasida oddiy ishlaydi — u yerda sudrash boshlanmaydi.
 */
function FlipStage({
  current,
  pageCount,
  width,
  height,
  onCommit,
  renderPage,
  labels,
}: {
  current: number;
  pageCount: number;
  width: number;
  height: number;
  onCommit: (page: number) => void;
  renderPage: (n: number) => React.ReactNode;
  labels: { prev: string; next: string };
}) {
  const [displayed, setDisplayed] = useState(current);
  const [flip, setFlip] = useState<FlipState | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; t: number; lastX: number; lastT: number; dir: 0 | 1 | -1; type: string } | null>(null);
  const flipRef = useRef(flip);
  useLayoutEffect(() => {
    flipRef.current = flip;
  });

  // Tashqi navigatsiya: `current` o'zgardi, animatsiya yo'q → avtomatik varaqlash (boshlang'ich burchak render'da,
  // yakuniy burchak keyingi kadrda — transition ishlashi uchun)
  if (current !== displayed && !flip) {
    const dir: 1 | -1 = current > displayed ? 1 : -1;
    setFlip({ dir, from: displayed, to: current, angle: dir === 1 ? 0 : -180, settling: false, dragging: false, auto: true });
  }
  useEffect(() => {
    if (!flip?.auto || flip.settling) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setFlip((f) => (f?.auto && !f.settling ? { ...f, angle: f.dir === 1 ? -180 : 0, settling: true } : f))));
    return () => cancelAnimationFrame(raf);
  }, [flip]);

  // Animatsiya yakuni: transition tugagach (yoki zaxira taymer) holatni yopamiz
  const finish = useCallback(
    (f: FlipState) => {
      const done = f.dir === 1 ? f.angle <= -180 : f.angle >= 0;
      const cancelled = f.dir === 1 ? f.angle >= 0 : f.angle <= -180;
      if (done) {
        setDisplayed(f.to);
        if (f.to !== current) onCommit(f.to);
      }
      if (done || cancelled) setFlip(null);
    },
    [current, onCommit],
  );
  useEffect(() => {
    if (!flip?.settling) return;
    const f = flip;
    const t = window.setTimeout(() => finish(f), FLIP_MS + 60); // transitionend kelmasa ham (masalan, reduced motion)
    return () => window.clearTimeout(t);
  }, [flip, finish]);

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
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), lastX: e.clientX, lastT: performance.now(), dir: 0, type: e.pointerType };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.dir === 0) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      const dir: 1 | -1 = dx < 0 ? 1 : -1;
      if (!canGo(dir)) {
        drag.current = null;
        return;
      }
      d.dir = dir;
      try {
        stageRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* sintetik pointer (test) — capture shart emas */
      }
      setFlip({ dir, from: displayed, to: targetOf(dir), angle: dir === 1 ? 0 : -180, settling: false, dragging: true });
    }
    d.lastX = e.clientX;
    d.lastT = performance.now();
    const frac = Math.max(0, Math.min(1, (d.dir === 1 ? -dx : dx) / Math.max(200, width * 0.85)));
    const angle = d.dir === 1 ? -180 * frac : -180 + 180 * frac;
    setFlip((f) => (f && f.dragging ? { ...f, angle } : f));
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
    const progress = f.dir === 1 ? -f.angle / 180 : (f.angle + 180) / 180;
    const fast = f.dir === 1 ? vx < -0.4 : vx > 0.4;
    const complete = progress > 0.45 || (fast && progress > 0.08);
    const endAngle = complete ? (f.dir === 1 ? -180 : 0) : f.dir === 1 ? 0 : -180;
    setFlip({ ...f, angle: endAngle, settling: true, dragging: false });
  };

  // Ko'rsatiladigan sahifalar: joriy ± 1 (oldindan render) + animatsiya nishoni
  const pages = Array.from(new Set([displayed - 1, displayed, displayed + 1, flip?.to ?? displayed])).filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const flipping = flip ? (flip.dir === 1 ? flip.from : flip.to) : null; // ag'darilayotgan varaq
  const under = flip ? (flip.dir === 1 ? flip.to : flip.from) : null; // ostida ko'rinadigan varaq
  // Ag'darilish darajasi (0 — tekis, 180 — to'liq ag'darilgan): soya va 90° dan keyin xiralashish
  const turned = flip ? Math.min(180, Math.abs(flip.dir === 1 ? flip.angle : flip.angle + 180)) : 0;
  const shade = Math.sin((turned / 180) * Math.PI);
  const leafOpacity = turned <= 90 ? 1 : Math.max(0.04, 1 - ((turned - 90) / 90) * 0.96);

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
      <div className="flip-book" style={{ width, height }}>
        {pages.map((n) => {
          const isFlipping = n === flipping;
          const isUnder = n === under;
          const visible = n === displayed || isFlipping || isUnder;
          const style: React.CSSProperties = {
            zIndex: isFlipping ? 3 : n === displayed && !flip ? 2 : isUnder ? 1 : 0,
            visibility: visible ? "visible" : "hidden",
            transform: isFlipping ? `rotateY(${flip!.angle}deg)` : "none",
            opacity: isFlipping ? leafOpacity : 1,
            transition: isFlipping && flip!.settling ? `transform ${FLIP_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${FLIP_MS}ms ease-in` : "none",
          };
          return (
            <div
              key={n}
              className={`flip-leaf ${isFlipping ? "is-flipping" : ""}`}
              style={style}
              data-leaf={n}
              onTransitionEnd={(e) => {
                if (e.propertyName === "transform" && isFlipping && flip?.settling) finish(flip);
              }}
            >
              <div className="face front">
                {renderPage(n)}
                {isFlipping && <div className="flip-shade" style={{ opacity: shade * 0.45 }} />}
              </div>
              <div className="face back" />
            </div>
          );
        })}
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
