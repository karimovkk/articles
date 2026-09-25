"use client";

/**
 * Kitob rejimi (32B): ikki sahifa yonma-yon — juftlar [1|2], [3|4], …, o'rtada umurtqa.
 *
 * Varaqlash 180°: oldinga — o'ng varaq umurtqa atrofida ko'tariladi (`drawCurl`, o'ng yarmda), 90° dan keyin uning
 * orqa tomoni — keyingi juftning chap sahifasi — chap yarmga tushadi (o'sha chizish ko'zguda). Orqaga — teskari:
 * chap varaq ko'tarilib, orqa tomoni (oldingi juftning o'ng sahifasi) o'ngga tushadi. Varaqlanayotgan sahifalar
 * DOM'da yashiriladi, ular o'rniga egilgan qog'oz `canvas`da chiziladi; ostidagi sahifalar DOM'da ko'rinib turadi.
 *
 * `t` — varaqlash yakunlanish ulushi (0 — boshlanmagan, 1 — tugagan), ikkala yo'nalishda ham.
 * Boshqaruv: tashqi navigatsiya (tugma, klaviatura, TOC) — avtomatik animatsiya; sichqoncha — fonni bosish (sudrab
 * varaqlash yo'q: sahifa chekkasidagi so'zlar ham tanlanadi — 34); sensor — swipe (varaq barmoqqa ergashadi).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { drawCurl } from "@/lib/reader/page-curl";


type SpreadFlip = {
  dir: 1 | -1;
  /** Juft raqamlari (1-juft = [1|2]) */
  from: number;
  to: number;
  dragging: boolean;
  auto?: boolean;
};

export function spreadOf(page: number, pageCount: number) {
  const spreads = Math.max(1, Math.ceil(pageCount / 2));
  return Math.min(spreads, Math.max(1, Math.ceil(page / 2)));
}
export const leftOf = (s: number) => 2 * s - 1;
export const rightOf = (s: number, pageCount: number) => (2 * s <= pageCount ? 2 * s : null);
/** Juftda ko'rinib turgan eng katta sahifa — progress/joriy sahifa uchun */
export const lastOf = (s: number, pageCount: number) => rightOf(s, pageCount) ?? leftOf(s);

/** Ko'zgu nusxa: chap yarmda ko'zgu qilib chiziladigan sahifa to'g'ri o'qilishi uchun oldindan aks ettiriladi */
function mirrored(src: HTMLCanvasElement) {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.translate(src.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
  }
  return c;
}

