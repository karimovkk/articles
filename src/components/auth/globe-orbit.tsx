"use client";

/**
 * Login/ro'yxat chap paneli: aylanayotgan nuqtali yer shari (canvas) va uning atrofida orbitada aylanuvchi kitoblar.
 * Orbita — og'ma ellips: kitoblar globusning **yuqori-o'ng** tomonidan (orqasidan) chiqib, oldidan aylanib o'tadi va
 * **pastki-chap** tomonida yana orqaga kiradi. Orqa yarmida kitoblar globus ostida (kichikroq, xiraroq) qoladi.
 * Faqat ko'rinib turganda animatsiya qilinadi (IntersectionObserver); `prefers-reduced-motion` — statik kadr.
 */
import { useEffect, useRef } from "react";
import { landPoints } from "@/lib/land-mask";

const BOOKS = ["/auth/book-1.webp", "/auth/book-2.webp", "/auth/book-3.webp", "/auth/book-4.webp", "/auth/book-5.webp"];

/** Globus aylanishi (rad/s) va orbita tezligi (rad/s) */
const SPIN = 0.12;
const ORBIT = 0.22;
/** Orbita og'ishi: manfiy — o'ng uchi yuqorida, chap uchi pastda */
const TILT = (-24 * Math.PI) / 180;
/** Globusning o'z o'qi bo'yicha qiyaligi (shimol biroz ko'rinsin) */
const AXIS = (18 * Math.PI) / 180;

export function GlobeOrbit({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bookRefs = useRef<Array<HTMLImageElement | null>>([]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !ctx) return;

    const pts = landPoints();
    const count = pts.length / 3;
    // Har bir nuqtaga barqaror "shahar chirog'i" belgisi (≈7%) — aksent rangda miltillaydi
    const lights = new Uint8Array(count);
    for (let i = 0; i < count; i++) lights[i] = (i * 2654435761) % 100 < 7 ? 1 : 0;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = 1;
    const resize = () => {
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      R = Math.max(60, Math.min(H * 0.36, W * 0.27));
      cx = W / 2;
      cy = H / 2;
      wrap.style.setProperty("--globe-r", `${R}px`);
    };
    resize();

    const cosA = Math.cos(AXIS), sinA = Math.sin(AXIS);
    const cosT = Math.cos(TILT), sinT = Math.sin(TILT);

    const drawGlobe = (rot: number, time: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // Sfera: yorug'lik yuqori-chapdan
      const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      g.addColorStop(0, "#23332d");
      g.addColorStop(0.65, "#131c18");
      g.addColorStop(1, "#0a100d");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      const cr = Math.cos(rot), sr = Math.sin(rot);
      for (let i = 0; i < count; i++) {
        const x0 = pts[i * 3], y0 = pts[i * 3 + 1], z0 = pts[i * 3 + 2];
        // Y o'qi atrofida aylanish, so'ng X o'qi atrofida qiyalik
        const x1 = x0 * cr + z0 * sr;
        const z1 = -x0 * sr + z0 * cr;
        const y2 = y0 * cosA - z1 * sinA;
        const z2 = y0 * sinA + z1 * cosA;
        if (z2 <= 0.02) continue; // orqa yarim shar
        const light = 0.55 + 0.45 * (-x1 * 0.45 + y2 * 0.5 + z2 * 0.74); // yuqori-chapdan yorug'lik
        const px = cx + x1 * R, py = cy - y2 * R;
        const size = 0.7 + 1.0 * z2;
        if (lights[i]) {
          const pulse = 0.55 + 0.45 * Math.sin(time * 2 + i);
          ctx.globalAlpha = Math.min(1, (0.35 + 0.65 * z2) * pulse);
          ctx.fillStyle = "#f2b705";
          ctx.beginPath();
          ctx.arc(px, py, size * 1.35, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = Math.max(0.12, Math.min(1, (0.2 + 0.8 * z2) * light));
          ctx.fillStyle = "#e9e4d4";
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // Chekka (atmosfera) yorug'ligi va terminator soyasi
      const rim = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.02);
      rim.addColorStop(0, "rgba(242,183,5,0)");
      rim.addColorStop(1, "rgba(242,183,5,0.28)");
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      const shade = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      shade.addColorStop(0.45, "rgba(0,0,0,0)");
      shade.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
    };

    const placeBooks = (base: number) => {
      const a = R * 1.62, b = R * 0.42, w = R * 0.8;
      bookRefs.current.forEach((el, i) => {
        if (!el) return;
        const th = base + (i * 2 * Math.PI) / BOOKS.length;
        const ex = a * Math.cos(th), ey = b * Math.sin(th);
        const depth = Math.sin(th); // > 0 — globus oldida
        const x = cx + ex * cosT - ey * sinT;
        const y = cy + ex * sinT + ey * cosT;
        const k = (depth + 1) / 2; // 0 — eng orqa, 1 — eng old
        const scale = 0.58 + 0.42 * k;
        const rot = -14 + 12 * Math.cos(th);
        el.style.width = `${w}px`;
        el.style.transform = `translate(${x - w / 2}px, ${y - w / 2}px) scale(${scale.toFixed(3)}) rotate(${rot.toFixed(1)}deg)`;
        el.style.zIndex = depth > 0 ? "3" : "1";
        el.style.opacity = (0.45 + 0.55 * k).toFixed(3);
        el.style.filter = `brightness(${(0.55 + 0.45 * k).toFixed(3)}) drop-shadow(0 ${Math.round(6 + 10 * k)}px ${Math.round(10 + 14 * k)}px rgba(0,0,0,0.55))`;
        el.style.visibility = "visible";
      });
    };

    let raf = 0;
    let visible = true;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      drawGlobe(t * SPIN, t);
      placeBooks(t * ORBIT);
      if (visible && !reduced) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    };
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced || !visible) frame(performance.now());
    });
    ro.observe(wrap);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
      else cancelAnimationFrame(raf);
    });
    io.observe(wrap);
    start();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className={`globe-orbit ${className ?? ""}`} aria-hidden data-testid="globe-orbit">
      <div className="globe-glow" />
      <canvas ref={canvasRef} className="globe-canvas" />
      {BOOKS.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- dekorativ, JS bilan joylashtiriladi; o'lchamlari kichik WebP
        <img
          key={src}
          ref={(el) => {
            bookRefs.current[i] = el;
          }}
          src={src}
          alt=""
          draggable={false}
          decoding="async"
          className="orbit-book"
        />
      ))}
    </div>
  );
}
