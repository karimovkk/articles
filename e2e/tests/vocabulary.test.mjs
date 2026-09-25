// 33 — Lug'at: PDF'dan so'z qo'shish (tarjima bilan), dublikat, PDF'dagi belgi va tarjima oynasi, reader sidebar'dagi
// "Lug'at" tabi, /vocabulary sahifasi (bo'sh holat, qidiruv, filtr, saralash, tarjima qo'shish, o'rgandim, takrorlash,
// PDF'da ochish → o'sha bet + so'z bo'rttiriladi, o'chirish, CSV), telefon/planshet/TV'da gorizontal scroll yo'q.
import { launch, BASE, reset, mockGet, ignorablePageError, selectPick } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-vocab-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });

await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });

// ---- Bo'sh holat
await page.goto(`${BASE}/vocabulary`);
await page.waitForFunction(() => document.body.innerText.includes("Lug'at hali bo'sh"), null, { timeout: 30000 });
check("Bo'sh lug'at: qo'llanma va kutubxonaga havola", (await page.locator('a[href="/library"]', { hasText: "Kutubxonaga" }).count()) === 1);
check("Sidebar'da 'Lug'at' havolasi faol", (await page.locator('.side-link.active[href="/vocabulary"]').count()) === 1);

// ---- Reader: so'zni sudrab tanlash → "Lug'atga"
await page.goto(`${BASE}/reader/${ART}`);
await page.waitForFunction(() => document.querySelectorAll('[data-page="1"] .textLayer span').length > 0, null, { timeout: 30000 });
const wordBox = (word, pageNo = 1) =>
  page.evaluate(
    ([w, n]) => {
      for (const sp of document.querySelectorAll(`[data-page="${n}"] .textLayer span`)) {
        const t = sp.firstChild;
        const i = t?.textContent.indexOf(w) ?? -1;
        if (i < 0) continue;
        const r = document.createRange();
        r.setStart(t, i);
        r.setEnd(t, i + w.length);
        const b = r.getBoundingClientRect();
        return { x1: b.left + 1, x2: b.right - 1, y: b.top + b.height / 2 };
      }
      return null;
    },
    [word, pageNo],
  );
