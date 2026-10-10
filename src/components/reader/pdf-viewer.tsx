"use client";

/**
 * PDF.js asosidagi reader.
 *  - Hujjat `openProtectedPdf` orqali ochiladi: bo'laklar Range so'rovlari bilan,
 *    Bearer + avtomatik refresh (lib/reader/range-transport.ts).
 *  - Uch rejim (S-29=C, 32B): "scroll" — uzluksiz; "page" — varaqlash (bitta sahifa, ekranga sig'adi;
 *    `FlipStage`: 3D varaq animatsiyasi, sichqoncha bilan sudrab varaqlash, chekka zonalar, swipe);
 *    "spread" — kitob: ikki sahifa yonma-yon, 180° varaqlash (`SpreadStage`); tor ekranda "page" ga tushadi.
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
import { SpreadStage, lastOf, leftOf, spreadOf } from "./spread-stage";
import type { Annotation } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { useT } from "@/i18n";

export type ViewMode = "scroll" | "page" | "spread";

export interface PdfViewerHandle {
  goToPage: (page: number) => void;
  /** Rejimga mos bir qadam: scroll/varaq — 1 sahifa, kitob — 1 juft (32B) */
  step: (dir: 1 | -1) => void;
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
  /** 33.3: lug'at so'zlari — PDF'da nuqtali chiziq bilan belgilanadi; bosilsa tarjima oynasi */
  vocabMarks?: Array<{ id: string; page: number | null; rects: HighlightRect[] }>;
  onVocabPick?: (id: string, x: number, y: number) => void;
  /** Suv belgisi matni — sahifa canvas'iga chiziladi (22.3: ekran suratida ham qoladi) */
  watermarkText?: string | null;
  onReady?: (info: { pageCount: number; size: number }) => void;
  onPageChange?: (page: number) => void;
  /**
   * 53: o'quvchi maqola oxiriga yetdi — scroll rejimida hujjat pastiga, varaq/kitob rejimida oxirgi sahifaga. Faqat
   * o'quvchining o'z harakatidan keyin (g'ildirak, teginish, klavish, bosish) — saqlangan joydan (oxirgi bet) ochilganda
   * o'z-o'zidan chaqirilmaydi. Har safar oxirga "kirganda" bir marta.
   */
  onReachEnd?: () => void;
  /** `error` — asl xato (ApiError bo'lsa kod bo'yicha xabar ko'rsatish uchun) */
  onError?: (message: string, error?: unknown) => void;
  onTextSelected?: (sel: TextSelection | null) => void;
  onProgress?: (loaded: number, total: number) => void;
  /** Kitob rejimi (ikki sahifa) shu o'lchamda sig'adimi — rejim almashtirgich uchun (32B) */
  onSpreadAvailable?: (ok: boolean) => void;
  /** 71: telefonda ikki barmoq bilan zoom / ikki marta tegish — yangi masshtab (`minZoom`…`maxZoom`) */
  onZoomChange?: (zoom: number) => void;
  minZoom?: number;
  maxZoom?: number;
}

