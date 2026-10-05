// 41/47 — Lug'atga avtomatik tarjima (`POST /translate`): tarjima tilini o'quvchi o'zi tanlaydi (O'zbekcha · Русский ·
// English — SAYT TILI EMAS); til tanlanmaguncha so'ralmaydi, tanlangach shu tilga tarjima, tanlov eslab qolinadi
// (keyingi so'zda avtomatik), boshqa til bosilsa — qayta tarjima; backend o'chiq (503) — jim, sessiyada qayta
// so'ralmaydi, til tugmalari yashiriladi, so'z qo'shish ishlayveradi; foydalanuvchi yozgani bosib ketilmaydi, dublikatda
// so'ralmaydi, bir xil til → bo'sh; provayder uz'ni qo'llamasa (502) — ruscha tarjima + izoh; telefonda sig'adi.
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
async function openReader(viewport = { width: 1280, height: 860 }, locale = null, vocabLang = null) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
  if (locale) await p.addInitScript((l) => localStorage.setItem("a365.locale", l), locale);
  // 47: o'quvchining avvalgi tanlovi (eslab qolingan tarjima tili)
  if (vocabLang) await p.addInitScript((l) => localStorage.setItem("a365.vocab.lang", l), vocabLang);
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

const lang = (code) => page.click(`[data-testid="vocab-lang-${code}"]`);
const waitTr = (v) => page.waitForFunction((x) => document.querySelector('[data-testid="vocab-translation"]')?.value === x, v, { timeout: 5000 });

// ---- 1) Backend o'chiq (prod'da kalitsiz 503) — jim, sessiyada qayta so'ralmaydi, so'z baribir qo'shiladi
page = await openReader();
await openDialog("quick");
await page.waitForTimeout(600);
check("Til tanlanmagan: so'rov yo'q, 'Qaysi tilga tarjima qilinsin?' va 3 ta til", (await trLog()).length === 0 && ((await page.textContent('[data-testid="vocab-langs"]')) ?? "").includes("Qaysi tilga") && (await page.locator('[data-testid="vocab-langs"] button').count()) === 3);
await lang("uz");
await page.waitForTimeout(800);
check("O'chiq backend: 1 ta so'rov, maydon bo'sh, xato ko'rsatilmadi", (await trLog()).length === 1 && (await trValue()) === "" && (await page.locator('[data-testid="vocab-dialog"] .alert').count()) === 0);
check("O'chiq backend: til tugmalari yashirildi", (await page.locator('[data-testid="vocab-langs"]').count()) === 0);
await closeDialog();
await openDialog("brown");
await page.waitForTimeout(600);
check("O'chiq backend: keyingi so'zda qayta so'ralmadi", (await trLog()).length === 1);
await page.click('[data-testid="vocab-save"]');
await page.waitForSelector('[data-testid="vocab-dialog"]', { state: "detached", timeout: 5000 });
check("Tarjimasiz ham so'z lug'atga qo'shildi", (await mockGet("/__vocab")).some((v) => v.word === "brown" && !v.translation));
await page.context().close();

// ---- 2) Yoqilgan: til tanlangach tarjima; tanlov eslab qolinadi; boshqa til — qayta tarjima
await fetch(`${API_HOST}/__translate?on=1`);
page = await openReader(undefined, "ru"); // sayt interfeysi — ruscha
const c0 = (await trLog()).length;
await openDialog("quick");
await page.waitForTimeout(600);
check("Sayt tili ruscha, lekin til tanlanmagan — tarjima so'ralmadi", (await trLog()).length === c0 && (await trValue()) === "");
await page.screenshot({ path: OUT + "70-vocab-pick-lang.png" });
await lang("uz");
await waitTr("tez");
let last = (await trLog()).at(-1);
check("O'zbekcha tanlandi → 'quick' → 'tez' (target uz, sayt tili ru bo'lsa ham)", last?.target_lang === "uz" && last?.source_lang === "auto");
check("Tanlangan til belgilangan, 'Avtomatik tarjima' izohi", (await page.getAttribute('[data-testid="vocab-lang-uz"]', "aria-pressed")) === "true" && (await page.locator('[data-testid="vocab-auto-badge"]').count()) === 1);
await page.screenshot({ path: OUT + "71-vocab-auto-translate.png" });
await lang("en");
await waitTr("quick (en)");
check("Boshqa til (English) bosildi → qayta tarjima, target en", (await trLog()).at(-1)?.target_lang === "en");
await lang("uz");
await waitTr("tez");
await page.fill('[data-testid="vocab-translation"]', "tez, chaqqon");
check("Foydalanuvchi o'zgartirsa — izoh yo'qoladi", (await page.locator('[data-testid="vocab-auto-badge"]').count()) === 0);
await page.click('[data-testid="vocab-save"]');
await page.waitForSelector('[data-testid="vocab-dialog"]', { state: "detached", timeout: 5000 });
check("Saqlandi: foydalanuvchi tahriri bilan", (await mockGet("/__vocab")).some((v) => v.word === "quick" && v.translation === "tez, chaqqon"));

