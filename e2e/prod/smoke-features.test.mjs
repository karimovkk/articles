// Backend B-yangilanishlari prod'da UI orqali (faqat o'qish): /categories filtri, /catalog/{id}, 2FA holati, sort=recent, nomlar
import { launch, selectPick, selectOptionCount } from "../lib.mjs";
const BASE = process.env.E2E_BASE ?? "http://localhost:3200";
const EMAIL = process.env.A365_EMAIL, PASS = process.env.A365_PASS;
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
for (const pth of ["/catalog", "/login", "/library", "/profile"]) await fetch(`${BASE}${pth}`).catch(() => undefined);
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const apiCalls = [];
page.on("response", (r) => { if (r.url().includes("/api/v1/")) apiCalls.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await browser.close(); process.exit(1); });
const bodyHas = async (text) => page.evaluate((t) => document.body.innerText.replace(/ /g, " ").includes(t), text);

// mehmon: katalog + kategoriya filtri + detail
await page.goto(`${BASE}/catalog`);
await page.waitForSelector("text=Psychology", { timeout: 45000 });
await page.waitForSelector('[data-testid="catalog-category"]', { timeout: 15000 });
check("Katalog: kategoriya filtri (GET /categories) — 'Jurnal maqolalari'", (await selectOptionCount(page, '[data-testid="catalog-category"]')) === 2);
await selectPick(page, '[data-testid="catalog-category"]', { label: "Jurnal maqolalari" });
await page.waitForURL((u) => !!u.searchParams.get("category"), { timeout: 15000 });
await page.waitForSelector("text=Psychology", { timeout: 15000 });
check("Kategoriya bo'yicha filtr ishladi", apiCalls.some((c) => c.includes("/catalog") && c.startsWith("200")));
await page.goto(`${BASE}/catalog`);
await page.waitForSelector('a[href^="/catalog/"]', { timeout: 15000 });
const href = await page.locator('a[href^="/catalog/"]').first().getAttribute("href");
await page.goto(`${BASE}${href}`);
await page.waitForSelector("h1", { timeout: 15000 });
check("Batafsil: GET /catalog/{id} (public)", apiCalls.some((c) => c === `200 GET /api/v1${href}`));
check("Mehmon: 'Sotib olish uchun tizimga kiring'", (await page.locator('a:has-text("Sotib olish uchun tizimga kiring")').count()) === 1);

// login → kutubxona sort → profil 2FA holati
await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', EMAIL); await page.fill('input[type="password"]', PASS); await page.click('button[type="submit"]');
const libResp = page.waitForResponse((r) => r.url().includes("/api/v1/library"), { timeout: 45000 });
await page.waitForURL(`${BASE}/library`, { timeout: 45000 });
await libResp;
await page.waitForSelector('[data-testid="library-sort"]', { timeout: 15000 });
const sortOpts = await selectOptionCount(page, '[data-testid="library-sort"]');
check("Kutubxona: sort=recent default (B11), 3 variant", sortOpts === 3 && apiCalls.some((c) => c === "200 GET /api/v1/library"), `options=${sortOpts} calls=${apiCalls.filter((c) => c.includes("/library")).join(",")}`);
await page.goto(`${BASE}/profile`);
await page.waitForSelector("text=Ikki bosqichli tasdiqlash", { timeout: 45000 });
check("Profil: 2FA holati 'O'chirilgan' (two_factor_enabled=false), faqat 'yoqish'", (await bodyHas("O'chirilgan")) && (await page.locator("text=2FA o'chirish").count()) === 0);
await page.goto(`${BASE}/admin/access`);
await page.waitForSelector("text=Kitoblarga ruxsatlar", { timeout: 45000 });
await page.waitForFunction(() => document.body.innerText.includes("Jami"), null, { timeout: 15000 });
check("Admin ruxsatlar: N+1 so'rovsiz (user/book nomlari backend'dan)", !apiCalls.some((c) => /GET \/api\/v1\/admin\/(users|books)\/[0-9a-f-]{36}$/.test(c)));
await page.click("text=Chiqish");
await page.waitForURL((u) => u.pathname === "/login", { timeout: 15000 });
const bad = apiCalls.filter((c) => !c.startsWith("2") && !c.includes("/cover") && !c.startsWith("401 POST /api/v1/auth/login"));
check("Kutilmagan API xatolari yo'q", bad.length === 0, bad.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
