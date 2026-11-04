// 125: sayt bezaklari — (1) sidebar'dagi faol band yonida bestseller kitob muqovasi (standart — "365" jurnal; admin
// kitob tanlaydi; muqovasi yo'q bo'lsa — standart; "Ko'rsatilmasin"); (2) mavsumiy effekt (qor/barg/gulbarg/uchqun):
// o'chiq bo'lsa canvas ham, chunk ham yo'q; yoqilsa mijoz sahifalarida bitta canvas (bosishlarga xalaqit bermaydi),
// reader'da va admin panelda yo'q, reduced-motion'da yo'q, vkladka yashirilsa to'xtaydi. Admin "Ko'rinish" → "Bezaklar".
import { launch, BASE, API_HOST, reset, mockGet, selectPick, ignorablePageError, makeCheck } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const FREE_ART = "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1";
const BOOK2 = "22222222-2222-4222-8222-000000000001"; // "Kitob 2"
const { check, done } = makeCheck();
const setDecor = (d) => fetch(`${API_HOST}/__app-settings?set=${encodeURIComponent(JSON.stringify({ decor: d }))}`);
await reset("");

const browser = await launch();
const errors = [];
const watch = (p) => p.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));

// ---- Standart: effekt o'chiq, faol band yonida "365" jurnal muqovasi
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
watch(page);
const chunks = [];
page.on("request", (r) => /season-canvas/.test(r.url()) && chunks.push(r.resourceType() + " " + r.url()));
await page.goto(`${BASE}/daily`);
await page.waitForSelector('[data-testid="nav-bestseller"]', { timeout: 20000 });
const peek = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="nav-bestseller"]');
  return { inActive: !!el.closest(".side-link.active"), count: document.querySelectorAll('[data-testid="nav-bestseller"]').length, src: el.querySelector("img").getAttribute("src") };
});
check("Bestseller muqovasi — faqat faol band ichida, bitta", peek.inActive && peek.count === 1, JSON.stringify(peek));
check("Standart muqova — 365 jurnal", peek.src === "/covers/mag-1-peek@2x.webp", peek.src);
await page.waitForTimeout(2500);
check("Effekt o'chiq: canvas yo'q", (await page.locator('[data-testid="season-effects"]').count()) === 0);
// Dev server (Turbopack) async chunk'larni oldindan yuklaydi — "0 bayt" faqat production'da tekshiriladi
if (process.env.E2E_PROD) check("Effekt o'chiq: canvas chunk'i yuklanmadi", chunks.length === 0, chunks.join(","));
// 125.4: muqova yangi bandga uchib o'tadi — WAAPI chaqiruvlarini sanaymiz
await page.evaluate(() => {
  window.__flights = [];
  const orig = Element.prototype.animate;
  Element.prototype.animate = function (kf, opts) {
    if (this.classList?.contains("side-bestseller")) window.__flights.push(kf[0].transform);
    return orig.call(this, kf, opts);
  };
});
await page.click('.side-link[href="/catalog"]');
await page.waitForURL(/\/catalog$/);
await page.waitForTimeout(900);
const flights = await page.evaluate(() => window.__flights);
const dy = Number(/translate\([-\d.]+px, ([-\d.]+)px\)/.exec(flights[0] ?? "")?.[1]);
check("Bo'lim almashganda muqova yuqoridagi banddan pastga uchib o'tadi", flights.length === 1 && dy < -20, JSON.stringify(flights));
check("Bo'lim almashganda muqova yangi faol bandga ko'chadi", (await page.locator('.side-link[href="/catalog"] [data-testid="nav-bestseller"]').count()) === 1 && (await page.locator('[data-testid="nav-bestseller"]').count()) === 1);
await page.locator(".client-side-nav").screenshot({ path: OUT + "125-nav-bestseller.png" });

