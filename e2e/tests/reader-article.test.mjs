// Task 7.3 — reader maqola bo'yicha: holatlar, heartbeat, mark-read, qo'shni maqolalar, features
import { launch, BASE, reset, mockGet, ignorablePageError, mockWait } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const ART1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", ART2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", ART3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc", OTHER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
// 101: sahifa "o'qilgan" bo'lishi uchun ochiq turish vaqti (asl — 2 daqiqa) testda 1,5 s
await ctx.addInitScript(() => !localStorage.getItem("a365.readAfterMs") && localStorage.setItem("a365.readAfterMs", "1500"));
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-reader-article-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });
const bodyHas = async (text) => page.evaluate((t) => document.body.innerText.includes(t), text);
const rendered = () => page.waitForFunction(() => document.querySelector(".reader-page canvas")?.width > 0 && document.querySelectorAll('[data-page="1"] .textLayer span').length > 3, null, { timeout: 20000 });

await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);

// ---- READY maqola: sarlavha, qo'shni maqola havolalari, watermark_text
await page.goto(`${BASE}/reader/${ART1}`);
await rendered();
check("Reader: maqola sarlavhasi + 'Keyingi maqola' (1→2)", (await bodyHas("Birinchi maqola")) && (await page.getAttribute('a:has-text("Keyingi maqola")', "href")) === `/reader/${ART2}`);
check("Reader: 'Oldingi maqola' yo'q (birinchi)", (await page.locator('a:has-text("Oldingi maqola")').count()) === 0);
// 98: ekrandagi qatlam yo'q — backend watermark_text faqat sahifa canvas'iga chiziladi
await page.waitForSelector("canvas[data-wm]", { state: "attached", timeout: 10000 }).catch(() => {});
check("Watermark: backend watermark_text sahifaga chizilgan", (await page.locator("canvas[data-wm]").count()) > 0 && !(await bodyHas("u***@articles365.local")));
check("Orqaga havola → kitob sahifasi", (await page.getAttribute('header a[title="Maqolaga qaytish"]', "href")) === "/books/11111111-1111-4111-8111-111111111111");

// ---- TOC entries (flat, level) va qidiruv matches
await page.click('button[title="Panel"]');
await page.waitForSelector("text=Bob 1", { timeout: 5000 });
check("TOC: tekis entries, level 2 chekinish", (await bodyHas("2.1 Kichik bo'lim")) && (await page.evaluate(() => parseInt(getComputedStyle([...document.querySelectorAll("aside button")].find((b) => b.textContent.includes("2.1")).parentElement ? [...document.querySelectorAll("aside button")].find((b) => b.textContent.includes("2.1")) : document.body).paddingLeft) > 8)));
await page.click("text=Qidiruv");
await page.fill('input[placeholder="Maqola ichida qidirish…"]', "test");
await page.press('input[placeholder="Maqola ichida qidirish…"]', "Enter");
await page.waitForSelector("text=of page 2", { timeout: 5000 });
check("Qidiruv: matches → natija (2-bet)", true);
// 17.5: natija bosilganda PDF'da mosliklar vaqtincha sariq fon bilan bo'rttiriladi
await page.click('[data-testid="search-hit"]');
await page.waitForSelector('[data-page="2"] [data-testid="search-hits"] > div', { timeout: 8000 });
const hitRects = await page.locator('[data-page="2"] [data-testid="search-hits"] > div').count();
const onWord = await page.evaluate(() => {
  const hit = document.querySelector('[data-page="2"] [data-testid="search-hits"] > div')?.getBoundingClientRect();
  const span = [...document.querySelectorAll('[data-page="2"] .textLayer span')].find((s) => s.textContent.toLowerCase().includes("test"));
  const r = span?.getBoundingClientRect();
  return hit && r ? hit.left >= r.left - 2 && hit.right <= r.right + 2 && hit.height > 6 : false;
});
check("Qidiruv natijasi PDF'da bo'rttirildi (matn qatlami bilan aniq mos)", hitRects > 0 && onWord, `rects=${hitRects} onWord=${onWord}`);
await page.screenshot({ path: OUT + "12-search-hits.png" });
await page.waitForFunction(() => !document.querySelector('[data-page="2"] [data-testid="search-hits"]'), null, { timeout: 12000 });
check("Bo'rttirish ~6 s dan keyin o'chdi", true);