// Keyingi so'z — eslab qolingan til (uz) bilan avtomatik
await openDialog("dog");
await waitTr("it");
check("Keyingi so'z: eslab qolingan tilga (uz) avtomatik tarjima", (await trLog()).at(-1)?.target_lang === "uz");
await closeDialog();

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
// Bir xil til → bo'sh
await page.fill('[data-testid="vocab-word"]', "salom");
await page.fill('[data-testid="vocab-translation"]', "");
await lang("uz");
await page.waitForTimeout(700);
check("Bir xil til (o'zbekcha → uz): maydon bo'sh qoladi", (await trValue()) === "");
await closeDialog();
await page.context().close();

// ---- 3) LibreTranslate (uz yo'q, 502): o'zbekcha tanlangan — ruscha tarjima + izoh; 2 ta 502 dan keyin to'g'ri ru
await fetch(`${API_HOST}/__translate?on=1&nouz=1`);
page = await openReader(undefined, null, "uz");
const n0 = (await trLog()).length;
await openDialog("fox");
await waitTr("лиса");
const l1 = (await trLog()).slice(n0).map((x) => x.target_lang).join(",");
check("uz → 502 → ruscha tarjima (fox → лиса), so'rovlar: uz, ru", l1 === "uz,ru", l1);
check("Izoh: 'Avtomatik tarjima ruscha — o'zbekchasini o'zingiz yozishingiz mumkin'", ((await page.textContent('[data-testid="vocab-auto-badge"]')) ?? "").includes("ruscha"));
await closeDialog();
await openDialog("dog");
await waitTr("собака");
await closeDialog();
const n1 = (await trLog()).length;
await openDialog("lazy");
await page.waitForFunction(() => document.querySelector('[data-testid="vocab-translation"]')?.value !== "", null, { timeout: 5000 });
const l3 = (await trLog()).slice(n1).map((x) => x.target_lang).join(",");
check("uz ikki marta 502 → endi faqat ru so'raladi", l3 === "ru", l3);
await page.fill('[data-testid="vocab-translation"]', "dangasa");
await page.click('[data-testid="vocab-save"]');
await page.waitForSelector('[data-testid="vocab-dialog"]', { state: "detached", timeout: 5000 });
check("Saqlandi — foydalanuvchining o'zbekcha tarjimasi bilan", (await mockGet("/__vocab")).some((v) => v.word === "lazy" && v.translation === "dangasa"));
await page.context().close();

// ---- 4) Telefon (360px): til tugmalari va oyna sig'adi
await fetch(`${API_HOST}/__translate?on=1`);
page = await openReader({ width: 360, height: 760 }, null, "ru");
await openDialog("dog");
await waitTr("собака");
const sw = await page.evaluate(() => {
  const d = document.querySelector('[data-testid="vocab-dialog"]').getBoundingClientRect();
  const l = document.querySelector('[data-testid="vocab-langs"]').getBoundingClientRect();
  return { page: document.documentElement.scrollWidth - innerWidth, dialog: Math.round(d.right - innerWidth), langs: Math.round(l.right - d.right) };
});
check("360px: oyna va til tugmalari sig'adi", sw.page <= 1 && sw.dialog <= 0 && sw.langs <= 0, JSON.stringify(sw));
await page.screenshot({ path: OUT + "72-vocab-langs-360.png" });

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
