// 9.4 — katta PDF (≈60 MB, 300 sahifa) Range streaming: faqat kerakli bo'laklar, to'liq yuklab olinmaydi, ochilish vaqti, xotira
import { launch, BASE, API, reset, mockGet } from "../lib.mjs";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
const ART = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const MOCK = API.replace("/api/v1", "");
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BIG = OUT + "big.pdf";
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };

// ---- ~60 MB PDF: 300 sahifa, har birida 200 KB siqilmaydigan (tasodifiy) kulrang tasvir + matn.
// Obyektlar tartibi haqiqiy PDF'lardagidek: sahifa/kontent obyektlari boshida (guruhlangan), tasvirlar oxirida —
// aks holda PDF.js `checkLastPage` (Kids daraxtini kezish) har bo'lakka tegib, butun faylni so'raydi.
function makeBigPdf(pages = 300, imgBytes = 200_000) {
  const parts = []; const offsets = []; let pos = 0;
  const push = (buf) => { parts.push(buf); pos += buf.length; };
  const obj = (n, body) => { offsets[n] = pos; push(Buffer.from(`${n} 0 obj\n`)); push(body); push(Buffer.from(`\nendobj\n`)); };
  push(Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1"));
  const W = 500, H = imgBytes / 500; // 500x400 gray
  const total = 3 + pages * 3;
  const pageN = (i) => 4 + i, contN = (i) => 4 + pages + i, imgN = (i) => 4 + 2 * pages + i;
  const kids = Array.from({ length: pages }, (_, i) => `${pageN(i)} 0 R`).join(" ");
  obj(1, Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, Buffer.from(`<< /Type /Pages /Count ${pages} /Kids [${kids}] >>`));
  obj(3, Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"));
  for (let i = 0; i < pages; i++) obj(pageN(i), Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> /XObject << /Im ${imgN(i)} 0 R >> >> /Contents ${contN(i)} 0 R >>`));
  for (let i = 0; i < pages; i++) {
    const content = `BT /F1 24 Tf 72 720 Td (Page ${i + 1} of ${pages}) Tj ET\nq 468 0 0 374 72 300 cm /Im Do Q`;
    obj(contN(i), Buffer.from(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  }
  const rnd = Buffer.alloc(imgBytes);
  for (let i = 0; i < pages; i++) {
    for (let k = 0; k < imgBytes; k += 4) rnd.writeUInt32LE((Math.random() * 0xffffffff) >>> 0, k);
    obj(imgN(i), Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${imgBytes} >>\nstream\n`), rnd, Buffer.from("\nendstream")]));
  }
  const xref = pos;
  let x = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= total; n++) x += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  push(Buffer.from(x + `trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  return Buffer.concat(parts);
}
if (!existsSync(BIG) || statSync(BIG).size < 50_000_000 || process.env.E2E_REGEN_BIG) { console.log("(60 MB PDF yaratilmoqda…)"); writeFileSync(BIG, makeBigPdf()); }
const SIZE = statSync(BIG).size;
console.log(`big.pdf: ${(SIZE / 1e6).toFixed(1)} MB`);
await reset("");
const set = await (await fetch(`${MOCK}/__setbig?path=${encodeURIComponent(BIG)}`)).json();
check("Mock katta PDF ni yukladi", set.size === SIZE, `${set.size}`);

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await browser.close(); process.exit(1); });
await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);

const bytesRequested = async () => (await mockGet("/__log")).filter((l) => l.includes(`${ART}/content bytes=`)).reduce((sum, l) => { const m = /bytes=(\d+)-(\d*)/.exec(l); return sum + (m[2] ? Number(m[2]) - Number(m[1]) + 1 : 0); }, 0);

const t0 = Date.now();
await page.goto(`${BASE}/reader/${ART}`);
await page.waitForFunction(() => [...document.querySelectorAll(".reader-page .textLayer span")].length > 0, null, { timeout: 60000 });
const openMs = Date.now() - t0;
const after1 = await bytesRequested();
check("60 MB PDF: birinchi sahifa ochildi", true, `${openMs} ms`);
check("Ochilish vaqti < 15 s", openMs < 15000, `${openMs} ms`);
check("Dastlab faylning kichik qismi so'raldi (< 6 MB)", after1 < 6_000_000, `${(after1 / 1e6).toFixed(2)} MB / ${(SIZE / 1e6).toFixed(1)} MB`);
check("Sahifalar soni 300", (await page.locator(".reader-page").count()) === 300);

// oxirgi sahifaga sakrash → faqat o'sha atrofdagi bo'laklar
await page.fill('input[aria-label="Sahifa"]', "300");
await page.press('input[aria-label="Sahifa"]', "Enter");
// render tugashi: matn qatlami canvas'dan keyin chiziladi (tasvir bo'lagi shu paytgacha kelgan bo'ladi)
await page.waitForFunction(() => document.querySelectorAll('[data-page="300"] .textLayer span').length > 0, null, { timeout: 60000 });
const after2 = await bytesRequested();
check("300-sahifaga sakrash: faqat o'sha atrofdagi bo'laklar (0.2–6 MB)", after2 - after1 >= 200_000 && after2 - after1 < 6_000_000, `+${((after2 - after1) / 1e6).toFixed(2)} MB`);
const tail = (await mockGet("/__log")).filter((l) => l.includes(`${ART}/content bytes=`)).map((l) => Number(/bytes=(\d+)-/.exec(l)[1]));
check("Fayl oxiridagi (>50 MB) bo'lak so'raldi — 300-sahifa tasviri", tail.some((b) => b > 50_000_000));
check("Jami so'ralgan < 25% fayl (to'liq yuklab olinmagan)", after2 < SIZE * 0.25, `${(after2 / 1e6).toFixed(2)} MB`);
const full = (await mockGet("/__log")).some((l) => l === `GET /reader/articles/${ART}/content`);
check("Range'siz to'liq GET so'ralmagan", !full);

// xotira (Chrome)
const mem = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1));
check("JS heap < 400 MB", mem === -1 || mem < 400, `${mem} MB`);
await page.screenshot({ path: OUT + "120-bigpdf.png" });

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
