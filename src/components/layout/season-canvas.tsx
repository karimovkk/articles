"use client";

/**
 * 125: mavsumiy effekt — bitta `<canvas>` (position: fixed, pointer-events: none). Sayt tezligi uchun:
 *  - alohida chunk (`season-effects.tsx` faqat effekt yoqilganda yuklaydi), brauzer bo'shaganda boshlanadi;
 *  - zarrachalar soni ekran maydoniga qarab (telefonda ~14, kompyuterda ≤ 36), kuchsiz qurilmada — yarmi;
 *  - ~30 kadr/s, DPR ≤ 1.5, har bir shakl oldindan kichik sprite'ga chiziladi (kadrda faqat `drawImage`);
 *  - vkladka yashirin bo'lsa to'xtaydi; reduced-motion / trafik tejash rejimida umuman ishlamaydi (`season-effects.tsx`).
 */
import { useEffect, useRef } from "react";
import type { Season } from "@/lib/decor";

type Particle = { x: number; y: number; vx: number; vy: number; s: number; rot: number; vr: number; ph: number; sp: number; img: number };

const FRAME_MS = 1000 / 30;

function sprite(size: number, draw: (g: CanvasRenderingContext2D, n: number) => void): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (g) draw(g, size);
  return c;
}

function leaf(fill: string, vein: string) {
  return sprite(48, (g, n) => {
    g.translate(n / 2, n / 2);
    g.beginPath();
    g.moveTo(0, -20);
    g.bezierCurveTo(14, -14, 16, 6, 0, 20);
    g.bezierCurveTo(-16, 6, -14, -14, 0, -20);
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = vein;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(0, -16);
    g.lineTo(0, 22);
    g.stroke();
  });
}

/** Olti nurli qor parchasi (❄): har nurda 1–2 juft "shoxcha", markazda kichik olti burchak */
function flake(branches2: boolean, tips = false) {
  return sprite(64, (g, n) => {
    const R = n * 0.4;
    g.translate(n / 2, n / 2);
    g.lineCap = "round";
    g.shadowColor = "rgba(50,75,120,0.6)";
    g.shadowBlur = 4;
    g.strokeStyle = "#ffffff";
    g.lineWidth = n * 0.065;
    for (let i = 0; i < 6; i++) {
      g.save();
      g.rotate((i * Math.PI) / 3);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -R);
      const at = branches2 ? [0.42, 0.7] : [0.55];
      for (const k of at) {
        const b = R * (k < 0.5 ? 0.3 : 0.24);
        g.moveTo(0, -R * k);
        g.lineTo(-b * 0.8, -R * k - b);
        g.moveTo(0, -R * k);
        g.lineTo(b * 0.8, -R * k - b);
      }
      g.stroke();
      if (tips) {
        g.beginPath();
        g.arc(0, -R, n * 0.04, 0, Math.PI * 2);
        g.fillStyle = "#ffffff";
        g.fill();
      }
      g.restore();
    }
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g[i ? "lineTo" : "moveTo"](Math.sin(a) * R * 0.16, -Math.cos(a) * R * 0.16);
    }
    g.closePath();
    g.fillStyle = "#ffffff";
    g.fill();
  });
}

