"use client";

/**
 * 80: mushakbozlik (canvas) — raketa pastdan ko'tarilib, tepada rang-barang uchqunlarga yoriladi (tortishish, so'nish,
 * iz). `active` bo'lganda boshlanadi: avval tez-tez (bayram), keyin vaqti-vaqti bilan. Ekranda ko'rinmasa yoki tab
 * yashirin bo'lsa — kadrlar to'xtaydi; `prefers-reduced-motion` — umuman chizilmaydi. Faqat bezak (aria-hidden).
 */
import { useEffect, useRef } from "react";

const COLORS = ["#f2b705", "#ffd866", "#ff7a59", "#ff4d8d", "#a78bfa", "#38bdf8", "#34d399", "#fff3c4"];
const GRAVITY = 0.045;

interface Rocket {
  x: number;
  y: number;
  vy: number;
  top: number;
  color: string;
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  color: string;
  size: number;
}

export function Fireworks({ active, className }: { active: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !active) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);

    const rockets: Rocket[] = [];
    const sparks: Spark[] = [];
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const pick = () => COLORS[Math.floor(Math.random() * COLORS.length)];
    const launch = () => {
      if (!w || !h) return;
      rockets.push({ x: rnd(w * 0.25, w * 0.75), y: h, vy: -rnd(h * 0.028, h * 0.036), top: rnd(h * 0.12, h * 0.38), color: pick() });
    };
    const burst = (x: number, y: number, color: string) => {
      const n = 46 + Math.floor(Math.random() * 18);
      const speed = Math.max(1.6, Math.min(w, h) / 70);
      const second = Math.random() < 0.45 ? pick() : color;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(-0.08, 0.08);
        const v = speed * rnd(0.55, 1);
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: rnd(0.012, 0.02), color: i % 3 ? color : second, size: rnd(1.4, 2.4) });
      }
    };

    let raf = 0;
    let running = false;
    let next = 0;
    let started = 0;
    const frame = (now: number) => {
      if (!started) started = now;
      // Birinchi 5 s — bayram (har ~0.5 s), keyin vaqti-vaqti bilan (har ~2.6 s)
      if (now >= next) {
        launch();
        if (now - started < 5000 && Math.random() < 0.35) launch();
        next = now + (now - started < 5000 ? rnd(380, 640) : rnd(2000, 3200));
      }
      // Iz qoldirib so'nish: oldingi kadr shaffofroq bo'ladi
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y += r.vy;
        r.vy += GRAVITY * 0.6;
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
        if (r.y <= r.top || r.vy >= 0) {
          burst(r.x, r.y, r.color);
          rockets.splice(i, 1);
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.985;
        s.vy = s.vy * 0.985 + GRAVITY;
        s.life -= s.decay;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * (0.6 + s.life * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (running) return;
      running = true;
      next = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    let visible = true;
    const sync = () => (visible && !document.hidden ? start() : stop());
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sync();
    });
    io.observe(cv);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      ctx.clearRect(0, 0, w, h);
    };
  }, [active]);

  return <canvas ref={ref} className={className} aria-hidden data-testid="fireworks" />;
}
