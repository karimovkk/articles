// 71: telefonda o'qish — ikki barmoq bilan zoom (faqat kitob; brauzer sahifani kattalashtirmaydi), ikki marta tegish,
// tasodifiy belgilash yo'q (qisqa tegish / surish / qisqa ushlab surish), uzoq bosish — so'z tanlanadi.
// Haqiqiy sensor hodisalari: CDP Input.dispatchTouchEvent (Chromium, isMobile + hasTouch).
import { launch, BASE, reset, IS_CHROMIUM, makeCheck } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const { check, done } = makeCheck();
if (!IS_CHROMIUM) {
  console.log("⏭  Faqat Chromium (CDP sensor hodisalari)");
  process.exit(0);
}
await reset("");
const browser = await launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openReader(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[autocomplete="username"]', "user@articles365.local");
  await page.fill('input[type="password"]', "User12345!");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
  await page.goto(`${BASE}/reader/${ART}`);
  await page.waitForFunction(() => document.querySelector('[data-page="1"] .textLayer span') && document.querySelector(".reader-page canvas")?.width > 0, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp };
}

const touch = (cdp, type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i, radiusX: 4, radiusY: 4, force: 1 })) });
async function pinch(cdp, cx, cy, d0, d1, steps = 12, shift = [0, 0]) {
  const at = (d, k) => [[cx - d / 2 + shift[0] * k, cy + shift[1] * k], [cx + d / 2 + shift[0] * k, cy + shift[1] * k]];
  await touch(cdp, "touchStart", at(d0, 0));
  for (let i = 1; i <= steps; i++) {
    await touch(cdp, "touchMove", at(d0 + ((d1 - d0) * i) / steps, i / steps));
    await sleep(16);
  }
  await touch(cdp, "touchEnd", []);
}
async function tap(cdp, x, y, hold = 40) {
  await touch(cdp, "touchStart", [[x, y]]);
  await sleep(hold);
  await touch(cdp, "touchEnd", []);
}
async function drag(cdp, x, y, dx, dy, holdFirst = 0, steps = 10) {
  await touch(cdp, "touchStart", [[x, y]]);
  if (holdFirst) await sleep(holdFirst);
  for (let i = 1; i <= steps; i++) {
    await touch(cdp, "touchMove", [[x + (dx * i) / steps, y + (dy * i) / steps]]);
    await sleep(16);
  }
  await touch(cdp, "touchEnd", []);
}
const pageWidth = (page) => page.evaluate(() => Math.round(document.querySelector("[data-page]").getBoundingClientRect().width));
const scrollerBox = (page) => page.evaluate(() => { const r = document.querySelector('[data-testid="reader-scroller"]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const selectionOpen = (page) => page.locator('[data-testid="selection-vocab"]').count().then((n) => n > 0);
const pickCount = (page) => page.locator('[data-testid="pick-rects"] > div').count();
// So'z (span) — ekrandagi markaz nuqtasiga eng yaqin
const spanNear = (page, x, y) =>
  page.evaluate(([x, y]) => {
    let best = null;
    let bd = Infinity;
    document.querySelectorAll(".textLayer span").forEach((s, i) => {
      const r = s.getBoundingClientRect();
      if (r.width < 4 || !s.textContent.trim()) return;
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d < bd) {
        bd = d;
        best = { i, x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top, h: r.height };
      }
    });
    return best;
  }, [x, y]);
const spanCenter = (page, i) => page.evaluate((i) => { const r = document.querySelectorAll(".textLayer span")[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);

// ---- 390px telefon
const { page, cdp } = await openReader(390, 844);
{
  const box = await scrollerBox(page);
  const cx = Math.round(box.x + box.w / 2);
  const cy = Math.round(box.y + box.h * 0.45);
  const w0 = await pageWidth(page);

  // Ikki barmoq bilan kattalashtirish: 100 → 200 px (×2)
  const ref = await spanNear(page, cx, cy);
  const sc = await page.evaluate(() => { const s = document.querySelector('[data-testid="reader-scroller"]'); return { l: s.scrollLeft, t: s.scrollTop }; });
  // Harakat o'rtasida — foiz ko'rinadi
  await touch(cdp, "touchStart", [[cx - 50, cy], [cx + 50, cy]]);
  for (let i = 1; i <= 6; i++) {
    await touch(cdp, "touchMove", [[cx - 50 - (25 * i) / 6, cy], [cx + 50 + (25 * i) / 6, cy]]);
    await sleep(16);
  }
  const pillMid = await page.evaluate(() => { const p = document.querySelector('[data-testid="zoom-pill"]'); return p.classList.contains("on") ? p.textContent : ""; });
  const tfMid = await page.evaluate(() => document.querySelector('[data-testid="reader-scroller"]').style.transform);
  for (let i = 1; i <= 6; i++) {
    await touch(cdp, "touchMove", [[cx - 75 - (25 * i) / 6, cy], [cx + 75 + (25 * i) / 6, cy]]);
    await sleep(16);
  }
  await touch(cdp, "touchEnd", []);
  check("Pinch paytida: kitob silliq kattalashadi (transform) va foiz ko'rinadi", /scale\(1\.[3-6]/.test(tfMid) && /^1[3-6]\d%$/.test(pillMid), `${tfMid} · ${pillMid}`);
  await page.waitForFunction((w0) => document.querySelector("[data-page]").getBoundingClientRect().width > w0 * 1.8, w0, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  const w1 = await pageWidth(page);
  const vv = await page.evaluate(() => window.visualViewport?.scale ?? 1);
  check("Pinch ×2: kitob 2 barobar kattalashdi, brauzer sahifasi (panel, tugmalar) kattalashmadi", Math.abs(w1 / w0 - 2) < 0.08 && vv === 1, `${w0}→${w1}px, viewport scale ${vv}`);
  check("Pinch: transform tozalandi (aniq chizilgan)", (await page.evaluate(() => document.querySelector('[data-testid="reader-scroller"]').style.transform)) === "");
  const after = await spanCenter(page, ref.i);
  const expX = cx + (ref.x - cx) * (w1 / w0);
  const expY = cy + (ref.y - cy) * (w1 / w0);
  check("Pinch: barmoqlar orasidagi joy o'rnida qoldi (so'z kutilgan nuqtada)", Math.hypot(after.x - expX, after.y - expY) < 24, `kutilgan (${Math.round(expX)},${Math.round(expY)}) · bor (${Math.round(after.x)},${Math.round(after.y)}) · scroll avval ${JSON.stringify(sc)}`);
  const hs = await page.evaluate(() => { const s = document.querySelector('[data-testid="reader-scroller"]'); return { sw: s.scrollWidth, cw: s.clientWidth, doc: document.documentElement.scrollWidth - innerWidth }; });
  check("Kattalashganda yon tomonga surish mumkin (sahifa ekrandan keng), sahifaning o'zi toshmaydi", hs.sw > hs.cw + 100 && hs.doc <= 1, JSON.stringify(hs));
  await page.screenshot({ path: OUT + "98-reader-pinch-200-390.png" });
  // Yon tomonga surish
  const l0 = await page.evaluate(() => document.querySelector('[data-testid="reader-scroller"]').scrollLeft);
  await drag(cdp, cx + 80, cy + 120, -140, 0);
  await page.waitForTimeout(400);
  const l1 = await page.evaluate(() => document.querySelector('[data-testid="reader-scroller"]').scrollLeft);
  check("Bir barmoq bilan chapga surish — kitob yon tomonga suriladi, belgilanmaydi", l1 > l0 + 60 && !(await selectionOpen(page)) && (await pickCount(page)) === 0, `${l0}→${l1}`);

  // Kichraytirish: 200 → 100 px (÷2) → 100%
  await pinch(cdp, cx, cy, 220, 110);
  await page.waitForTimeout(500);
  const w2 = await pageWidth(page);
  check("Pinch ÷2: kitob yana 100% ga qaytdi", Math.abs(w2 - w0) <= 3, `${w2} / ${w0}`);
  // Chegara: juda kichraytirish — 60% dan kichik emas
  await pinch(cdp, cx, cy, 240, 40);
  await page.waitForTimeout(500);
  const wMin = await pageWidth(page);
  check("Chegara: 60% dan kichraymaydi", Math.abs(wMin / w0 - 0.6) < 0.04, `${wMin / w0}`);
  await pinch(cdp, cx, cy, 60, 100); // 0.6 × 1.67 ≈ 1.0
  await page.waitForTimeout(500);

  // Ikki marta tegish — 175% ↔ 100%
  const wA = await pageWidth(page);
  const t = await spanNear(page, cx, cy + 60);
  await tap(cdp, t.x, t.y);
  await sleep(120);
  await tap(cdp, t.x, t.y);
  await page.waitForTimeout(600);
  const wB = await pageWidth(page);
  check("Ikki marta tegish → 175%", Math.abs(wB / wA - 1.75) < 0.1, `${wA}→${wB}`);
  check("Ikki marta tegish — hech narsa belgilanmadi", !(await selectionOpen(page)) && (await pickCount(page)) === 0);
  await tap(cdp, cx, cy);
  await sleep(120);
  await tap(cdp, cx, cy);
  await page.waitForTimeout(600);
  check("Yana ikki marta tegish → 100%", Math.abs((await pageWidth(page)) - wA) <= 3);

  // Tasodifiy belgilash yo'q
  const w = await spanNear(page, cx, cy + 40);
  await tap(cdp, w.x, w.y);
  await page.waitForTimeout(400);
  check("Matnga qisqa tegish — belgilanmaydi", !(await selectionOpen(page)) && (await pickCount(page)) === 0);
  const top0 = await page.evaluate(() => document.querySelector('[data-testid="reader-scroller"]').scrollTop);
  await drag(cdp, w.x, w.y + 80, 0, -220);
  await page.waitForTimeout(500);
  const top1 = await page.evaluate(() => document.querySelector('[data-testid="reader-scroller"]').scrollTop);
  check("Matn ustidan surish (scroll) — sahifa siljiydi, belgilanmaydi", top1 > top0 + 80 && !(await selectionOpen(page)) && (await pickCount(page)) === 0, `${top0}→${top1}`);
  const w2b = await spanNear(page, cx, cy);
  await drag(cdp, w2b.x, w2b.y, 0, -160, 300);
  await page.waitForTimeout(500);
  check("Barmoq 0,3 s turib keyin surilsa ham — belgilanmaydi (chegara 0,5 s)", !(await selectionOpen(page)) && (await pickCount(page)) === 0);

  // Uzoq bosish (0,7 s) — so'z tanlanadi, panel chiqadi
  const lw = await spanNear(page, cx, cy);
  await page.evaluate(() => { window.__vib = 0; navigator.vibrate = () => { window.__vib++; return true; }; });
  await touch(cdp, "touchStart", [[lw.l + 6, lw.t + lw.h / 2]]);
  await sleep(700);
  const pickWhileHold = await pickCount(page);
  await touch(cdp, "touchEnd", []);
  await page.waitForTimeout(400);
  check("Uzoq bosish: so'z darhol tanlandi (ushlab turganda ko'rinadi) + tebranish", pickWhileHold > 0 && (await page.evaluate(() => window.__vib)) === 1, `rects ${pickWhileHold}`);
  check("Uzoq bosish → barmoq ko'tarilgach tanlov paneli", await selectionOpen(page));
  await page.screenshot({ path: OUT + "98-reader-longpress-390.png" });
  // Panel ochiq — boshqa joyga tegish yopadi
  await tap(cdp, cx, box.y + box.h - 120);
  await page.waitForTimeout(400);
  check("Boshqa joyga tegish — tanlov yopiladi", !(await selectionOpen(page)) && (await pickCount(page)) === 0);
  // Uzoq bosib sudrash — bir necha so'z
  const lw2 = await spanNear(page, cx - 60, cy);
  await touch(cdp, "touchStart", [[lw2.l + 4, lw2.t + lw2.h / 2]]);
  await sleep(650);
  for (let i = 1; i <= 8; i++) {
    await touch(cdp, "touchMove", [[lw2.l + 4 + 15 * i, lw2.t + lw2.h / 2 + 3 * i]]);
    await sleep(16);
  }
  await touch(cdp, "touchEnd", []);
  await page.waitForTimeout(400);
  check("Uzoq bosib sudrash — matn tanlanadi", (await selectionOpen(page)) && (await pickCount(page)) > 0);
  await tap(cdp, cx, box.y + box.h - 120);
}

// ---- 320px va 768px: pinch ishlaydi, sahifa toshmaydi
// (bitta seans — qayta kirish shart emas; o'lcham o'zgartirilib, o'quvchi qayta ochiladi)
for (const [W, H] of [[320, 640], [768, 1024]]) {
  await page.setViewportSize({ width: W, height: H });
  await page.reload();
  // Saqlangan joydan davom etadi (1-sahifa bo'lmasligi mumkin) — istalgan chizilgan sahifa
  await page.waitForFunction(() => document.querySelector(".textLayer span") && [...document.querySelectorAll(".reader-page canvas")].some((c) => c.width > 0), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const box = await scrollerBox(page);
  const w0 = await pageWidth(page);
  await pinch(cdp, Math.round(box.x + box.w / 2), Math.round(box.y + box.h / 2), 80, 120);
  await page.waitForTimeout(500);
  const w1 = await pageWidth(page);
  const vv = await page.evaluate(() => window.visualViewport?.scale ?? 1);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(`${W}px: pinch ×1.5 — faqat kitob (${w0}→${w1}px), sahifa toshmaydi`, Math.abs(w1 / w0 - 1.5) < 0.08 && vv === 1 && over <= 1, `vv ${vv}, +${over}`);
  await page.screenshot({ path: OUT + `98-reader-pinch-${W}.png` });
}

await done(browser);
