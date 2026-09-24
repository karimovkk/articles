// Task 7.2 — kutubxona (kitob darajasida) → kitob sahifasi (maqolalar) → reader havolasi
import { launch, BASE, API, reset, mockGet, selectOptionCount, ignorablePageError } from "../lib.mjs";
import { mkdirSync } from "node:fs";

const BOOK = "11111111-1111-4111-8111-111111111111";
const BOOK2 = "33333333-3333-4333-8333-333333333333";
const ART1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ART2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};
await reset("");
// 2-maqola yarim o'qilgan, 1-maqola o'qilgan deb belgilaymiz
const h = { Authorization: "Bearer access-token-1", "Content-Type": "application/json" };
await fetch(`${API}/articles/${ART1}/progress`, { method: "PUT", headers: h, body: JSON.stringify({ current_page: 6, percentage: 100 }) });
await fetch(`${API}/articles/${ART1}/mark-read?is_read=true`, { method: "POST", headers: h });
await fetch(`${API}/articles/${ART2}/progress`, { method: "PUT", headers: h, body: JSON.stringify({ current_page: 3, percentage: 50 }) });

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => {
  console.log("❌ XATO:", e.message.split("\n")[0]);
  await page.screenshot({ path: OUT + "99-book-failure.png" }).catch(() => {});
  await browser.close();
  process.exit(1);
});
const bodyHas = async (text) => page.evaluate((t) => document.body.innerText.replace(/ /g, " ").includes(t), text);

await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);
await page.waitForSelector("text=Test kitob", { timeout: 10000 });

// ---- Kutubxona kartasi: kitob darajasida
check("Kutubxona: 1/3 maqola o'qildi, umumiy % (100+50+0)/3=50", (await bodyHas("1/3 maqola o'qildi")) && (await bodyHas("50% o'qilgan")));
check("Kutubxona: sort recent/granted/title (B11) — qo'lbola Select", (await selectOptionCount(page, '[data-testid="library-sort"]')) === 3);
await page.screenshot({ path: OUT + "50-library.png" });

// ---- Kitob sahifasi
await page.click(`a[href="/books/${BOOK}"]`);
await page.waitForURL(`${BASE}/books/${BOOK}`);
await page.waitForSelector("text=Maqolalar (3)", { timeout: 10000 });
check("Kitob sahifasi: sarlavha/muallif/kategoriya (keshdan)", (await bodyHas("Test kitob")) && (await bodyHas("Muallif")) && (await bodyHas("Fan")));
check("Kitob: 1-maqola ✓ O'qilgan, 2-maqola 3-bet · 50%, 3-maqola Tayyorlanmoqda", (await bodyHas("✓ O'qilgan")) && (await bodyHas("3-bet · 50%")) && (await bodyHas("Tayyorlanmoqda")));
const cont = await page.getAttribute('a:has-text("Davom ettirish")', "href");
check("Davom ettirish → yarim o'qilgan 2-maqola", cont === `/reader/${ART2}`, cont);
check("READY maqola havola, PROCESSING havola emas", (await page.locator(`a[href="/reader/${ART1}"]`).count()) === 1 && (await page.locator('a:has-text("Qayta ishlanayotgan maqola")').count()) === 0);
await page.screenshot({ path: OUT + "51-book.png" });

// ---- Keshsiz to'g'ridan-to'g'ri URL (kitob info public katalogdan)
await page.evaluate(() => sessionStorage.clear());
await page.goto(`${BASE}/books/${BOOK}`);
await page.waitForSelector("text=Maqolalar (3)", { timeout: 10000 });
await page.waitForSelector("h1:has-text('Test kitob')", { timeout: 10000 });
check("Keshsiz ochilganda kitob ma'lumoti GET /library/{id} dan olindi", (await bodyHas("Ikkinchi qator")) && (await mockGet("/__log")).some((l) => l === `GET /library/${BOOK}`));

// ---- Ruxsatsiz kitob → 403 ekrani + katalog havolasi
await page.goto(`${BASE}/books/${BOOK2}`);
await page.waitForSelector("text=Bu kitobga ruxsatingiz yo'q", { timeout: 10000 });
check("Ruxsatsiz kitob: BOOK_ACCESS_DENIED ekrani + 'Katalogda ko'rish'", (await page.locator(`a[href="/catalog/${BOOK2}"]`).count()) === 1);

// ---- Reader havolasi maqola id bilan ochiladi (7.1 API: /reader/articles/{id})
await page.goto(`${BASE}/reader/${ART2}`);
const anyRendered = () => page.waitForFunction(() => [...document.querySelectorAll(".reader-page canvas")].some((c) => c.width > 0), null, { timeout: 20000 });
await anyRendered();
check("Reader maqola id bilan ochildi (206 + Content-Range)", await bodyHas("Ikkinchi maqola"));
let log = await mockGet("/__log");
check("Content-Range bor → 416 probe ishlatilmadi", !log.some((l) => l.includes("bytes=9007199254740000-")));
// B1 workaround: Content-Range'siz server
await fetch(`${API.replace("/api/v1", "")}/__setnocr?on=1`);
await page.reload();
await anyRendered();
log = await mockGet("/__log");
check("Content-Range yo'q → hajm 416 details.size orqali (workaround)", log.some((l) => l.includes("bytes=9007199254740000-")));
await fetch(`${API.replace("/api/v1", "")}/__setnocr?on=0`);
check("Progress'dan davom etdi (3-sahifa)", (await page.inputValue('input[aria-label="Sahifa"]')) === "3");

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