export function SpreadStage({
  current,
  pageCount,
  width,
  height,
  night,
  onCommit,
  renderPage,
  labels,
}: {
  /** Tashqaridan kelgan joriy sahifa — uning jufti ko'rsatiladi */
  current: number;
  pageCount: number;
  /** Bitta sahifa o'lchami (CSS px) */
  width: number;
  height: number;
  night: boolean;
  /** Varaqlash tugaganda — yangi juftning oxirgi (eng katta) sahifasi */
  onCommit: (page: number) => void;
  renderPage: (n: number) => React.ReactNode;
  labels: { prev: string; next: string };
}) {
  const spreads = Math.max(1, Math.ceil(pageCount / 2));
  const target = spreadOf(current, pageCount);
  const [displayed, setDisplayed] = useState(target);
  const [flip, setFlip] = useState<SpreadFlip | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tRef = useRef(0);
  const rafRef = useRef(0);
  const flipRef = useRef<SpreadFlip | null>(null);
  const mirrorCache = useRef(new Map<number, HTMLCanvasElement>());
  const drag = useRef<{ id: number; x: number; y: number; lastX: number; lastT: number; dir: 0 | 1 | -1; type: string } | null>(null);
  useLayoutEffect(() => {
    flipRef.current = flip;
  });

  /** Varaqning old va orqa tomoni (sahifa raqamlari) */
  const faces = (f: SpreadFlip) =>
    f.dir === 1 ? { front: rightOf(f.from, pageCount), back: leftOf(f.to) } : { front: leftOf(f.from), back: rightOf(f.to, pageCount) };
  const sourceCanvas = useCallback((n: number | null) => (n ? (stageRef.current?.querySelector<HTMLCanvasElement>(`.spread-leaf[data-leaf="${n}"] canvas`) ?? null) : null), []);

  // ---- Kadr: birinchi yarmida old tomon ko'tariladi, ikkinchisida orqa tomon narigi yarmga tushadi
  const draw = useCallback(() => {
    const f = flipRef.current;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pxW = Math.round(width * 2 * dpr);
    const pxH = Math.round(height * dpr);
    if (cv.width !== pxW || cv.height !== pxH) {
      cv.width = pxW;
      cv.height = pxH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width * 2, height);
    if (!f) return;
    const t = tRef.current;
    const firstHalf = t < 0.5;
    const q = firstHalf ? t * 2 : (1 - t) * 2;
    const { front, back } = faces(f);
    const pageNo = firstHalf ? front : back;
    const src = sourceCanvas(pageNo);
    if (!pageNo || !src || !src.width) return;
    // O'ng yarmda oddiy (umurtqa — chap chekka), chap yarmda ko'zgu (umurtqa — o'ng chekka)
    const onRight = (f.dir === 1) === firstHalf;
    ctx.save();
    ctx.translate(width, 0);
    if (onRight) {
      drawCurl({ ctx, src, srcW: src.width, srcH: src.height, w: width, h: height, progress: q, night });
    } else {
      let m = mirrorCache.current.get(pageNo);
      if (!m || m.width !== src.width) {
        m = mirrored(src);
        mirrorCache.current.set(pageNo, m);
      }
      ctx.scale(-1, 1);
      drawCurl({ ctx, src: m, srcW: m.width, srcH: m.height, w: width, h: height, progress: q, night });
    }
    ctx.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faces pageCount'ga bog'liq, u deps'da
  }, [width, height, night, sourceCanvas, pageCount]);

  const setT = useCallback(
    (t: number) => {
      tRef.current = Math.max(0, Math.min(1, t));
      const st = stageRef.current;
      if (st) st.dataset.progress = tRef.current.toFixed(2);
      draw();
    },
    [draw],
  );

  const stop = useCallback(
    (f: SpreadFlip, done: boolean) => {
      cancelAnimationFrame(rafRef.current);
      if (done) {
        setDisplayed(f.to);
        const page = lastOf(f.to, pageCount);
        if (spreadOf(current, pageCount) !== f.to || page !== current) onCommit(page);
      }
      setFlip(null);
      flipRef.current = null;
      tRef.current = 0;
      mirrorCache.current.clear();
      const st = stageRef.current;
      if (st) delete st.dataset.progress;
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      if (cv && ctx) ctx.clearRect(0, 0, cv.width, cv.height);
    },
    [current, pageCount, onCommit],
  );

  /** Tabiiy tugash: masofa va tezlikka qarab davomiylik (180° — bitta varaqdan uzunroq), easeInOut */
  const animateTo = useCallback(
    (goal: 0 | 1, speed = 0) => {
      const f = flipRef.current;
      if (!f) return;
      const start = tRef.current;
      const dist = goal - start;
      if (Math.abs(dist) < 0.002) {
        stop(f, goal === 1);
        return;
      }
      const dur = Math.max(220, Math.min(900, 320 + Math.abs(dist) * 560 - Math.min(240, speed * 300)));
      const t0 = performance.now();
      cancelAnimationFrame(rafRef.current);
      const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        setT(start + dist * ease(k));
        if (k < 1) rafRef.current = requestAnimationFrame(step);
        else stop(f, goal === 1);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [setT, stop],
  );

  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Tashqi navigatsiya: avtomatik varaqlash (holat render fazasida boshlanadi)
  if (target !== displayed && !flip) {
    setFlip({ dir: target > displayed ? 1 : -1, from: displayed, to: target, dragging: false, auto: true });
  }
  useEffect(() => {
    if (!flip?.auto) return;
    const f = flip;
    const raf = requestAnimationFrame(() => {
      const src = sourceCanvas(faces(f).front);
      if (reduced() || !src || !src.width) {
        stop(f, true); // animatsiyasiz (reduced motion yoki sahifa hali render bo'lmagan)
        return;
      }
      flipRef.current = f;
      setT(0);
      animateTo(1);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faces pageCount'ga bog'liq
  }, [flip, animateTo, setT, sourceCanvas, stop]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  useEffect(() => {
    if (flipRef.current) draw();
  }, [draw]);

  const canGo = (dir: 1 | -1) => displayed + dir >= 1 && displayed + dir <= spreads;

  // ---- Sudrash
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || flipRef.current) return;
    const el = e.target as HTMLElement;
    if (el.closest("button, a")) return;
    if (e.pointerType === "mouse") {
      // 34: sichqoncha bilan sudrab varaqlash yo'q — sahifaning hamma joyi matn tanlash uchun; faqat fonni bosish
      if (el.closest(".reader-page")) return;
    } else if (stageRef.current?.closest("[data-selecting]")) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastT: performance.now(), dir: 0, type: e.pointerType };
  };

  /** Kursor x'i → t: oldinga — varaq chekkasi o'ngdan chapga, orqaga — chapdan o'ngga (butun juft bo'ylab) */
  const tFromPointer = (clientX: number, dir: 1 | -1) => {
    const book = stageRef.current?.querySelector(".spread-book")?.getBoundingClientRect();
    if (!book || !book.width) return 0;
    const x = Math.max(0, Math.min(book.width, clientX - book.left)) / book.width;
    return dir === 1 ? 1 - x : x;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.type === "mouse") return; // 34: sichqoncha — faqat bosish
    if (stageRef.current?.closest("[data-selecting]")) {
      drag.current = null;
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.dir === 0) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      const dir: 1 | -1 = dx < 0 ? 1 : -1;
      const f: SpreadFlip = { dir, from: displayed, to: displayed + dir, dragging: true };
      if (!canGo(dir) || !sourceCanvas(faces(f).front)?.width) {
        drag.current = null;
        return;
      }
      d.dir = dir;
      try {
        stageRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* sintetik pointer (test) */
      }
      flipRef.current = f;
      setFlip(f);
      setT(0);
    }
    d.lastX = e.clientX;
    d.lastT = performance.now();
    setT(tFromPointer(e.clientX, d.dir as 1 | -1));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.dir === 0) {
      // Bosish (sudrashsiz): fonning chap/o'ng qismi — oldingi/keyingi juft (faqat sichqoncha)
      if (d.type === "mouse" && !(e.target as HTMLElement).closest(".reader-page")) {
        const r = stageRef.current?.getBoundingClientRect();
        if (r) {
          const dir: 1 | -1 = e.clientX < r.left + r.width / 2 ? -1 : 1;
          if (canGo(dir)) onCommit(lastOf(displayed + dir, pageCount));
        }
      }
      return;
    }
    const f = flipRef.current;
    if (!f) return;
    const dt = Math.max(1, performance.now() - d.lastT);
    const vx = (e.clientX - d.lastX) / dt;
    const t = tRef.current;
    const fast = f.dir === 1 ? vx < -0.4 : vx > 0.4;
    const slow = f.dir === 1 ? vx > 0.4 : vx < -0.4;
    const complete = !slow && (t > 0.45 || (fast && t > 0.06));
    setFlip({ ...f, dragging: false, auto: false });
    animateTo(complete ? 1 : 0, Math.abs(vx));
  };

  // ---- Qaysi sahifa qayerda ko'rinadi
  const show = (s: number) => ({ left: leftOf(s), right: rightOf(s, pageCount) });
  let visibleLeft: number | null;
  let visibleRight: number | null;
  if (!flip) {
    ({ left: visibleLeft, right: visibleRight } = show(displayed));
  } else if (flip.dir === 1) {
    visibleLeft = leftOf(flip.from); // orqa tomoni tushguncha eski chap sahifa turadi
    visibleRight = rightOf(flip.to, pageCount); // ko'tarilayotgan varaq ostidan keyingi o'ng sahifa ochiladi
  } else {
    visibleLeft = leftOf(flip.to);
    visibleRight = rightOf(flip.from, pageCount);
  }
  // Oldindan render: joriy juft ± 1 va varaqlash nishoni
  const wanted = new Set<number>();
  for (const s of [displayed - 1, displayed, displayed + 1, flip?.to ?? displayed]) {
    if (s < 1 || s > spreads) continue;
    wanted.add(leftOf(s));
    const r = rightOf(s, pageCount);
    if (r) wanted.add(r);
  }
  const pages = Array.from(wanted).sort((a, b) => a - b);

  return (
    <div
      ref={stageRef}
      className={`flip-stage spread-stage ${flip?.dragging ? "is-dragging" : ""}`}
      style={{ minHeight: "100%", ["--page-w" as string]: `${width}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      data-testid="spread-stage"
      data-flipping={flip ? "1" : undefined}
      data-spread={displayed}
    >
      <div className="flip-zone left" aria-hidden data-can={canGo(-1) ? "1" : "0"} title={labels.prev} />
      <div className="flip-zone right" aria-hidden data-can={canGo(1) ? "1" : "0"} title={labels.next} />
      <div className="spread-book" style={{ width: width * 2, height }}>
        {/* Bo'sh o'ng sahifa (toq sonli hujjatning oxirgi jufti) — qog'oz rangida */}
        {visibleRight === null && <div className="spread-blank" aria-hidden />}
        {pages.map((n) => {
          const side = n % 2 === 1 ? "left" : "right";
          const visible = side === "left" ? n === visibleLeft : n === visibleRight;
          return (
            <div
              key={n}
              className="spread-leaf"
              data-leaf={n}
              data-side={side}
              style={{ left: side === "left" ? 0 : width, zIndex: visible ? 2 : 1, visibility: visible ? "visible" : "hidden" }}
            >
              {renderPage(n)}
            </div>
          );
        })}
        <div className="spread-spine" aria-hidden />
        <canvas ref={canvasRef} className="flip-canvas" style={{ width: width * 2, height, display: flip ? "block" : "none" }} aria-hidden data-testid="spread-canvas" />
      </div>
    </div>
  );
}
