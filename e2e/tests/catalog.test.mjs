// Task 5/6 tekshiruvi: public katalog, batafsil, sotib olish, /admin/stats dashboard, location_data + eski location
import { launch, BASE, reset, mockGet } from "../lib.mjs";
import { mkdirSync } from "node:fs";

const BOOK = "11111111-1111-4111-8111-111111111111";
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};
await reset("?legacy=1");

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => {
  console.log("❌ XATO:", e.message.split("\n")[0]);
  await page.screenshot({ path: OUT + "99-catalog-failure.png" }).catch(() => {});
  await browser.close();
  process.exit(1);
});
const has = async (text) => (await page.locator(`text=${text}`).count()) > 0;
const bodyHas = async (text) => page.evaluate((t) => document.body.innerText.replace(/\u00a0/g, " ").includes(t), text);

// ---- Mehmon: / → /catalog
await page.goto(`${BASE}/`);
await page.waitForURL(`${BASE}/catalog`);
await page.waitForSelector("text=Test kitob");
check("Mehmon: / → /catalog (auth'siz)", true);
check("Katalog: narx (bo'linmas bo'sh joy bilan), kategoriya, maqola soni", (await bodyHas("45 000 so'm")) && (await has("Fan")) && (await has("3 ta maqola")));
check("Katalog: '0' narx → '0 so'm' (API'da price doim string)", await bodyHas("0 so'm"));
check("Mehmon qobig'i: Kirish/Ro'yxatdan o'tish", await has("Kirish"));
// 25: brend "365" — yilning nechanchi kuni header'da ko'rinadi
const now = new Date();
const expectedDay = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
const totalDays = (now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) || now.getFullYear() % 400 === 0 ? 366 : 365;
await page.waitForSelector('[data-testid="year-day"]', { timeout: 8000 });
const chip = (await page.textContent('[data-testid="year-day"]'))?.replace(/\s/g, "");
const ringYear = Number(await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="year-ring"]')).getPropertyValue("--year")));
check("Yil kuni ko'rsatkichi: bugungi kun / jami va emblema halqasi", chip === `${expectedDay}/${totalDays}` && ringYear > 0 && Math.abs(ringYear - expectedDay / totalDays) < 0.01, `${chip} ring=${ringYear}`);
const hdrs0 = await mockGet("/__headers");
check("Katalog so'rovi Authorization'siz ketdi (public)", hdrs0.some((h) => h.path === "/catalog"));
check("Dumaloq pagination (31 ta kitob / 24): joriy 1, keyingi 2", (await page.textContent('[data-testid="pager"] button[aria-current="page"]'))?.trim() === "1" && (await page.locator('[data-testid="pager"] button:text-is("2")').count()) === 1);
check("Hero: serif sarlavha + jonli qidiruv pill", (await bodyHas("kuchli maqolalar")) && (await page.locator('.hero-search [data-testid="catalog-search"]').count()) === 1);
const CAT = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
await page.waitForSelector('[data-testid="catalog-categories"] .cat-chip', { timeout: 8000 });
check("Kategoriya chip'lari (GET /categories): 'Barcha' + 'Fan', 'Barcha' faol", (await page.locator('[data-testid="catalog-categories"] .cat-chip').count()) === 2 && (await page.getAttribute('[data-testid="catalog-categories"] [data-value=""]', "aria-pressed")) === "true");
await page.waitForSelector('[data-testid="side-category"]', { timeout: 8000 });
check("Sidebar: kategoriya + kitoblar soni (12)", (await page.locator('[data-testid="side-category"]').count()) === 1 && (await page.textContent('[data-testid="side-category"] .count'))?.trim() === "12");
await page.click(`[data-testid="catalog-categories"] [data-value="${CAT}"]`);
await page.waitForURL((u) => u.searchParams.get("category") === CAT);
await page.waitForFunction(() => document.body.innerText.includes("Test kitob") && !document.body.innerText.includes("Kitob 2\n"), null, { timeout: 8000 });
check("Kategoriya chip'i: URL ?category=, ro'yxat filtrlandi, chip faol", (await page.getAttribute(`[data-testid="catalog-categories"] [data-value="${CAT}"]`, "aria-pressed")) === "true");
check("Sidebar: faol kategoriya belgilandi", (await page.getAttribute('[data-testid="side-category"]', "aria-current")) === "page");
await page.click('[data-testid="catalog-categories"] [data-value=""]');
await page.waitForURL((u) => !u.searchParams.get("category"));
await page.screenshot({ path: OUT + "30-catalog.png" });

// ---- Qidiruv (URL ?q=)
await page.fill('input[placeholder^="Nomi, muallif"]', "Kitob 1");
await page.press('input[placeholder^="Nomi, muallif"]', "Enter");
await page.waitForURL((u) => u.searchParams.get("q") === "Kitob 1");
await page.waitForFunction(() => document.body.innerText.includes("Kitob 10") && !document.body.innerText.includes("Test kitob"));
check("Qidiruv: URL ?q= va natijalar filtrlandi", true);

// ---- Batafsil (kesh orqali)
await page.goto(`${BASE}/catalog`);
await page.click(`a[href="/catalog/${BOOK}"]`);
await page.waitForURL(`${BASE}/catalog/${BOOK}`);
await page.waitForSelector("h1:has-text('Test kitob')");
check("Batafsil: tavsif (ko'p qatorli) va narx", (await has("Ikkinchi qator")) && (await bodyHas("45 000 so'm")));
await page.click('header [data-testid="locale-menu"]');
await page.click('[data-testid="locale-en"]');
await page.waitForFunction(() => document.body.innerText.includes("45,000 UZS"), null, { timeout: 5000 });
check("en: narx '45,000 UZS' (qo'lbola til menyusi)", true);
await page.click('header [data-testid="locale-menu"]');
await page.click('[data-testid="locale-uz"]');
check("Mehmon: 'Sotib olish uchun tizimga kiring' havolasi", (await page.locator('a:has-text("Sotib olish uchun tizimga kiring")').count()) === 1);
await page.screenshot({ path: OUT + "31-catalog-detail.png" });