// ---- Kuz: barglar
await setDecor({ season: "autumn", bestseller: BOOK2, bestseller_title: "Kitob 2" });
await page.goto(`${BASE}/daily`);
await page.waitForSelector('[data-testid="season-effects"]', { timeout: 15000 });
const cv = await page.evaluate(() => {
  const c = document.querySelector('[data-testid="season-effects"]');
  const s = getComputedStyle(c);
  return { season: c.dataset.season, pe: s.pointerEvents, pos: s.position, w: c.width, h: c.height, n: document.querySelectorAll("canvas.season-canvas").length };
});
check("Kuz: bitta fixed canvas, pointer-events none, barglar", cv.season === "autumn" && cv.pe === "none" && cv.pos === "fixed" && cv.n === 1 && cv.w > 0, JSON.stringify(cv));
// Muqovasi yo'q kitob (mock) — standart muqovaga qaytadi
await page.waitForFunction(() => document.querySelector('[data-testid="nav-bestseller"] img')?.getAttribute("src") === "/covers/mag-1-peek@2x.webp", null, { timeout: 8000 }).catch(() => undefined);
check("Tanlangan kitobning muqovasi yo'q — standart muqova", (await page.getAttribute('[data-testid="nav-bestseller"] img', "src")) === "/covers/mag-1-peek@2x.webp");
check("Kitob nomi — title'da", (await page.getAttribute('[data-testid="nav-bestseller"]', "title")) === "Kitob 2");
// Canvas chizyapti (piksellar o'zgaradi) — va bosishlar o'tadi
const sig = () => page.evaluate(() => document.querySelector('[data-testid="season-effects"]').toDataURL().length);
const s1 = await sig();
await page.waitForTimeout(600);
const s2 = await sig();
check("Canvas jonli (kadrlar o'zgaradi)", s1 !== s2);
await page.click('.side-link[href="/catalog"]');
await page.waitForURL(/\/catalog$/, { timeout: 8000 });
check("Effekt ustidan bosish ishlaydi (nav)", page.url().endsWith("/catalog"));
await page.screenshot({ path: OUT + "125-autumn.png" });

// ---- Qish: qor (yorug' va qorong'i)
await setDecor({ season: "winter", bestseller: "default" });
await page.goto(`${BASE}/daily`);
await page.waitForSelector('[data-testid="season-effects"][data-season="winter"]', { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + "125-winter.png" });
for (const season of ["spring", "summer"]) {
  await setDecor({ season, bestseller: "default" });
  await page.goto(`${BASE}/daily`);
  await page.waitForSelector(`[data-testid="season-effects"][data-season="${season}"]`, { timeout: 15000 });
  await page.waitForTimeout(800);
  check(`${season}: effekt chizildi`, true);
  await page.screenshot({ path: OUT + `125-${season}.png` });
}

// ---- Reader'da yo'q
await page.goto(`${BASE}/reader/${FREE_ART}`);
await page.waitForTimeout(3500);
check("Reader'da effekt yo'q", (await page.locator('[data-testid="season-effects"]').count()) === 0);

// ---- Reduced motion — yo'q
const rctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
const rp = await rctx.newPage();
await rp.goto(`${BASE}/daily`);
await rp.waitForSelector('[data-testid="nav-bestseller"]', { timeout: 20000 });
await rp.waitForTimeout(3000);
check("prefers-reduced-motion: effekt yo'q", (await rp.locator('[data-testid="season-effects"]').count()) === 0);
await rctx.close();

// ---- "Ko'rsatilmasin" — muqova yo'q
await setDecor({ season: "off", bestseller: "off" });
await page.goto(`${BASE}/daily`);
await page.waitForSelector(".side-link.active", { timeout: 20000 });
await page.waitForTimeout(1500);
check("Bestseller 'off' — muqova yo'q", (await page.locator('[data-testid="nav-bestseller"]').count()) === 0);

// ---- Admin: "Ko'rinish" → "Bezaklar"
await reset("");
const admin = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
watch(admin);
await admin.goto(`${BASE}/login`);
await admin.fill('input[autocomplete="username"]', "admin@articles365.local");
await admin.fill('input[type="password"]', "Admin12345!");
await admin.click('button[type="submit"]');
await admin.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
await admin.goto(`${BASE}/admin/appearance`);
await admin.waitForSelector('[data-testid="decor-settings"]', { timeout: 20000 });
check("Admin panelda effekt yo'q", (await admin.locator('[data-testid="season-effects"]').count()) === 0);
check("Saqlash tugmasi o'zgarishsiz — o'chiq", await admin.isDisabled('[data-testid="decor-save"]'));
await admin.click('[data-testid="decor-season"] [data-id="auto"]');
await selectPick(admin, '[data-testid="decor-bestseller"]', BOOK2);
await admin.click('[data-testid="decor-save"]');
await admin.waitForSelector("text=Bezaklar saqlandi", { timeout: 8000 });
const saved = (await mockGet("/__app-settings")).decor;
check("Admin: serverga saqlandi (auto + kitob + nom)", saved?.season === "auto" && saved?.bestseller === BOOK2 && saved?.bestseller_title === "Kitob 2", JSON.stringify(saved));
await admin.locator('[data-testid="decor-settings"]').screenshot({ path: OUT + "125-admin-decor.png" });
await admin.goto(`${BASE}/daily`);
await admin.waitForSelector('[data-testid="season-effects"]', { timeout: 15000 });
const month = new Date().getMonth();
const expect = month === 11 || month <= 1 ? "winter" : month <= 4 ? "spring" : month <= 7 ? "summer" : "autumn";
check(`Avtomatik — joriy mavsum (${expect})`, (await admin.getAttribute('[data-testid="season-effects"]', "data-season")) === expect);

check("Sahifa xatolari yo'q", errors.length === 0, errors.join(" | "));
await browser.close();
done();