function makeSprites(season: Season): HTMLCanvasElement[] {
  if (season === "winter") {
    // ❄ ko'rinishidagi qor parchalari — emoji shrift'ga bog'liq bo'lmasligi uchun vektor bilan chiziladi
    // (har qurilmada bir xil). Oq + kulrang-moviy soya — yorug' fonda ham, qorong'ida ham ko'rinadi.
    return [flake(false), flake(true), flake(true, true)];
  }
  if (season === "autumn") {
    return [leaf("#e0a419", "#a86f08"), leaf("#e8701a", "#a4460b"), leaf("#c2410c", "#7c2d12"), leaf("#d4a017", "#8a6410")];
  }
  if (season === "spring") {
    const petal = (fill: string) =>
      sprite(32, (g, n) => {
        g.translate(n / 2, n / 2);
        g.beginPath();
        g.ellipse(0, 0, 7, 12, 0, 0, Math.PI * 2);
        g.fillStyle = fill;
        g.fill();
        g.beginPath();
        g.ellipse(0, -3, 3, 6, 0, 0, Math.PI * 2);
        g.fillStyle = "rgba(255,255,255,0.45)";
        g.fill();
      });
    return [petal("#f9a8d4"), petal("#fbcfe8"), petal("#f472b6")];
  }
  // Yoz — oltin uchqunlar (asta yuqoriga suzadi, miltillaydi)
  return [
    sprite(32, (g, n) => {
      const r = n / 2;
      const grd = g.createRadialGradient(r, r, 0, r, r, r);
      grd.addColorStop(0, "rgba(255,236,150,1)");
      grd.addColorStop(0.35, "rgba(250,204,21,0.75)");
      grd.addColorStop(1, "rgba(250,204,21,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, n, n);
    }),
  ];
}

export default function SeasonCanvas({ season }: { season: Season }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const sprites = makeSprites(season);
    const rising = season === "summer";
    const weak = (navigator.hardwareConcurrency ?? 4) <= 2;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const parts: Particle[] = [];

    const spawn = (anyY: boolean): Particle => {
      const base = season === "winter" ? 16 + Math.random() * 16 : season === "summer" ? 8 + Math.random() * 10 : 18 + Math.random() * 14;
      return {
        x: Math.random() * w,
        y: anyY ? Math.random() * h : rising ? h + 20 : -30,
        vx: (Math.random() - 0.5) * 12,
        vy: (rising ? -1 : 1) * (season === "winter" ? 22 + Math.random() * 30 : season === "summer" ? 8 + Math.random() * 10 : 30 + Math.random() * 28),
        s: base,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * (season === "winter" ? 0.8 : 1.6),
        ph: Math.random() * Math.PI * 2,
        sp: 0.6 + Math.random() * 1.2,
        img: Math.floor(Math.random() * sprites.length),
      };
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      let n = Math.round(Math.min(36, Math.max(12, (w * h) / 42000)));
      if (weak) n = Math.ceil(n / 2);
      if (parts.length > n) parts.length = n;
      while (parts.length < n) parts.push(spawn(true));
    };
    resize();

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let t = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      acc += now - last;
      last = now;
      if (acc < FRAME_MS) return;
      const dt = Math.min(acc, 100) / 1000;
      acc = 0;
      t += dt;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < parts.length; i++) {
        let p = parts[i];
        p.x += (p.vx + Math.sin(t * p.sp + p.ph) * (season === "winter" ? 10 : 26)) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (rising ? p.y < -30 : p.y > h + 30) p = parts[i] = spawn(false);
        if (p.x < -40) p.x = w + 30;
        else if (p.x > w + 40) p.x = -30;
        // Barg/gulbarg "aylanib" tushadi — eni cos bilan torayadi (3D taassurot, qo'shimcha chizishsiz)
        const flip = season === "winter" || rising ? 1 : 0.45 + 0.55 * Math.abs(Math.cos(t * p.sp * 1.4 + p.ph));
        const c = Math.cos(p.rot) * dpr;
        const s = Math.sin(p.rot) * dpr;
        ctx.setTransform(c * flip, s * flip, -s, c, p.x * dpr, p.y * dpr);
        ctx.globalAlpha = rising ? 0.35 + 0.55 * Math.abs(Math.sin(t * p.sp * 1.8 + p.ph)) : 0.9;
        ctx.drawImage(sprites[p.img], -p.s / 2, -p.s / 2, p.s, p.s);
      }
      ctx.globalAlpha = 1;
    };
    const start = () => {
      if (raf || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVis = () => (document.hidden ? stop() : start());
    let rt: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(rt);
      rt = setTimeout(resize, 150);
    };
    start();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      stop();
      clearTimeout(rt);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
    };
  }, [season]);

  return <canvas ref={ref} className="season-canvas" data-season={season} data-testid="season-effects" aria-hidden />;
}
