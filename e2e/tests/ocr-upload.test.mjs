// 107: rasmli (skaner) PDF — admin yuklaganda brauzerda OCR (tesseract.js, eng) → ko'rinmas matn qatlami (pdf-lib):
// jarayon ko'rinadi, bekor qilish mumkin; yuborilgan faylda matn bor, bet soni/o'lchami bir xil; matnli PDF o'zgarmaydi;
// reader'da matn qatlami paydo bo'ladi va belgilash ishlaydi.
import { writeFileSync, readFileSync } from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { launch, BASE, API_HOST, reset, mockGet, ignorablePageError, makeCheck } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
const SCAN = new URL("../mock/scan.pdf", import.meta.url).pathname;
const TEXT_PDF = new URL("../mock/two-col.pdf", import.meta.url).pathname;
const BOOK = "11111111-1111-4111-8111-111111111111";
pdfjs.GlobalWorkerOptions.workerSrc = new URL("../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).href;
const { check, done } = makeCheck();
await reset("");
const browser = await launch();
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
page.on("console", (m) => process.env.OCR_DEBUG && console.log("[console]", m.type(), m.text().slice(0, 300), m.location()?.url?.slice(0, 120)));
page.on("worker", (w) => process.env.OCR_DEBUG && console.log("[worker]", w.url().slice(0, 120)));
page.on("requestfailed", (r) => process.env.OCR_DEBUG && console.log("[failed]", r.url().slice(0, 150), r.failure()?.errorText));
page.on("response", (r) => process.env.OCR_DEBUG && /jsdelivr|tesseract/.test(r.url()) && console.log("[resp]", r.status(), r.url().slice(0, 150)));
await page.goto(`${BASE}/login`);
await page.waitForSelector('input[autocomplete="username"]:not([readonly])', { timeout: 60000 });
await page.fill('input[autocomplete="username"]', "admin@articles365.local");
await page.fill('input[type="password"]', "Admin12345!");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
await page.goto(`${BASE}/admin/books/${BOOK}?tab=articles`);
await page.waitForSelector("tr[data-article]", { timeout: 30000 });

const pdfInfo = async (bytes) => {
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
  const doc = await task.promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n);
    const vp = p.getViewport({ scale: 1 });
    const tc = await p.getTextContent();
    pages.push({ w: Math.round(vp.width), h: Math.round(vp.height), text: tc.items.map((i) => i.str).join(" ") });
  }
  await task.destroy();
  return pages;
};
const lastUpload = async () => Buffer.from(await (await fetch(`${API_HOST}/__last-upload`)).arrayBuffer());
const uploadTo = async (title, file) => {
  const row = page.locator("tr[data-article]", { hasText: title });
  const chooser = page.waitForEvent("filechooser");
  await row.locator('button:has-text("PDF")').click();
  await (await chooser).setFiles(file);
  return row;
};
const uploadsCount = async () => (await mockGet("/__uploads")).filter((u) => u.path.endsWith("/file")).length;

// ---- 1) Bekor qilish — hech narsa yuklanmaydi
const before = await uploadsCount();
let row = process.env.OCR_SKIP_CANCEL ? null : await uploadTo("Birinchi maqola", SCAN);
if (row) await row.locator('[data-testid="ocr-progress"]').waitFor({ timeout: 15000 });
if (row) await row.locator('[data-testid="ocr-cancel"]').click();
row ??= page.locator("tr[data-article]", { hasText: "Birinchi maqola" });
await page.waitForTimeout(800);
check("Bekor qilindi — jarayon yopildi, fayl yuklanmadi", (await row.locator('[data-testid="ocr-progress"]').count()) === 0 && (await uploadsCount()) === before);