// ---- Batafsil to'g'ridan-to'g'ri URL (kesh yo'q → sahifalab qidirish, 2-sahifadagi kitob)
const page2Book = "22222222-2222-4222-8222-000000000028"; // Kitob 29 — ro'yxatning oxirida
await page.goto(`${BASE}/catalog/${page2Book}`);
await page.waitForSelector("h1:has-text('Kitob 29')", { timeout: 8000 });
const log2 = await mockGet("/__log");
check("Batafsil: to'g'ridan-to'g'ri GET /catalog/{id}", log2.some((l) => l === `GET /catalog/${page2Book}`));
await page.goto(`${BASE}/catalog/00000000-0000-4000-8000-000000000000`);
await page.waitForSelector("text=Kitob katalogda topilmadi", { timeout: 8000 });
check("Batafsil: mavjud bo'lmagan id → topilmadi", true);

// ---- Kirgan foydalanuvchi: ruxsati bor kitob → "O'qish"
await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);
await page.waitForSelector("header", { timeout: 8000 });
check("AppShell nav'da Katalog havolasi", (await page.locator('header a[href="/catalog"]').count()) > 0);
await page.goto(`${BASE}/catalog/${BOOK}`);
await page.waitForSelector("text=Bu kitob kutubxonangizda bor", { timeout: 8000 });
const readHref = await page.getAttribute('a:has-text("O\'qish")', "href");
check("Ruxsati bor kitob: 'O'qish' → kitob sahifasi", readHref === `/books/${BOOK}`, readHref);
await page.goto(`${BASE}/catalog/${page2Book}`);
await page.waitForSelector('button:has-text("Buyurtma berish")', { timeout: 8000 });
check("Ruxsati yo'q kitob: 'Buyurtma berish'", true);
check("Kirgan foydalanuvchi qobig'i: Kutubxona havolasi, Kirish tugmasi yo'q", (await page.locator('header a[href="/library"]').count()) > 0 && (await page.locator('header a[href="/login"]').count()) === 0);

// ---- Reader: seed highlight (`location_data`) chiziladi; yangi highlight `location_data` bilan yuboriladi
await page.goto(`${BASE}/reader/${ART}`);
await page.waitForFunction(() => document.querySelector('[data-page="1"] canvas')?.width > 0 && document.querySelectorAll('[data-page="1"] .textLayer span').length > 3, null, { timeout: 20000 });
await page.waitForSelector('[data-page="1"] .highlightLayer > div', { timeout: 5000 });
check("Seed highlight (`location_data`) chiziladi", true);
// 22.1: brauzer tanlovi o'chirilgan — sichqonchani sudrab tanlaymiz
const selBox = await page.evaluate(() => {
  const sp = [...document.querySelectorAll('[data-page="1"] .textLayer span')].filter((s) => s.textContent.trim())[3].getBoundingClientRect();
  return { x1: sp.left + 3, x2: sp.right - 3, y: sp.top + sp.height / 2 };
});
await page.mouse.move(selBox.x1, selBox.y);
await page.mouse.down();
for (let i = 1; i <= 6; i++) { await page.mouse.move(selBox.x1 + ((selBox.x2 - selBox.x1) * i) / 6, selBox.y); await page.waitForTimeout(16); }
await page.mouse.up();
await page.waitForTimeout(150);
await page.locator('button[aria-label="Yashil rang bilan belgilash"]').click();
await page.waitForFunction(() => document.querySelectorAll('[data-page="1"] .highlightLayer > div').length >= 2, null, { timeout: 5000 });
const anns = await mockGet("/__annotations");
const fresh = anns.find((a) => a.id !== "legacy-1");
check("Yangi highlight `location_data` + `selected_text` bilan yuborildi", !!fresh?.location_data?.rects && typeof fresh?.selected_text === "string", JSON.stringify(Object.keys(fresh ?? {})));
check("`page` yuqori darajada", fresh?.page === 1);

// ---- Admin dashboard: /admin/stats
await page.goto(`${BASE}/library`);
await page.click('header [data-testid="user-menu"]');
await page.click('[data-testid="logout"]');
await page.waitForURL((u) => u.pathname === "/login");
await page.fill('input[autocomplete="username"]', "admin@articles365.local");
await page.fill('input[type="password"]', "Admin12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);
await page.goto(`${BASE}/admin`);
await page.waitForSelector("text=Faol sessiyalar", { timeout: 8000 });
check("Dashboard: /admin/stats — maqolalar, faol sessiyalar, belgilar plitkalari", (await has("Maqolalar")) && (await has("Belgilar va izohlar")));
check("Dashboard: holat taqsimoti (ACTIVE: 31, READY: 3, PROCESSING: 1)", (await has("ACTIVE: 31")) && (await has("READY: 3")) && (await has("PROCESSING: 1")));
check("Dashboard: rollar (USER 2 · ADMIN 1)", await has("USER 2 · ADMIN 1"));
check("Dashboard: fallback ogohlantirishi yo'q", !(await page.evaluate(() => document.body.innerText.includes("mavjud emas"))));
await page.screenshot({ path: OUT + "32-admin-stats.png" });

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
