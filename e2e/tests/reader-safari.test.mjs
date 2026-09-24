// 28/29 — iPhone/iPad va MacBook Safari'da reader: Safari 17/18 da yo'q JS imkoniyatlari (Map.getOrInsertComputed,
// ReadableStream async iteratori va h.k.)
// sahifada ham, pdf.js worker ichida ham o'chirib tashlanadi — reader baribir ochilib, sahifa chizilishi kerak.
// (Haqiqiy xato: "this._requestsByChunk.getOrInsertComputed is not a function" — iPhone, 2026-09-24)
import { launch, BASE, reset, ignorablePageError } from "../lib.mjs";
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

// iOS 17/18 Safari'da yo'q (yoki yaqinda qo'shilgan) imkoniyatlar
const STRIP = `(() => {
  const del = (o, ks) => { for (const k of ks) { try { if (o && k in o) delete o[k]; } catch {} } };
  del(Map.prototype, ["getOrInsert", "getOrInsertComputed"]);
  del(WeakMap.prototype, ["getOrInsert", "getOrInsertComputed"]);
  del(Math, ["sumPrecise"]);
  del(Error, ["isError"]);
  del(RegExp, ["escape"]);
  del(Promise, ["try"]);
  del(Uint8Array, ["fromBase64", "fromHex"]);
  del(Uint8Array.prototype, ["toBase64", "toHex", "setFromBase64", "setFromHex"]);
  // 29: Safari 17/18 (macOS, iOS) — ReadableStream async iteratori yo'q (for await … of stream). Haqiqiy Safari 17.4
  // da tasdiqlangan: pdf.js getTextContent() "undefined is not a function" bilan yiqilib, reader bo'sh qolardi
  del(ReadableStream.prototype, ["values", Symbol.asyncIterator]);
  globalThis.__stripped = typeof Map.prototype.getOrInsertComputed === "undefined" && typeof ReadableStream.prototype[Symbol.asyncIterator] === "undefined";
})();\n`;

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await ctx.addInitScript(STRIP);
// Worker ichida ham: worker fayli boshiga o'sha kod qo'shiladi
await ctx.route("**/pdf.worker.min.mjs", async (route) => {
  const r = await route.fetch();
  return route.fulfill({ response: r, body: STRIP + (await r.text()), headers: { ...r.headers(), "content-type": "text/javascript" } });
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
page.on("console", (m) => m.type() === "error" && /getOrInsert|is not a function|\[reader\]/.test(m.text()) && errors.push(m.text()));

await page.goto(`${BASE}/login`);
check("Safari taqlidi: sahifada Map.getOrInsertComputed va ReadableStream iteratori yo'q", (await page.evaluate(() => globalThis.__stripped)) === true);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
await page.goto(`${BASE}/reader/${ART}`);
const drawn = await page
  .waitForFunction(() => [...document.querySelectorAll(".reader-page canvas")].some((c) => c.width > 0), null, { timeout: 40000 })
  .then(() => true)
  .catch(() => false);
const errorText = await page.evaluate(() => document.querySelector('[role="alert"]')?.textContent ?? "");
check("Reader ochildi va 1-sahifa chizildi (eski Safari imkoniyatlari bilan)", drawn && !errorText, errorText.slice(0, 160));
const textLayer = await page
  .waitForFunction(() => document.querySelectorAll('[data-page="1"] .textLayer span').length > 0, null, { timeout: 20000 })
  .then(() => true)
  .catch(() => false);
check("Matn qatlami ham tayyor", textLayer);
check("\"... is not a function\" xatolari yo'q", errors.length === 0, errors.join(" | ").slice(0, 200));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