const dragSelect = async (word, pageNo = 1) => {
  const b = await wordBox(word, pageNo);
  await page.mouse.move(b.x1, b.y);
  await page.mouse.down();
  for (let n = 1; n <= 6; n++) {
    await page.mouse.move(b.x1 + ((b.x2 - b.x1) * n) / 6, b.y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForSelector('[data-testid="selection-vocab"]', { timeout: 5000 });
};
await dragSelect("quick");
await page.click('[data-testid="selection-vocab"]');
await page.waitForSelector('[data-testid="vocab-dialog"]');
const pre = await page.evaluate(() => ({ word: document.querySelector('[data-testid="vocab-word"]').value, ctx: document.querySelector('[data-testid="vocab-context"]').value }));
check("Oyna: tanlangan so'z va kontekst (qator) avtomatik", pre.word === "quick" && pre.ctx.includes("The quick brown fox"), JSON.stringify(pre));
await page.fill('[data-testid="vocab-translation"]', "tez");
await page.click('[data-testid="vocab-save"]');
await page.waitForSelector('[data-page="1"] [data-testid="vocab-marks"] > div', { timeout: 8000 });
let saved = (await mockGet("/__annotations")).filter((a) => a.label === "vocab");
check(
  "Serverga NOTE + label 'vocab' (so'z, tarjima, kontekst, kitob/maqola nomi)",
  saved.length === 1 && saved[0].type === "NOTE" && saved[0].selected_text === "quick" && saved[0].note_text === "tez" && saved[0].location_data?.book_title === "Test kitob" && saved[0].location_data?.article_title === "Birinchi maqola",
  JSON.stringify(saved.map((a) => [a.selected_text, a.note_text, a.location_data?.book_title])),
);
await page.waitForFunction(() => document.body.innerText.includes("lug'atga qo'shildi"), null, { timeout: 5000 });
check("Toast: “quick” lug'atga qo'shildi", true);

// Belgi bosilsa — tarjima oynasi
const mark = await page.evaluate(() => { const r = document.querySelector('[data-page="1"] [data-testid="vocab-marks"] > div').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.mouse.click(mark.x, mark.y);
await page.waitForSelector('[data-testid="vocab-popover"]', { timeout: 5000 });
check("PDF'dagi belgi bosildi → tarjima oynasi (tez)", (await page.textContent('[data-testid="vocab-popover-translation"]')).trim() === "tez");
await page.keyboard.press("Escape");

// Dublikat: bir xil so'z qayta → ogohlantirish, tarjima oldindan to'ldirilgan, saqlash — yangilaydi
await dragSelect("quick");
await page.click('[data-testid="selection-vocab"]');
await page.waitForSelector('[data-testid="vocab-duplicate"]', { timeout: 5000 });
check("Dublikat: ogohlantirish, mavjud tarjima oldindan", (await page.inputValue('[data-testid="vocab-translation"]')) === "tez");
await page.fill('[data-testid="vocab-translation"]', "tez, chaqqon");
await page.click('[data-testid="vocab-save"]');
await page.waitForFunction(() => !document.querySelector('[data-testid="vocab-dialog"]'), null, { timeout: 5000 });
saved = (await mockGet("/__annotations")).filter((a) => a.label === "vocab");
check("Dublikat yaratilmadi, tarjima yangilandi", saved.length === 1 && saved[0].note_text === "tez, chaqqon", JSON.stringify(saved.map((a) => a.note_text)));

// Ikkinchi so'z (tarjimasiz) — 2-betdan
await page.fill('input[aria-label="Sahifa"]', "2");
await page.press('input[aria-label="Sahifa"]', "Enter");
await page.waitForFunction(() => document.querySelectorAll('[data-page="2"] .textLayer span').length > 0, null, { timeout: 15000 });
await page.waitForTimeout(400);
await dragSelect("lazy", 2);
await page.click('[data-testid="selection-vocab"]');
await page.waitForSelector('[data-testid="vocab-dialog"]');
await page.click('[data-testid="vocab-save"]');
await page.waitForSelector('[data-page="2"] [data-testid="vocab-marks"] > div', { timeout: 8000 });
check("Tarjimasiz so'z ham qo'shiladi (2-bet)", (await mockGet("/__annotations")).filter((a) => a.label === "vocab").length === 2);

// Sidebar: "Lug'at" tabida 2 so'z, "Eslatmalar"da lug'at ko'rinmaydi
await page.click('button[aria-label="Panel"], button[title="Panel"]');
await page.locator('[role="tab"]', { hasText: "Lug'at" }).click();
await page.waitForSelector('[data-testid="reader-vocab-item"]', { timeout: 5000 });
check("Reader sidebar 'Lug'at' tabi: shu maqoladagi 2 so'z", (await page.locator('[data-testid="reader-vocab-item"]').count()) === 2);
await page.locator('[role="tab"]', { hasText: "Eslatmalar" }).click();
await page.waitForTimeout(300);
check("'Eslatmalar' tabida lug'at so'zlari yo'q", !(await page.textContent("aside")).includes("chaqqon"));
await page.screenshot({ path: OUT + "30-vocab-reader.png" });

// ---- Lug'at sahifasi
await page.goto(`${BASE}/vocabulary`);
await page.waitForSelector('[data-testid="vocab-card"]', { timeout: 30000 });
const cards = () => page.locator('[data-testid="vocab-card"]');
check("Sahifada 2 ta so'z kartasi", (await cards().count()) === 2);
check("Statistika: 2 ta so'z, 0 ta o'rganilgan", (await page.textContent('[data-testid="vocab-stats"]')).includes("2 ta so'z") && (await page.textContent('[data-testid="vocab-stats"]')).includes("0 ta o'rganilgan"));
const quickCard = page.locator('[data-testid="vocab-card"][data-word="quick"]');
check("Karta: tarjima, kontekstda so'z ajratilgan, manba (kitob · maqola · bet)", (await quickCard.locator('[data-testid="vocab-card-translation"]').textContent()) === "tez, chaqqon" && (await quickCard.locator(".vocab-context mark").textContent()) === "quick" && (await quickCard.textContent()).includes("Birinchi maqola") && (await quickCard.textContent()).includes("1-bet"));

await page.fill('[data-testid="vocab-search"] input, input[data-testid="vocab-search"]', "chaqq");
await page.waitForTimeout(200);
check("Qidiruv tarjima bo'yicha ham ishlaydi (chaqq → quick)", (await cards().count()) === 1 && (await cards().first().getAttribute("data-word")) === "quick");
await page.fill('[data-testid="vocab-search"] input, input[data-testid="vocab-search"]', "");
await page.waitForTimeout(200);

// Tarjimasiz so'zga tarjima qo'shish
const lazyCard = page.locator('[data-testid="vocab-card"][data-word="lazy"]');
await lazyCard.locator('[data-testid="vocab-add-translation"]').click();
await page.waitForSelector('[data-testid="vocab-dialog"]');
await page.fill('[data-testid="vocab-translation"]', "dangasa");
await page.click('[data-testid="vocab-save"]');
await page.waitForFunction(() => document.querySelector('[data-word="lazy"] [data-testid="vocab-card-translation"]')?.textContent === "dangasa", null, { timeout: 5000 });
check("Tarjima qo'shildi (oyna → karta, server)", (await mockGet("/__annotations")).some((a) => a.selected_text === "lazy" && a.note_text === "dangasa"));

// O'rgandim → holat filtri
await lazyCard.locator('[data-testid="vocab-learned"]').click();
await page.waitForFunction(() => document.querySelector('[data-word="lazy"]')?.classList.contains("is-learned"), null, { timeout: 5000 });
check("O'rgandim: karta belgilandi, serverda learned=true", (await mockGet("/__annotations")).some((a) => a.selected_text === "lazy" && a.location_data?.learned === true));
const pickSelect = async (testId, value) => {
  await selectPick(page, `[data-testid="${testId}"]`, value);
  await page.waitForTimeout(200);
};
await pickSelect("vocab-status", "learned");
check("Holat filtri 'O'rganilgan' → faqat lazy", (await cards().count()) === 1 && (await cards().first().getAttribute("data-word")) === "lazy");
await pickSelect("vocab-status", "all");
await pickSelect("vocab-sort", "az");
check("Saralash A–Z: lazy, quick", (await cards().evaluateAll((els) => els.map((e) => e.dataset.word).join(","))) === "lazy,quick");
await page.screenshot({ path: OUT + "31-vocab-page.png" });

// CSV
const [download] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }), page.click('[data-testid="vocab-export"]')]);
const csvPath = OUT + "vocab.csv";
await download.saveAs(csvPath);
const { readFileSync } = await import("node:fs");
const csv = readFileSync(csvPath, "utf8");
check("CSV eksport: sarlavha + 2 qator, tarjimalar bilan", csv.split(/\r\n/).length === 3 && csv.includes("tez, chaqqon") && csv.includes("dangasa"), download.suggestedFilename());

