/**
 * Varaq egilishi (17.1) — haqiqiy qog'ozdek varaqlash uchun chizish moduli.
 *
 * Model: qog'oz cho'zilmaydi, shuning uchun uning yoyi uzunligi doim sahifa kengligiga teng. Varaqni umurtqadan
 * (chap chekka) chekkasigacha `STRIPS` ta vertikal tasmaga bo'lamiz; har tasmaning egilish burchagi θ(u) yoy
 * bo'ylab ortadi: umurtqada 0 (sahifa tekis chiqadi), chekkada eng katta. Nuqtalar 3D da (x, z) hisoblanadi va
 * oddiy perspektiva bilan ekranga tushiriladi (yaqinroq tasma kattaroq). Yorug'lik yuqori-chapdan tushadi:
 * har tasmaning normali bo'yicha qorayish va yaltirash qo'shiladi. Burchagi 90° dan oshgan uchi — varaqning
 * orqa tomoni: ko'zguda, oqartirilgan (siyoh ozgina ko'rinib turadi).
 *
 * Chizish faqat `canvas` da bo'ladi: sahifa allaqachon canvas'ga render qilingan, shuning uchun manba sifatida
 * o'sha canvas ishlatiladi (nusxa olinmaydi).
 */

/** Tasmalar soni — 40 dan yuqorisi ko'zga sezilmaydi, pastrog'ida chekka "sinadi" */
const STRIPS = 44;
/** Kamera masofasi (sahifa kengligiga nisbatan) — perspektiva kuchi */
const CAMERA = 5.5;
/** Qo'shni tasmalar orasida ip kabi bo'shliq qolmasligi uchun ustma-ust chiziladi (px) */
const OVERLAP = 0.6;

export interface CurlFrame {
  /** Varaq chekkasining ekrandagi x koordinatasi (px) — kursor ergashuvi uchun */
  edgeX: number;
  /** Varaq butunlay burilgan bo'lsa (ko'rinmaydi) */
  gone: boolean;
}

interface Geometry {
  /** Har tasma chegarasining ekran x'i */
  xs: number[];
  /** Har tasma chegarasidagi masshtab (perspektiva) */
  scales: number[];
  /** Tasma o'rtasidagi burchak (rad) */
  angles: number[];
}

/**
 * Varaq geometriyasi: `progress` 0 — tekis yotibdi, 1 — umurtqada tik turib ko'zdan yo'qoladi.
 * Varaq umurtqa atrofida buriladi (θ0), uning uchi esa qo'shimcha egiladi — o'rtada eng kuchli (qog'oz bukiladi).
 */
function geometry(w: number, progress: number): Geometry {
  const p = Math.max(0, Math.min(1, progress));
  const base = p * (Math.PI / 2) * 0.94; // umurtqadagi burilish
  const curl = Math.sin(Math.PI * p) * 0.62; // uchidagi qo'shimcha egilish
  const shape = 2.4 - 1.2 * p; // egilish taqsimoti: boshida uchida, oxirida kengroq
  const du = w / STRIPS;
  const xs: number[] = [0];
  const scales: number[] = [1];
  const angles: number[] = [];
  const d = CAMERA * w;
  let x3 = 0;
  let z3 = 0;
  for (let i = 0; i < STRIPS; i++) {
    const uMid = (i + 0.5) * du;
    const th = base + curl * Math.pow(uMid / w, shape);
    angles.push(th);
    x3 += Math.cos(th) * du;
    z3 += Math.sin(th) * du;
    const s = d / (d - z3);
    xs.push(w / 2 + (x3 - w / 2) * s);
    scales.push(s);
  }
  return { xs, scales, angles };
}

/** Yorug'lik: yuqori-chapdan; tekis yotgan qog'oz yorug', tikka turgani qorong'i */
function lambert(theta: number): number {
  return Math.max(0, 0.95 * Math.cos(theta) + 0.3 * Math.sin(theta));
}

export interface DrawCurlOptions {
  ctx: CanvasRenderingContext2D;
  /** Varaqning old tomoni — sahifa render qilingan canvas */
  src: CanvasImageSource;
  /** Manba o'lchami (px) */
  srcW: number;
  srcH: number;
  /** Sahifa o'lchami (CSS px) */
  w: number;
  h: number;
  /** 0 — varaq tekis, 1 — burilib bo'ldi */
  progress: number;
  /** Tungi rejimda soyalar biroz yumshoqroq */
  night?: boolean;
}

