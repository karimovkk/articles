// 9.6 — 429 / offline / 5xx / reader content xatosi: tushunarli xabar, "oq ekran" yo'q (registr §11.7)
import { launch, BASE, API, reset, ignorablePageError } from "../lib.mjs";
const ART1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MOCK = API.replace("/api/v1", "");
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
const fail = (path, status, code) => fetch(`${MOCK}/__fail?path=${encodeURIComponent(path)}&status=${status}&code=${code}`);
const failOff = () => fetch(`${MOCK}/__fail?off=1`);
await reset("");
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await failOff(); await browser.close(); process.exit(1); });
const bodyHas = async (text) => page.evaluate((t) => document.body.innerText.includes(t), text);
const notBlank = async () => page.evaluate(() => document.body.innerText.trim().length > 20);

// ---- 429 katalogda
await fail("/catalog", 429, "RATE_LIMIT_EXCEEDED");
await page.goto(`${BASE}/catalog`);
await page.waitForSelector("text=Juda ko'p urinish", { timeout: 10000 });
check("429 → 'Juda ko'p urinish' xabari, sahifa bo'sh emas", await notBlank());
await failOff();
await page.fill('input[placeholder^="Nomi, muallif"]', "Test");
await page.press('input[placeholder^="Nomi, muallif"]', "Enter");
await page.waitForSelector("text=Test kitob", { timeout: 10000 });
check("Limit o'tgach qayta so'rov ishlaydi", true);

// ---- API server yetib bo'lmaydi (so'rov uziladi) → NETWORK_ERROR; tiklangach ishlaydi
await page.route("**/api/v1/catalog**", (route) => route.abort("connectionrefused"));
await page.fill('input[placeholder^="Nomi, muallif"]', "Kitob 1");
await page.press('input[placeholder^="Nomi, muallif"]', "Enter");
await page.waitForSelector("text=Server bilan aloqa yo'q", { timeout: 10000 });
check("API uzilgan → NETWORK_ERROR xabari (eski natijalar saqlanadi)", (await bodyHas("Test kitob")) && (await notBlank()));
await page.unroute("**/api/v1/catalog**");
await page.fill('input[placeholder^="Nomi, muallif"]', "Kitob 1 ");
await page.press('input[placeholder^="Nomi, muallif"]', "Enter");
await page.waitForFunction(() => document.body.innerText.includes("Kitob 10") && !document.body.innerText.includes("aloqa yo'q"), null, { timeout: 10000 });
check("Aloqa tiklangach → xabar yo'qoldi, natijalar yangilandi", true);

// ---- 5xx login
await fail("/auth/login", 503, "SERVICE_UNAVAILABLE");
await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForSelector("text=Xizmat vaqtincha mavjud emas", { timeout: 10000 });
check("503 login → SERVICE_UNAVAILABLE matni", true);
await failOff();
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`, { timeout: 10000 });

// ---- 500 kutubxona ro'yxati → alert, qobiq saqlanadi
await fail("/library", 500, "INTERNAL_ERROR");
await page.goto(`${BASE}/library`);
await page.waitForSelector("text=Serverda xatolik yuz berdi", { timeout: 10000 });
check("500 kutubxona → xabar, header/nav saqlangan (oq ekran emas)", (await page.locator("header").count()) === 1);
await failOff();

// ---- Reader: metadata 500 → xato ekrani + orqaga havola; content 500 → 'ochib bo'lmadi'
await fail(`/reader/articles/${ART1}`, 500, "INTERNAL_ERROR");
await page.goto(`${BASE}/reader/${ART1}`);
await page.waitForSelector("text=Serverda xatolik yuz berdi", { timeout: 10000 });
check("Reader metadata 500 → xato ekrani + 'Kutubxonaga qaytish'", (await page.locator('a:has-text("Kutubxonaga qaytish")').count()) === 1);
await failOff();
await fail(`/reader/articles/${ART1}/content`, 500, "INTERNAL_ERROR");
await page.goto(`${BASE}/reader/${ART1}`);
await page.waitForFunction(() => document.body.innerText.includes("Serverda xatolik") || document.body.innerText.includes("ochib bo'lmadi"), null, { timeout: 15000 });
check("Reader content 500 → xato xabari (qotib qolmaydi)", (await page.locator('a:has-text("Kutubxonaga qaytish")').count()) === 1);
await failOff();

// ---- 404 marshrut → 404 sahifasi
await page.goto(`${BASE}/bu-yol-yoq`);
await page.waitForSelector("text=Sahifa topilmadi", { timeout: 10000 });
check("Noma'lum marshrut → 404 sahifasi + kutubxona havolasi", (await page.locator('a[href="/library"]').count()) >= 1);

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