// ---- 104: qo'lda "O'qildi" tugmasi yo'q
check("104: qo'lda 'O'qildi' belgilash tugmasi yo'q", (await page.locator(`button[aria-label="O'qib bo'lindi deb belgilash"], button[aria-label="O'qilmagan deb belgilash"]`).count()) === 0);
let prog;

// ---- 101: Mark-read avtomatik — oxirgi sahifa OCHIQ TURGANDAN keyin (shunchaki o'tib ketish yetmaydi)
await page.fill('input[aria-label="Sahifa"]', "6");
await page.press('input[aria-label="Sahifa"]', "Enter");
await page.waitForTimeout(700);
prog = await mockGet("/__progress");
const early = Object.values(prog).find((p) => p.article_id === ART1);
check("101: oxirgi sahifaga o'tildi, lekin hali ochiq turmadi — o'qilmagan, foiz 100 emas", early?.is_read === false && early?.percentage < 100, JSON.stringify(early));
await mockWait("/__progress", (all) => Object.values(all).some((p) => p.article_id === ART1 && p.is_read === true));
prog = await mockGet("/__progress");
check("Oxirgi sahifa → avtomatik o'qilgan deb belgilandi", Object.values(prog).some((p) => p.article_id === ART1 && p.is_read === true));

// ---- Progress PUT: current_page + percentage (1-based, %)
await page.waitForTimeout(1800);
prog = await mockGet("/__progress");
const p1 = Object.values(prog).find((p) => p.article_id === ART1);
check("Progress: current_page=6, percentage=100, current_location", p1?.current_page === 6 && p1?.percentage === 100 && p1?.current_location?.page === 6, JSON.stringify(p1));

// ---- 101: o'qib bo'lingan maqola — boshiga qaytilsa ham foiz kamaymaydi (joy saqlanadi)
await page.fill('input[aria-label="Sahifa"]', "1");
await page.press('input[aria-label="Sahifa"]', "Enter");
await page.waitForTimeout(3500);
prog = await mockGet("/__progress");
const back = Object.values(prog).find((p) => p.article_id === ART1);
check("101/103: 1-sahifaga qaytildi — joy current_location=1, o'qilgan bet (current_page) 6 va foiz 100 da qoldi, is_read o'zgarmadi", back?.current_location?.page === 1 && back?.current_page === 6 && back?.percentage === 100 && back?.is_read === true, JSON.stringify(back));

// ---- Heartbeat: sahifa yashiringanda qoldiq yuboriladi (visibilitychange → hidden)
await page.waitForTimeout(5200);
await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
await page.waitForTimeout(500);
prog = await mockGet("/__progress");
const rs = Object.values(prog).find((p) => p.article_id === ART1)?.reading_seconds ?? 0;
check("Heartbeat: reading_seconds ≥ 5 (yashirilganda yuborildi)", rs >= 5, `seconds=${rs}`);
await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });

// ---- Keyingi maqolaga o'tish
await page.click('a:has-text("Keyingi maqola")');
await page.waitForURL(`${BASE}/reader/${ART2}`);
await rendered();
check("Keyingi maqola ochildi; 'Oldingi' bor, 'Keyingi' yo'q (3-maqola PROCESSING)", (await bodyHas("Ikkinchi maqola")) && (await page.locator('a:has-text("Oldingi maqola")').count()) === 1 && (await page.locator('a:has-text("Keyingi maqola")').count()) === 0);