const RENDER_MARGIN = "150% 0px";
const PAGE_GAP = 16;
const MAX_PAGE_WIDTH = 1100;
/** Qidiruv moslikari qancha vaqt ko'rinib turadi (CSS animatsiyasi bilan bir xil) */
const SEARCH_HIT_MS = 6000;
/** Kitob rejimi: konteyner shu kenglikdan tor yoki portret bo'lsa — bitta varaqqa tushadi */
const SPREAD_MIN_W = 860;
/** Scroll rejimida sahifalar ustidagi bo'shliq (`py-4`) */
const SCROLL_PAD = 16;
/** 71: bitta canvas piksellari chegarasi (iOS ~16.7M) — katta zoom'da aniqlik shu chegaragacha */
const MAX_CANVAS_PX = 12_000_000;
const canvasRatio = (w: number, h: number) => Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_CANVAS_PX / Math.max(1, w * h)));
/** 71: sensorli tanlov — shuncha ushlab turilsa va barmoq qimirlamasa boshlanadi */
const LONG_PRESS_MS = 500;
const LONG_PRESS_TOLERANCE = 8;
/** So'z chegarasi (lotin/kirill harflari, raqamlar, apostrof, defis) */
const WORD_CHAR = /[\p{L}\p{N}'’ʻʼ-]/u;

interface PageHighlight {
  id: string;
  color: string;
  rects: HighlightRect[];
}

export const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer(
  { articleId, initialPage = 1, zoom, night, mode: requestedMode, highlights, searchHit, watermarkText, onReady, onPageChange, onReachEnd, onError, onTextSelected, onProgress, onHighlightPick, onSpreadAvailable, vocabMarks, onVocabPick, onZoomChange, minZoom = 0.6, maxZoom = 3 },
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

  // 32B: kitob rejimi faqat keng va yotiq konteynerda — aks holda bitta varaq
  const spreadFits = box.w >= SPREAD_MIN_W && box.w > box.h;
  const mode: ViewMode = requestedMode === "spread" && !spreadFits ? "page" : requestedMode;
  useEffect(() => {
    if (box.w) onSpreadAvailable?.(spreadFits);
  }, [spreadFits, box.w, onSpreadAvailable]);

  // Scroll rejimi: kenglikka moslash; page rejimi: butun sahifa ekranga sig'adi; kitob: ikki sahifa sig'adi
  const scale = useMemo(() => {
    if (!baseWidth || !box.w) return 1;
    const fitW = Math.min(box.w - 32, MAX_PAGE_WIDTH) / baseWidth;
    if (mode === "scroll" || !box.h) return fitW * zoom;
    const fitH = (box.h - 32) / (baseWidth * aspect);
    if (mode === "spread") return Math.min((box.w - 48) / (2 * baseWidth), fitH) * zoom;
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

  // 33.3: lug'at belgilari sahifa bo'yicha
  const vocabByPage = useMemo(() => {
    const map = new Map<number, Array<{ id: string; rects: HighlightRect[] }>>();
    for (const v of vocabMarks ?? []) {
      if (v.page == null || !v.rects.length) continue;
      const list = map.get(v.page) ?? [];
      list.push({ id: v.id, rects: v.rects });
      map.set(v.page, list);
    }
    return map;
  }, [vocabMarks]);

  // 53: oxirga yetish — faqat o'quvchi harakatidan keyin; `atEnd` — oxirgi holat (qayta-qayta chaqirilmasin)
  const interacted = useRef(false);
  const atEnd = useRef(false);
  const onReachEndRef = useRef(onReachEnd);
  const endInfo = useRef({ mode: "scroll" as ViewMode, pageCount: 0 });
  useLayoutEffect(() => {
    onReachEndRef.current = onReachEnd;
    endInfo.current = { mode, pageCount };
  });
  useEffect(() => {
    const mark = () => {
      interacted.current = true;
    };
    const evs = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    evs.forEach((e) => window.addEventListener(e, mark, { passive: true, capture: true }));
    return () => evs.forEach((e) => window.removeEventListener(e, mark, { capture: true }));
  }, []);
  const reportEnd = useCallback((reached: boolean) => {
    if (reached && !atEnd.current && interacted.current) onReachEndRef.current?.();
    atEnd.current = reached;
  }, []);

  const setCurrent = useCallback(
    (p: number) => {
      if (p === currentPageRef.current) return;
      currentPageRef.current = p;
      setPageNo(p);
      onPageChange?.(p);
      // Varaq/kitob rejimi: oxirgi sahifa (kitobda — oxirgi juft)
      const { mode: m, pageCount: n } = endInfo.current;
      if (m !== "scroll" && n > 0) reportEnd(p >= n - (m === "spread" ? 1 : 0));
    },
    [onPageChange, reportEnd],
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
        // 53: scroll rejimi — hujjat pastiga yetdi
        reportEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 40);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [pageCount, stride, mode, setCurrent, reportEnd]);

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
  const pickRef = useRef(pick);
  useLayoutEffect(() => {
    pickRef.current = pick;
  });
  const clearSelection = useCallback(() => {
    setPick(null);
    onTextSelected?.(null);
  }, [onTextSelected]);
  const step = useCallback(
    (dir: 1 | -1) => {
      const cur = currentPageRef.current;
      if (mode === "spread") {
        const s = spreadOf(cur, pageCount) + dir;
        if (s >= 1 && leftOf(s) <= pageCount) goToPage(lastOf(s, pageCount));
        return;
      }
      goToPage(cur + dir);
    },
    [mode, pageCount, goToPage],
  );
  useImperativeHandle(ref, () => ({ goToPage, step, clearSelection }), [goToPage, step, clearSelection]);

  // 32B: kitob rejimida joriy sahifa — juftda ko'rinib turgan eng katta sahifa (progress va "o'qildi" to'g'ri bo'lsin)
  useEffect(() => {
    if (mode !== "spread" || !pageCount) return;
    const want = lastOf(spreadOf(currentPageRef.current, pageCount), pageCount);
    if (want !== currentPageRef.current) setCurrent(want);
  }, [mode, pageCount, pageNo, setCurrent]);

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

  // Joriy sahifani joyida ushlab turish: dastlabki ochilish (progress'dan davom etish), rejim almashishi va
  // o'lcham va zoom o'zgarishi (stride; tugmalar, klaviatura) — scroll rejimida joriy sahifa boshiga suriladi.
  // 71: pinch / ikki marta tegish — barmoq ostidagi nuqta joyida qoladi (`anchorRef`)
  const geomRef = useRef({ zoom, mode, pageWidth, pageHeight, stride });
  const anchorRef = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  useLayoutEffect(() => {
    const el = containerRef.current;
    const prev = geomRef.current;
    geomRef.current = { zoom, mode, pageWidth, pageHeight, stride };
    if (!el || !pageCount) return;
    const a = anchorRef.current;
    anchorRef.current = null;
    if (a && prev.zoom !== zoom && prev.mode === mode && prev.pageWidth > 0 && prev.pageHeight > 0) {
      const W = el.clientWidth;
      if (mode === "scroll") {
        const off0 = Math.max(0, (W - prev.pageWidth) / 2);
        const off1 = Math.max(0, (W - pageWidth) / 2);
        const ux = (a.x - off0) / prev.pageWidth;
        const py = a.y - SCROLL_PAD;
        const idx = Math.min(pageCount - 1, Math.max(0, Math.floor(py / prev.stride)));
        const within = (py - idx * prev.stride) / prev.pageHeight;
        el.scrollTo({ left: ux * pageWidth + off1 - a.cx, top: SCROLL_PAD + idx * stride + within * pageHeight - a.cy, behavior: "auto" });
      } else {
        const r = zoom / prev.zoom;
        el.scrollTo({ left: a.x * r - a.cx, top: a.y * r - a.cy, behavior: "auto" });
      }
      return;
    }
    el.scrollTo({ top: mode === "scroll" ? (currentPageRef.current - 1) * stride : 0, behavior: "auto" });
  }, [mode, stride, pageCount, zoom, pageWidth, pageHeight]);

  // 71: telefonda ikki barmoq bilan zoom — brauzer butun sahifani (panel, tugmalar) emas, faqat kitobni kattalashtiradi.
  // Harakat paytida konteyner CSS transform bilan silliq kattalashadi/suriladi; barmoqlar ko'tarilgach yangi
  // masshtabda aniq chiziladi (`anchorRef` — nuqta joyida). Ikki marta tegish — 100% ↔ 175%.
  const zoomCbRef = useRef(onZoomChange);
  const zoomNowRef = useRef(zoom);
  useLayoutEffect(() => {
    zoomCbRef.current = onZoomChange;
    zoomNowRef.current = zoom;
  });
  const pillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let g: { d0: number; mx: number; my: number; ox: number; oy: number; z0: number; s: number; tx: number; ty: number } | null = null;
    let tap: { t: number; x: number; y: number; moved: boolean } | null = null;
    let lastTap: { t: number; x: number; y: number } | null = null;
    let hideTimer = 0;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
    const clampZ = (z: number) => Math.min(maxZoom, Math.max(minZoom, z));
    const pill = (z: number | null) => {
      const p = pillRef.current;
      if (!p) return;
      window.clearTimeout(hideTimer);
      if (z !== null) {
        p.textContent = `${Math.round(z * 100)}%`;
        p.classList.add("on");
      } else hideTimer = window.setTimeout(() => p.classList.remove("on"), 700);
    };

    const onStart = (e: TouchEvent) => {
      if (!zoomCbRef.current) return;
      if (e.touches.length === 2) {
        e.preventDefault();
        tap = null;
        lastTap = null;
        const r = el.getBoundingClientRect();
        const m = mid(e.touches);
        g = { d0: Math.max(10, dist(e.touches)), mx: m.x, my: m.y, ox: m.x - r.left, oy: m.y - r.top, z0: zoomNowRef.current, s: 1, tx: 0, ty: 0 };
        el.style.transformOrigin = `${g.ox}px ${g.oy}px`;
        el.style.willChange = "transform";
        el.dataset.pinching = "1";
        pill(g.z0);
      } else if (e.touches.length === 1 && !g) {
        tap = { t: e.timeStamp, x: e.touches[0].clientX, y: e.touches[0].clientY, moved: false };
      } else tap = null;
    };
    const onMove = (e: TouchEvent) => {
      // Uzoq bosib tanlash paytida — sahifa siljimaydi (touch-action o'rtada o'zgarmaydi, shuning uchun shu yerda)
      if (el.dataset.selecting && e.cancelable) e.preventDefault();
      if (tap && e.touches.length === 1 && Math.hypot(e.touches[0].clientX - tap.x, e.touches[0].clientY - tap.y) > 10) tap.moved = true;
      if (!g || e.touches.length !== 2) return;
      e.preventDefault();
      const m = mid(e.touches);
      g.s = clampZ(g.z0 * (dist(e.touches) / g.d0)) / g.z0;
      g.tx = m.x - g.mx;
      g.ty = m.y - g.my;
      el.style.transform = `translate(${g.tx}px, ${g.ty}px) scale(${g.s})`;
      pill(g.z0 * g.s);
    };
    const finish = () => {
      if (!g) return;
      const { z0, s, ox, oy, tx, ty } = g;
      g = null;
      el.style.transform = "";
      el.style.transformOrigin = "";
      el.style.willChange = "";
      delete el.dataset.pinching;
      pill(null);
      const z1 = Math.round(clampZ(z0 * s) * 100) / 100;
      if (Math.abs(z1 - z0) < 0.01) {
        // Faqat surildi (masshtab o'zgarmadi) — kontent barmoqlar qoldirgan joyda qoladi
        el.scrollBy({ left: -tx, top: -ty, behavior: "auto" });
        return;
      }
      // Boshlanishdagi o'rta nuqta ostidagi joy — oxirgi o'rta nuqta ostiga
      anchorRef.current = { x: el.scrollLeft + ox, y: el.scrollTop + oy, cx: ox + tx, cy: oy + ty };
      zoomCbRef.current?.(z1);
    };
    const onEnd = (e: TouchEvent) => {
      if (g && e.touches.length < 2) {
        finish();
        tap = null;
        return;
      }
      if (tap && e.touches.length === 0 && !tap.moved && e.timeStamp - tap.t < 300 && zoomCbRef.current) {
        const now = { t: e.timeStamp, x: tap.x, y: tap.y };
        if (lastTap && now.t - lastTap.t < 330 && Math.hypot(now.x - lastTap.x, now.y - lastTap.y) < 32) {
          lastTap = null;
          e.preventDefault();
          const r = el.getBoundingClientRect();
          const cx = now.x - r.left;
          const cy = now.y - r.top;
          const z1 = clampZ(zoomNowRef.current < 1.4 ? 1.75 : 1);
          anchorRef.current = { x: el.scrollLeft + cx, y: el.scrollTop + cy, cx, cy };
          pill(z1);
          pill(null);
          zoomCbRef.current(z1);
        } else lastTap = now;
      }
      tap = null;
    };
    // iOS Safari: sahifa zoom'i (gesture*) ham to'xtatiladi — zoom faqat kitobda
    const noGesture = (e: Event) => e.preventDefault();
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: false });
    el.addEventListener("touchcancel", onEnd, { passive: false });
    el.addEventListener("gesturestart", noGesture, { passive: false });
    el.addEventListener("gesturechange", noGesture, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("gesturestart", noGesture);
      el.removeEventListener("gesturechange", noGesture);
      window.clearTimeout(hideTimer);
    };
  }, [minZoom, maxZoom]);

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

    // 71: bosilgan so'z (uzoq bosishda darhol tanlanadi — telefondagi odatiy xatti-harakat)
    const wordAt = (c: Caret): { start: Caret; end: Caret } | null => {
      const str = c.node.textContent ?? "";
      let a = Math.min(c.offset, str.length);
      let b = a;
      while (a > 0 && WORD_CHAR.test(str[a - 1])) a--;
      while (b < str.length && WORD_CHAR.test(str[b])) b++;
      return b > a ? { start: { node: c.node, offset: a }, end: { node: c.node, offset: b } } : null;
    };
    const before = (x: Caret, y: Caret) => {
      const rx = document.createRange();
      rx.setStart(x.node, x.offset);
      const ry = document.createRange();
      ry.setStart(y.node, y.offset);
      return rx.compareBoundaryPoints(Range.START_TO_START, ry) < 0;
    };

    let startPt: { x: number; y: number; id: number; page: HTMLElement; touch: boolean } | null = null;
    let active = false;
    let word: { start: Caret; end: Caret } | null = null;
    let timer = 0;
    const pointers = new Set<number>();

    const stop = () => {
      window.clearTimeout(timer);
      startPt = null;
      active = false;
      word = null;
      delete el.dataset.selecting;
    };
    // Tanlov: sichqoncha — boshlang'ich nuqtadan; sensor — bosilgan so'zdan (so'z doim ichida qoladi)
    const selectionRange = (layer: Element, x: number, y: number): Range | null => {
      if (!startPt) return null;
      const b = caretAt(x, y, layer);
      if (!b) return null;
      if (word && layer.contains(word.start.node)) {
        if (before(b, word.start)) return rangeBetween(layer, b, word.end);
        if (before(word.end, b)) return rangeBetween(layer, word.start, b);
        return rangeBetween(layer, word.start, word.end);
      }
      const a = caretAt(startPt.x, startPt.y, layer);
      return a ? rangeBetween(layer, a, b) : null;
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") pointers.add(e.pointerId);
      // Ikkinchi barmoq — zoom: boshlanayotgan tanlov bekor
      if (pointers.size > 1) {
        stop();
        return;
      }
      if (e.button !== 0) return;
      const pageEl = (e.target as HTMLElement)?.closest<HTMLElement>("[data-page]");
      if (!pageEl) return;
      startPt = { x: e.clientX, y: e.clientY, id: e.pointerId, page: pageEl, touch: e.pointerType !== "mouse" };
      if (e.pointerType === "mouse") active = true;
      else {
        // Sensor: faqat uzoq (500 ms) va qimirlamay bosilganda — aks holda oddiy scroll/varaqlash
        timer = window.setTimeout(() => {
          if (!startPt || pointers.size > 1) return;
          const layer = startPt.page.querySelector(".textLayer");
          const c = layer ? caretAt(startPt.x, startPt.y, layer) : null;
          word = c ? wordAt(c) : null;
          if (!layer || !word) return; // so'z ustida emas (bo'sh joy, rasm) — tanlov boshlanmaydi
          active = true;
          el.dataset.selecting = "1";
          navigator.vibrate?.(12);
          const r = rangeBetween(layer, word.start, word.end);
          if (r) setPick({ page: Number(startPt.page.dataset.page), rects: rectsFromClientRects(Array.from(r.getClientRects()), startPt.page) });
        }, LONG_PRESS_MS);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!startPt || e.pointerId !== startPt.id) return;
      if (!active) {
        if (Math.abs(e.clientX - startPt.x) > LONG_PRESS_TOLERANCE || Math.abs(e.clientY - startPt.y) > LONG_PRESS_TOLERANCE) stop();
        return;
      }
      const layer = startPt.page.querySelector(".textLayer");
      if (!layer) return;
      const range = selectionRange(layer, e.clientX, e.clientY);
      if (!range) return;
      if (e.pointerType !== "mouse") e.preventDefault();
      setPick({ page: Number(startPt.page.dataset.page), rects: rectsFromClientRects(Array.from(range.getClientRects()), startPt.page) });
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (!startPt || e.pointerId !== startPt.id) {
        stop();
        return;
      }
      const page = startPt.page;
      const wasActive = active;
      const tapped = startPt.touch && Math.abs(e.clientX - startPt.x) <= LONG_PRESS_TOLERANCE && Math.abs(e.clientY - startPt.y) <= LONG_PRESS_TOLERANCE;
      const layer = page.querySelector(".textLayer");
      const range = wasActive && layer ? selectionRange(layer, e.clientX, e.clientY) : null;
      stop();
      if (!wasActive) {
        // 71: oddiy tegish — ochiq tanlov yopiladi (hech narsa belgilanmaydi)
        if (tapped && pickRef.current) {
          setPick(null);
          onTextSelected(null);
        }
        return;
      }
      const text = range ? rangeText(range).trim() : "";
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
    const onCancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      stop();
    };
    el.addEventListener("pointercancel", onCancel);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      window.clearTimeout(timer);
    };
  }, [onTextSelected]);

  const block = (e: React.SyntheticEvent) => e.preventDefault();
  // Progress'dagi sahifa hujjatdan katta bo'lsa (fayl almashtirilgan) — oxirgi sahifa
  const shownPage = Math.min(pageNo, pageCount || pageNo);

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${night ? "reader-night bg-[#0b0d12]" : "bg-[#e9ebef]"}`}
      onContextMenu={block}
      onCopy={block}
      onCut={block}
      onDragStart={block}
    >
      <div ref={containerRef} className="reader-scroller h-full w-full overflow-auto" data-testid="reader-scroller">
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
          <div className="mx-auto flex flex-col items-center" style={{ width: pageWidth, gap: PAGE_GAP, paddingBlock: SCROLL_PAD }}>
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
                vocab={vocabByPage.get(i + 1)}
                onVocabPick={onVocabPick}
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
                vocab={vocabByPage.get(n)}
                onVocabPick={onVocabPick}
                pickRects={pick?.page === n ? pick.rects : undefined}
                watermarkText={watermarkText}
                label={t("common.pageN", { n })}
              />
            )}
            labels={{ prev: t("reader.prevPage"), next: t("reader.nextPage") }}
          />
        )}

        {pageCount > 0 && mode === "spread" && (
          <SpreadStage
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
                vocab={vocabByPage.get(n)}
                onVocabPick={onVocabPick}
                pickRects={pick?.page === n ? pick.rects : undefined}
                watermarkText={watermarkText}
                label={t("common.pageN", { n })}
              />
            )}
            labels={{ prev: t("reader.prevPage"), next: t("reader.nextPage") }}
          />
        )}
      </div>

      {/* 71: zoom foizi — pinch / ikki marta tegish paytida */}
      <div ref={pillRef} className="zoom-pill" aria-hidden data-testid="zoom-pill" />
      {pageCount > 0 && mode === "page" && (
        <>
          <PageNavButton side="left" disabled={shownPage <= 1} onClick={() => goToPage(shownPage - 1)} label={t("reader.prevPage")} />
          <PageNavButton side="right" disabled={shownPage >= pageCount} onClick={() => goToPage(shownPage + 1)} label={t("reader.nextPage")} />
        </>
      )}
      {pageCount > 0 && mode === "spread" && (
        <>
          <PageNavButton side="left" disabled={spreadOf(shownPage, pageCount) <= 1} onClick={() => step(-1)} label={t("reader.prevPage")} />
          <PageNavButton side="right" disabled={lastOf(spreadOf(shownPage, pageCount), pageCount) >= pageCount} onClick={() => step(1)} label={t("reader.nextPage")} />
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
 *  - sichqoncha (34): sudrab varaqlash yo'q — sahifa chekkasidagi so'zlar ham tanlanadi; fonni bosish — oldingi/keyingi;
 *  - sensor: istalgan joydan swipe — varaq chekkasi barmoqqa aniq ergashadi, qo'yib yuborilganda tezlik va masofaga
 *    qarab varaqlanadi yoki joyiga qaytadi (matn tanlanmagan bo'lsa).
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
    const dpr = canvasRatio(width, height);
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
      // 34: sichqoncha bilan sudrab varaqlash yo'q — sahifaning hamma joyi (chekkalari ham) matn tanlash uchun.
      // Faqat sahifa tashqarisidagi fonni bosish (oldingi/keyingi) kuzatiladi.
      if (target.closest(".reader-page")) return;
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
    if (d.type === "mouse") return; // 34: sichqoncha — faqat bosish, sudrash varaqlamaydi
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
  vocab,
  onVocabPick,
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
  /** 33.3: shu sahifadagi lug'at so'zlari */
  vocab?: Array<{ id: string; rects: HighlightRect[] }>;
  onVocabPick?: (id: string, x: number, y: number) => void;
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
      const dpr = canvasRatio(viewport.width, viewport.height);
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
      // 29: oqim to'g'ridan-to'g'ri — TextLayer uni getReader() bilan o'qiydi; `getTextContent()` esa
      // `for await` ishlatadi, u Safari 17/18 da yo'q (polyfill ham bor, bu — ikkinchi himoya)
      const textLayer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textDiv, viewport });
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
    if (pickRects?.length) return; // matn tanlangan — avval tanlov paneli
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    const fx = (e.clientX - box.left) / box.width;
    const fy = (e.clientY - box.top) / box.height;
    const pad = 0.004;
    // 33.3: lug'at so'zi (nuqtali chiziq) — ustuvor: tarjimani ko'rsatish
    if (onVocabPick && vocab?.length) {
      for (const v of vocab) {
        for (const r of v.rects) {
          if (fx >= r[0] - pad && fx <= r[0] + r[2] + pad && fy >= r[1] - pad && fy <= r[1] + r[3] + pad * 2) {
            onVocabPick(v.id, e.clientX, e.clientY);
            return;
          }
        }
      }
    }
    if (!onHighlightPick || !highlights?.length) return;
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
      {vocab && vocab.length > 0 && (
        <div className="vocabLayer pointer-events-none absolute inset-0" aria-hidden data-testid="vocab-marks">
          {vocab.map((v) =>
            v.rects.map((r, i) => (
              <div key={`${v.id}-${i}`} data-vocab={v.id} style={{ left: `${r[0] * 100}%`, top: `${r[1] * 100}%`, width: `${r[2] * 100}%`, height: `${r[3] * 100}%` }} />
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

/**
 * 58: tanlangan matn. pdf.js matn qatlamida satr oxiri — `<br>`; `Range.toString()` faqat matn tugunlarini qo'shadi va
 * satrlar yopishib qoladi ("terto" + "abrokenheart" → "tertoabrokenheart"). Bu yerda `<br>` → bo'sh joy (satr "-" bilan
 * tugasa — bo'sh joysiz), ortiqcha bo'shliqlar bittaga.
 */
function rangeText(range: Range): string {
  const root = range.commonAncestorContainer;
  if (root.nodeType === Node.TEXT_NODE) return range.toString();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let out = "";
  for (let n: Node | null = walker.currentNode; n; n = walker.nextNode()) {
    if (!range.intersectsNode(n)) continue;
    if (n.nodeType === Node.TEXT_NODE) {
      const data = (n as Text).data;
      const start = n === range.startContainer ? range.startOffset : 0;
      const end = n === range.endContainer ? range.endOffset : data.length;
      out += data.slice(start, end);
    } else if ((n as Element).tagName === "BR" && out && !/[\s-]$/.test(out)) {
      out += " ";
    }
  }
  return out.replace(/\s+/g, " ");
}