/** Varaq siluети: yuqori va pastki qirralari (perspektiva tufayli to'g'ri chiziq emas) */
function silhouette(ctx: CanvasRenderingContext2D, xs: number[], scales: number[], h: number) {
  ctx.beginPath();
  for (let i = 0; i < xs.length; i++) ctx.lineTo(xs[i], (h - h * scales[i]) / 2);
  for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(xs[i], (h + h * scales[i]) / 2);
  ctx.closePath();
}

/**
 * Bitta kadrni chizadi: ostidagi sahifaga tushadigan soya → varaq tasmalari (old va orqa tomoni) → yorug'lik.
 * Soyalar tasma-tasma emas, varaq bo'ylab bitta silliq gradient bilan chiziladi (chegaralar ko'rinmasin).
 * Canvas oldindan `clearRect` qilingan bo'lishi kerak.
 */
export function drawCurl({ ctx, src, srcW, srcH, w, h, progress, night = false }: DrawCurlOptions): CurlFrame {
  const p = Math.max(0, Math.min(1, progress));
  // Tungi rejimda reader canvas'ni CSS bilan invert qiladi — shuning uchun "qora" soyani oq qilib chizamiz
  const ink = night ? "255,255,255" : "0,0,0"; // ekranda QORA ko'rinadi
  const glow = night ? "0,0,0" : "255,255,255"; // ekranda OQ ko'rinadi
  const paper = "250,248,242"; // bo'sh qog'oz (tungi rejimda invert bo'lib to'q chiqadi)
  const { xs, scales, angles } = geometry(w, p);
  const edgeX = xs[xs.length - 1];
  // Oxirida varaq umurtqada tikka turadi — ko'rinmas bo'lib yo'qoladi
  const fade = p > 0.9 ? Math.max(0, 1 - (p - 0.9) / 0.1) : 1;
  if (fade <= 0.01) return { edgeX, gone: true };
  // Burchagi 90° dan oshgan tasmalar — varaqning orqa tomoni
  let fold = STRIPS;
  for (let i = 0; i < STRIPS; i++) {
    if (angles[i] > Math.PI / 2) {
      fold = i;
      break;
    }
  }

  ctx.save();
  ctx.globalAlpha = fade;

  // ---- Ko'tarilgan varaqdan ostidagi sahifaga tushadigan soya (varaqdan o'ngga)
  const lift = Math.sin(Math.PI * Math.min(1, p * 1.08));
  if (lift > 0.01) {
    // Tor va tez so'nuvchi soya: qirraga yaqin joyi to'q, 15% dan keyin yo'q bo'ladi
    const end = Math.min(w, edgeX + w * 0.16 * lift);
    if (end > edgeX) {
      const g = ctx.createLinearGradient(edgeX, 0, end, 0);
      const a = (night ? 0.38 : 0.5) * lift;
      g.addColorStop(0, `rgba(${ink},${a})`);
      g.addColorStop(0.18, `rgba(${ink},${a * 0.42})`);
      g.addColorStop(0.55, `rgba(${ink},${a * 0.12})`);
      g.addColorStop(1, `rgba(${ink},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(edgeX, 0, end - edgeX, h);
    }
  }

  // ---- Varaq: tasmalar bo'yicha rasm (siluet ichida)
  ctx.save();
  silhouette(ctx, xs, scales, h);
  ctx.clip();
  const du = srcW / STRIPS;
  for (let i = 0; i < STRIPS; i++) {
    const x0 = xs[i];
    const dw = xs[i + 1] - x0;
    if (Math.abs(dw) < 0.02) continue;
    const s = (scales[i] + scales[i + 1]) / 2;
    const dh = h * s;
    const dy = (h - dh) / 2;
    const sx = i * du;
    if (i >= fold) {
      // Orqa tomon: ko'zguda
      ctx.save();
      ctx.translate(x0, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(src, sx, 0, du, srcH, 0, dy, Math.abs(dw) + OVERLAP, dh);
      ctx.restore();
    } else {
      ctx.drawImage(src, sx, 0, du, srcH, x0, dy, dw + OVERLAP, dh);
    }
  }

  // ---- Orqa tomon oqartiriladi (qog'oz orqasidan siyoh zo'rg'a ko'rinadi)
  if (fold < STRIPS) {
    const from = xs[fold];
    const to = xs[STRIPS];
    ctx.fillStyle = `rgba(${paper},0.88)`;
    ctx.fillRect(Math.min(from, to), 0, Math.abs(to - from) + 1, h);
    // Buklanish chizig'i — old va orqa tomon chegarasi
    const fg = ctx.createLinearGradient(from - w * 0.05, 0, from + w * 0.01, 0);
    fg.addColorStop(0, `rgba(${ink},0)`);
    fg.addColorStop(1, `rgba(${ink},${night ? 0.4 : 0.32})`);
    ctx.fillStyle = fg;
    ctx.fillRect(Math.min(from - w * 0.05, from), 0, w * 0.06, h);
  }

  // ---- Yorug'lik: burchak bo'yicha silliq gradient (tasma chegaralari ko'rinmaydi)
  const shade = ctx.createLinearGradient(0, 0, Math.max(1, Math.abs(edgeX) || 1), 0);
  const last = Math.max(1, xs[fold < STRIPS ? fold : STRIPS]);
  const grad = ctx.createLinearGradient(0, 0, last, 0);
  for (let i = 0; i <= (fold < STRIPS ? fold : STRIPS); i += 2) {
    const t = Math.max(0, Math.min(1, xs[i] / last));
    const lam = lambert(angles[Math.min(i, STRIPS - 1)]);
    const dark = Math.max(0, (1 - lam) * (night ? 0.44 : 0.52));
    grad.addColorStop(t, `rgba(${ink},${dark.toFixed(3)})`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Burma: qog'oz eng ko'p egilgan joyi (chekkaga yaqin) to'qlashadi — egilish ko'zga tashlanadi
  const crease = 0.26 * Math.sin(Math.PI * Math.min(1, p * 1.05));
  if (crease > 0.01 && edgeX > 0) {
    const cg = ctx.createLinearGradient(Math.max(0, edgeX - w * 0.22), 0, edgeX, 0);
    cg.addColorStop(0, `rgba(${ink},0)`);
    cg.addColorStop(0.65, `rgba(${ink},${(crease * 0.55).toFixed(3)})`);
    cg.addColorStop(1, `rgba(${ink},${crease.toFixed(3)})`);
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, w, h);
  }
  // Yaltirash: egilishning yuqori qismida tor och chiziq
  const sheenAt = xs[Math.min(STRIPS - 1, Math.round(STRIPS * 0.72))];
  if (p > 0.04 && sheenAt > 0) {
    const sg = ctx.createLinearGradient(sheenAt - w * 0.12, 0, sheenAt + w * 0.06, 0);
    sg.addColorStop(0, `rgba(${glow},0)`);
    sg.addColorStop(0.6, `rgba(${glow},${(0.16 * Math.sin(Math.PI * p)).toFixed(3)})`);
    sg.addColorStop(1, `rgba(${glow},0)`);
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, h);
  }
  void shade;
  ctx.restore();

  // ---- Varaq qirrasi (qog'oz qalinligi) va umurtqa soyasi
  const sEdge = scales[scales.length - 1];
  ctx.fillStyle = `rgba(${ink},0.2)`;
  ctx.fillRect(edgeX - 0.75, (h - h * sEdge) / 2, 1.5, h * sEdge);
  const gutW = Math.max(8, w * 0.05);
  const gut = ctx.createLinearGradient(0, 0, gutW, 0);
  gut.addColorStop(0, `rgba(${ink},${night ? 0.3 : 0.24})`);
  gut.addColorStop(1, `rgba(${ink},0)`);
  ctx.fillStyle = gut;
  ctx.fillRect(0, 0, gutW, h);

  ctx.restore();
  return { edgeX, gone: false };
}

/** `progress` ↔ chekka koordinatasi: kursor qayerda bo'lsa, varaq chekkasi ham shu yerda bo'lishi uchun jadval */
export function edgeTable(w: number, steps = 64): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const { xs } = geometry(w, i / steps);
    out.push(xs[xs.length - 1]);
  }
  return out;
}

/** Chekka x koordinatasidan `progress` (jadval bo'yicha teskari qidiruv) */
export function progressForEdge(table: number[], edgeX: number): number {
  const steps = table.length - 1;
  // Jadval kamayuvchi: p ortgani sari chekka chapga suriladi
  for (let i = 0; i < steps; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (edgeX <= a && edgeX >= b) {
      const f = a === b ? 0 : (a - edgeX) / (a - b);
      return (i + f) / steps;
    }
  }
  return edgeX > table[0] ? 0 : 1;
}