// ---- 102: betdagi vaqt yig'iladi — chiqib ketib qaytilsa davom etadi (localStorage, foydalanuvchi + maqola + bet)
await page.evaluate(() => localStorage.setItem("a365.readAfterMs", "4000"));
await page.goto(`${BASE}/reader/${ART2}`);
await rendered();
await page.waitForTimeout(2600);
const dwell1 = await page.evaluate((a) => { const k = Object.keys(localStorage).find((x) => x.startsWith("a365.dwell.") && x.endsWith(a)); return k ? JSON.parse(localStorage.getItem(k)) : null; }, ART2);
const pctOf = async () => Object.values(await mockGet("/__progress")).find((p) => p.article_id === ART2)?.percentage ?? 0;
check("102: 1-kirish (~2,6 s / 4 s) — vaqt localStorage'da, bet hali o'qilmagan", dwell1?.["1"] >= 1800 && dwell1["1"] < 4000 && (await pctOf()) === 0, JSON.stringify(dwell1));
await page.goto(`${BASE}/reader/${ART3}`); // chiqib ketdi
await page.waitForSelector("text=Maqola hali tayyorlanmoqda", { timeout: 8000 });
await page.goto(`${BASE}/reader/${ART2}`);
await rendered();
await page.waitForTimeout(2200);
await page.waitForTimeout(1600); // debounce + saqlash
check("102: 2-kirishda vaqt qo'shildi (jami ≥ 4 s) — bet o'qilgan, foiz oshdi", (await pctOf()) > 0, String(await pctOf()));
await page.evaluate(() => localStorage.setItem("a365.readAfterMs", "1500"));

// ---- PROCESSING maqola → holat ekrani (PDF yuklanmaydi)
await page.goto(`${BASE}/reader/${ART3}`);
await page.waitForSelector("text=Maqola hali tayyorlanmoqda", { timeout: 8000 });
const log = await mockGet("/__log");
check("PROCESSING: holat ekrani, content so'ralmadi, 'Maqolaga qaytish'", !log.some((l) => l.includes(`${ART3}/content`)) && (await page.locator('a:has-text("Maqolaga qaytish")').count()) === 1);

// ---- Ruxsatsiz maqola → 403
await page.goto(`${BASE}/reader/${OTHER}`);
await page.waitForSelector("text=Bu maqolaga ruxsatingiz yo'q", { timeout: 8000 });
check("Ruxsatsiz maqola: BOOK_ACCESS_DENIED", true);

// ---- Regressiya: highlight (selected_text + location_data), varaqlash, print
await page.goto(`${BASE}/reader/${ART2}`);
await rendered();
const selBox = await page.evaluate(() => { const sp = [...document.querySelectorAll('[data-page="1"] .textLayer span')].filter((x) => x.textContent.trim())[1].getBoundingClientRect(); return { x1: sp.left + 3, x2: sp.right - 3, y: sp.top + sp.height / 2 }; });
await page.mouse.move(selBox.x1, selBox.y);
await page.mouse.down();
for (let i = 1; i <= 6; i++) { await page.mouse.move(selBox.x1 + ((selBox.x2 - selBox.x1) * i) / 6, selBox.y); await page.waitForTimeout(16); }
await page.mouse.up();
await page.waitForTimeout(150);
await page.locator('button[aria-label="Yashil rang bilan belgilash"]').click();
await page.waitForSelector('[data-page="1"] .highlightLayer > div', { timeout: 5000 });
// 62: yozish navbat orqali (ekranda darhol, serverga bir lahzadan keyin) — server holati kutiladi
const anns = await mockWait("/__annotations", (l) => l.length > 0);
check("Highlight: selected_text + location_data.rects + article_id", anns[0]?.selected_text?.length > 0 && anns[0]?.location_data?.rects?.length >= 1 && anns[0]?.article_id === ART2);
await page.click('button[title="Panel"]'); await page.click("text=Eslatmalar");
await page.fill("aside textarea", "Sinov eslatma"); await page.click("text=Eslatma qo'shish");
await page.waitForFunction(() => document.body.innerText.includes("Sinov eslatma") && document.querySelectorAll("aside textarea").length === 1, null, { timeout: 5000 });
const anns2 = await mockWait("/__annotations", (l) => l.some((x) => x.type === "NOTE"));
check("Eslatma: note_text maydoni", anns2.some((a) => a.type === "NOTE" && a.note_text === "Sinov eslatma"));
await page.keyboard.press("Control+p");
await page.waitForSelector("text=chop etib bo'lmaydi", { timeout: 3000 });
check("Ctrl+P bloklangan", true);
await page.click('button[aria-label="O\'qish rejimi"]');
await page.waitForFunction(() => document.querySelector('[data-testid="flip-stage"]') && [...document.querySelectorAll(".flip-leaf")].filter((l) => getComputedStyle(l).visibility === "visible").length === 1, null, { timeout: 5000 });
check("Varaqlash rejimi ishlaydi", true);
await page.screenshot({ path: OUT + "60-reader-article.png" });

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