// ---- Takrorlash (flashcards)
await page.click('[data-testid="vocab-view-cards"]');
await page.waitForSelector('[data-testid="flashcard"]');
check("Takrorlash: 1 / 2", (await page.textContent('[data-testid="cards-progress"]')).trim() === "1 / 2");
await page.keyboard.press("Space");
await page.waitForFunction(() => document.querySelector('[data-testid="flashcard"]').getAttribute("aria-pressed") === "true", null, { timeout: 3000 });
check("Space → karta aylandi (tarjima tomoni)", true);
// Tartib A–Z: 1) lazy (o'rganilgan) — "Yana", 2) quick (o'rganilmoqda) — "Bilaman" → o'rganilgan bo'lishi kerak
await page.click('[data-testid="cards-again"]');
await page.waitForFunction(() => document.querySelector('[data-testid="cards-progress"]')?.textContent.trim() === "2 / 2", null, { timeout: 5000 });
await page.click('[data-testid="cards-know"]');
await page.waitForSelector('[data-testid="cards-done"]', { timeout: 5000 });
check("Takrorlash tugadi: yakuniy ekran", true);
check("'Bilaman' — so'z o'rganilgan deb belgilandi (serverda)", (await mockGet("/__annotations")).filter((a) => a.label === "vocab" && a.location_data?.learned === true).length === 2);
await page.click('[data-testid="vocab-view-list"]');

// ---- PDF'da ochish → o'sha bet, so'z bo'rttiriladi
await page.locator('[data-testid="vocab-card"][data-word="lazy"] [data-testid="vocab-open-pdf"]').click();
await page.waitForURL((u) => u.pathname === `/reader/${ART}` && u.searchParams.get("page") === "2" && u.searchParams.get("word") === "lazy", { timeout: 15000 });
const flashed = await page
  .waitForFunction(() => document.querySelector('[data-page="2"] [data-testid="search-hits"] > div'), null, { timeout: 20000 })
  .then(() => true)
  .catch(() => false);
check("PDF'da ochish: 2-bet, “lazy” vaqtincha bo'rttirildi", flashed && (await page.inputValue('input[aria-label="Sahifa"]')) === "2");
await page.screenshot({ path: OUT + "32-vocab-open-pdf.png" });

// ---- O'chirish (tasdiq bilan)
await page.goto(`${BASE}/vocabulary`);
await page.waitForSelector('[data-testid="vocab-card"]', { timeout: 30000 });
await page.locator('[data-testid="vocab-card"][data-word="quick"] [data-testid="vocab-delete"]').click();
await page.locator('[role="dialog"] button', { hasText: "O'chirish" }).last().click();
await page.waitForFunction(() => !document.querySelector('[data-word="quick"]'), null, { timeout: 5000 });
check("O'chirish: karta va serverdan ketdi", (await mockGet("/__annotations")).filter((a) => a.label === "vocab").length === 1);

// ---- Responsive: telefon / planshet / TV — gorizontal scroll yo'q, kartalar ko'rinadi
const sizes = process.env.E2E_PROD ? [[320, 640], [390, 844], [768, 1024], [1920, 1080], [2560, 1440], [3840, 2160]] : [[320, 640], [768, 1024], [2560, 1440]];
const bad = [];
for (const [w, h] of sizes) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(250);
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth, cards: document.querySelectorAll('[data-testid="vocab-card"]').length }));
  if (r.sw > r.vw + 1 || r.cards !== 1) bad.push(`${w}: ${JSON.stringify(r)}`);
  if (w === 320) await page.screenshot({ path: OUT + "33-vocab-320.png", fullPage: true });
}
check(`Lug'at sahifasi ${sizes.length} ta o'lchamda: gorizontal scroll yo'q`, bad.length === 0, bad.join(" | "));

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