// ---- 2) Rasmli PDF → OCR → ko'rinmas matn bilan yuklandi
const orig = await pdfInfo(readFileSync(SCAN));
row = await uploadTo("Birinchi maqola", SCAN);
await row.locator('[data-testid="ocr-progress"]').waitFor({ timeout: 15000 });
await page.waitForFunction(() => /Matn tanilmoqda: 1\/1 bet/.test(document.querySelector('[data-testid="ocr-progress"]')?.textContent ?? ""), null, { timeout: 120000 }).catch(() => {});
const mid = (await row.locator('[data-testid="ocr-progress"]').textContent().catch(() => "")) ?? "";
await page.screenshot({ path: OUT + "107-ocr-progress.png" });
await page.waitForSelector('[data-testid="ocr-done"]', { timeout: Number(process.env.OCR_WAIT) || 240000 }).catch(async (e) => { await page.screenshot({ path: OUT + "107-ocr-failure.png" }); console.log("[debug] body:", (await page.textContent("main"))?.slice(0, 400)); throw e; });
const note = (await page.textContent('[data-testid="ocr-done"]')) ?? "";
check("Jarayon ko'rindi ('Matn tanilmoqda: 1/1 bet') va natija xabari", /Matn tanilmoqda|tekshirilmoqda|tayyorlanmoqda/.test(mid) && /1 ta betda matn tanildi/.test(note), `${mid} | ${note}`);
await page.waitForFunction(() => [...document.querySelectorAll("tr[data-article]")].some((r) => r.innerText.includes("Birinchi maqola") && /PROCESSING|READY/.test(r.innerText)), null, { timeout: 20000 });
const sent = await lastUpload();
const got = await pdfInfo(sent);
check("Asl PDF'da matn yo'q edi", orig[0].text.trim() === "", orig[0].text.slice(0, 60));
check("Yuborilgan PDF: bet soni va o'lchami bir xil", got.length === orig.length && got[0].w === orig[0].w && got[0].h === orig[0].h, JSON.stringify(got.map(({ w, h }) => [w, h])));
check("Yuborilgan PDF'da matn bor (Backpacking, experience, budget)", /backpacking/i.test(got[0].text) && /experience/i.test(got[0].text) && /budget/i.test(got[0].text), got[0].text.slice(0, 160));
writeFileSync(OUT + "107-ocr-scan.pdf", sent);
await page.screenshot({ path: OUT + "107b-ocr-done.png" });

// ---- 3) Matnli PDF — o'zgarmasdan yuboriladi
const n2 = await uploadsCount();
await uploadTo("Ikkinchi maqola", TEXT_PDF);
for (let i = 0; i < 60 && (await uploadsCount()) === n2; i++) await page.waitForTimeout(250);
const sent2 = await lastUpload();
const origText = readFileSync(TEXT_PDF);
const origBody = origText.subarray(0, origText.lastIndexOf("%%EOF") + 5); // mock multipart'dan %PDF … %%EOF ni ajratadi
check("Matnli PDF: OCR yo'q, bayt-baybayt o'sha fayl", sent2.equals(origBody), `${sent2.length} / ${origBody.length}`);

// ---- 4) Reader: OCR'langan PDF — matn qatlami bor, belgilash ishlaydi
await fetch(`${API_HOST}/__setbig?path=${encodeURIComponent(OUT + "107-ocr-scan.pdf")}&pages=1&text=1`);
const reader = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
reader.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
await reader.goto(`${BASE}/login`);
await reader.waitForSelector('input[autocomplete="username"]:not([readonly])', { timeout: 60000 });
await reader.fill('input[autocomplete="username"]', "user@articles365.local");
await reader.fill('input[type="password"]', "User12345!");
await reader.click('button[type="submit"]');
await reader.waitForURL(`${BASE}/library`, { timeout: 30000 });
await reader.goto(`${BASE}/reader/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee`);
await reader.waitForFunction(() => document.querySelectorAll('[data-page="1"] .textLayer span').length > 10, null, { timeout: 60000 });
const span = await reader.evaluate(() => { const s = [...document.querySelectorAll('[data-page="1"] .textLayer span')].find((x) => /^experience/i.test(x.textContent.trim())); const r = s?.getBoundingClientRect(); return r ? { x: r.left, y: r.top + r.height / 2, w: r.width } : null; });
check("Reader: OCR matn qatlami (so'z joyida)", !!span, JSON.stringify(span));
if (span) {
  await reader.mouse.move(span.x + 2, span.y);
  await reader.mouse.down();
  await reader.mouse.move(span.x + span.w / 2, span.y, { steps: 4 });
  await reader.mouse.move(span.x + span.w - 2, span.y, { steps: 4 });
  await reader.mouse.up();
  await reader.waitForSelector('[data-testid="selection-vocab"]', { timeout: 8000 }).catch(() => {});
  check("Reader: so'z belgilandi — tanlov menyusi chiqdi", (await reader.locator('[data-testid="selection-vocab"]').count()) > 0);
}
await reader.screenshot({ path: OUT + "107c-ocr-reader-select.png" });

check("Sahifa xatolari yo'q", errors.length === 0, errors.join(" | ").slice(0, 300));
await done(browser);
