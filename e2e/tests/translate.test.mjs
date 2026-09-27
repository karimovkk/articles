// 41 — Lug'atga avtomatik tarjima (`POST /translate`, backend Google orqali): backend o'chiq (503) bo'lsa jim va shu
// sessiyada qayta so'ralmaydi, so'z qo'shish ishlayveradi; yoqilgach oyna ochilishi bilan tarjima to'ladi ("Google
// tarjimasi" belgisi), foydalanuvchi yozgani bosib ketilmaydi, dublikatda so'ralmaydi, interfeys tili (ru) yuboriladi,
// bir xil til → bo'sh, "Tarjima qilish" tugmasi joriy so'zni tarjima qiladi; provayder uz'ni qo'llamasa (LibreTranslate,
// 502) — o'zbekcha interfeysda ruscha tarjima yoziladi (foydalanuvchi o'zbekchasini o'zi yozadi); telefonda sig'adi.
import { launch, BASE, API_HOST, reset, mockGet, ignorablePageError } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const pageErrors = [];
let page;
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page?.screenshot({ path: OUT + "99-translate-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });

/** Yangi kontekst (yangi JS sessiyasi — "o'chiq" bayrog'i tozalanadi), login va reader */
async function openReader(viewport = { width: 1280, height: 860 }, locale = null) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
  if (locale) await p.addInitScript((l) => localStorage.setItem("a365.locale", l), locale);
  await p.goto(`${BASE}/login`);
  await p.fill('input[autocomplete="username"]', "user@articles365.local");
  await p.fill('input[type="password"]', "User12345!");
  await p.click('button[type="submit"]');
  await p.waitForURL(`${BASE}/library`, { timeout: 30000 });
  await p.goto(`${BASE}/reader/${ART}`);
  await p.waitForFunction(() => document.querySelectorAll('[data-page="1"] .textLayer span').length > 0, null, { timeout: 30000 });
  return p;
}
const dragSelect = async (word) => {
  const b = await page.evaluate((w) => {
    for (const sp of document.querySelectorAll('[data-page="1"] .textLayer span')) {
      const t = sp.firstChild;
      const i = t?.textContent.indexOf(w) ?? -1;
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(t, i);
      r.setEnd(t, i + w.length);
      const x = r.getBoundingClientRect();
      return { x1: x.left + 1, x2: x.right - 1, y: x.top + x.height / 2 };
    }
    return null;
  }, word);
  await page.mouse.move(b.x1, b.y);
  await page.mouse.down();
  for (let n = 1; n <= 6; n++) {
    await page.mouse.move(b.x1 + ((b.x2 - b.x1) * n) / 6, b.y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForSelector('[data-testid="selection-vocab"]', { timeout: 5000 });
};
const openDialog = async (word) => {
  await dragSelect(word);
  await page.click('[data-testid="selection-vocab"]');
  await page.waitForSelector('[data-testid="vocab-dialog"]');
};
const closeDialog = async () => {
  await page.keyboard.press("Escape");
  await page.waitForSelector('[data-testid="vocab-dialog"]', { state: "detached", timeout: 5000 });
};
const trValue = () => page.inputValue('[data-testid="vocab-translation"]');
const trLog = () => mockGet("/__translate-log");

// ---- 1) Backend o'chiq (prod hozirgidek 503) — jim, sessiyada qayta so'ralmaydi, so'z baribir qo'shiladi
page = await openReader();
await openDialog("quick");
await page.waitForTimeout(800);
check("O'chiq backend: 1 ta so'rov, maydon bo'sh, xato ko'rsatilmadi", (await trLog()).length === 1 && (await trValue()) === "" && (await page.locator('[data-testid="vocab-dialog"] .alert').count()) === 0);
check("O'chiq backend: 'Tarjima qilish' tugmasi yashirildi", (await page.locator('[data-testid="vocab-translate"]').count()) === 0);
await closeDialog();
await openDialog("brown");
await page.waitForTimeout(600);
check("O'chiq backend: keyingi so'zda qayta so'ralmadi", (await trLog()).length === 1);
await page.click('[data-testid="vocab-save"]');
await page.waitForSelector('[data-testid="vocab-dialog"]', { state: "detached", timeout: 5000 });
check("Tarjimasiz ham so'z lug'atga qo'shildi", (await mockGet("/__vocab")).some((v) => v.word === "brown" && !v.translation));
await page.context().close();

// ---- 2) Yoqilgan: oyna ochilishi bilan tarjima to'ladi, "Google tarjimasi" belgisi, uz yuboriladi
await fetch(`${API_HOST}/__translate?on=1`);
page = await openReader();
await openDialog("quick");
await page.waitForFunction(() => document.querySelector('[data-testid="vocab-translation"]')?.value === "tez", null, { timeout: 5000 });
const last = (await trLog()).at(-1);
check("Avtomatik tarjima: 'quick' → 'tez' (so'rov: text, source auto, target uz)", last?.text === "quick" && last?.source_lang === "auto" && last?.target_lang === "uz");
check("'Google tarjimasi' belgisi ko'rinadi", (await page.locator('[data-testid="vocab-auto-badge"]').count()) === 1);
await page.screenshot({ path: OUT + "70-vocab-auto-translate.png" });
await page.fill('[data-testid="vocab-translation"]', "tez, chaqqon");
check("Foydalanuvchi o'zgartirsa — belgi yo'qoladi", (await page.locator('[data-testid="vocab-auto-badge"]').count()) === 0);
await page.click('[data-testid="vocab-save"]');
await page.waitForSelector('[data-testid="vocab-dialog"]', { state: "detached", timeout: 5000 });
check("Saqlandi: foydalanuvchi tahriri bilan (POST /me/vocabulary)", (await mockGet("/__vocab")).some((v) => v.word === "quick" && v.translation === "tez, chaqqon"));

// Dublikat — mavjud tarjima, /translate so'ralmaydi
const before = (await trLog()).length;
await openDialog("quick");
await page.waitForTimeout(700);
check("Dublikat so'z: mavjud tarjima, /translate so'ralmadi", (await trValue()) === "tez, chaqqon" && (await trLog()).length === before);
await closeDialog();

// Poyga: javob kechikadi, foydalanuvchi o'zi yozadi — bosib ketilmaydi
await fetch(`${API_HOST}/__translate?on=1&ms=1500`);
await openDialog("fox");
await page.fill('[data-testid="vocab-translation"]', "tulkicha");
await page.waitForTimeout(2200);
check("Poyga: kech kelgan avtomatik tarjima foydalanuvchi yozganini bosmadi", (await trValue()) === "tulkicha" && (await page.locator('[data-testid="vocab-auto-badge"]').count()) === 0);
await fetch(`${API_HOST}/__translate?on=1`);

// "Tarjima qilish" tugmasi — joriy so'zni tarjima qiladi; bir xil til → bo'sh
await page.fill('[data-testid="vocab-word"]', "dog");
await page.click('[data-testid="vocab-translate"]');
await page.waitForFunction(() => document.querySelector('[data-testid="vocab-translation"]')?.value === "it", null, { timeout: 5000 });
check("'Tarjima qilish' tugmasi: yangi so'z (dog → it) — qo'lda so'ralgani uchun almashtiradi", true);
await page.fill('[data-testid="vocab-word"]', "salom");
await page.fill('[data-testid="vocab-translation"]', "");
await page.click('[data-testid="vocab-translate"]');
await page.waitForTimeout(700);
check("Bir xil til (o'zbekcha → uz): maydon bo'sh qoladi", (await trValue()) === "");
await closeDialog();
await page.context().close();

// ---- 3) LibreTranslate (prod'dagi provayder): uz qo'llanmaydi (502) → o'zbekcha interfeysda ruscha tarjima yoziladi;
// ikki marta 502 dan keyin uz so'ralmaydi, to'g'ridan-to'g'ri ru
await fetch(`${API_HOST}/__translate?on=1&nouz=1`);
page = await openReader();
const n0 = (await trLog()).length;
await openDialog("fox");
await page.waitForFunction(() => document.querySelector('[data-testid="vocab-translation"]')?.value === "лиса", null, { timeout: 5000 });
const l1 = (await trLog()).slice(n0).map((x) => x.target_lang).join(",");
check("uz → 502 → ruscha tarjima yozildi (fox → лиса), so'rovlar: uz, ru", l1 === "uz,ru", l1);
check("Izoh: 'Avtomatik tarjima ruscha — o'zbekchasini o'zingiz yozishingiz mumkin'", ((await page.textContent('[data-testid="vocab-auto-badge"]')) ?? "").includes("ruscha"));
await page.screenshot({ path: OUT + "72-vocab-auto-translate-ru-fallback.png" });
await closeDialog();
await openDialog("dog");
await page.waitForFunction(() => document.querySelector('[data-testid="vocab-translation"]')?.value === "собака", null, { timeout: 5000 });
await closeDialog();
const n1 = (await trLog()).length;
await openDialog("lazy");
await page.waitForFunction(() => document.querySelector('[data-testid="vocab-translation"]')?.value !== "", null, { timeout: 5000 });
const l3 = (await trLog()).slice(n1).map((x) => x.target_lang).join(",");
check("uz ikki marta 502 → endi faqat ru so'raladi, 'Tarjima qilish' ko'rinadi", l3 === "ru" && (await page.locator('[data-testid="vocab-translate"]').count()) === 1, l3);
await page.fill('[data-testid="vocab-translation"]', "dangasa");
check("Foydalanuvchi ruschani o'chirib o'zbekcha yozdi — izoh yo'qoldi", (await page.locator('[data-testid="vocab-auto-badge"]').count()) === 0);
await page.click('[data-testid="vocab-save"]');
await page.waitForSelector('[data-testid="vocab-dialog"]', { state: "detached", timeout: 5000 });
check("Saqlandi — foydalanuvchining o'zbekcha tarjimasi bilan", (await mockGet("/__vocab")).some((v) => v.word === "lazy" && v.translation === "dangasa"));
await page.context().close();

// ---- 3) Interfeys tili ru → target_lang ru; telefon o'lchamida oyna sig'adi
page = await openReader({ width: 360, height: 740 }, "ru");
await openDialog("dog");
await page.waitForFunction(() => document.querySelector('[data-testid="vocab-translation"]')?.value === "собака", null, { timeout: 5000 });
check("Interfeys ru: target_lang=ru, 'dog' → 'собака'", (await trLog()).at(-1)?.target_lang === "ru");
const sw = await page.evaluate(() => {
  const d = document.querySelector('[data-testid="vocab-dialog"]').getBoundingClientRect();
  return { page: document.documentElement.scrollWidth - innerWidth, dialog: Math.round(d.right - innerWidth) };
});
check("360px: oyna ekranga sig'adi, gorizontal scroll yo'q", sw.page <= 1 && sw.dialog <= 0, JSON.stringify(sw));
await page.screenshot({ path: OUT + "71-vocab-auto-translate-360-ru.png" });

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
