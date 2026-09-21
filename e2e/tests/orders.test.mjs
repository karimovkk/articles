// Task 7.5 — buyurtma oqimi (katalog) + 2FA login
import { launch, BASE, API, reset, mockGet } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const BOOK2 = "33333333-3333-4333-8333-333333333333";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");
const ah = { Authorization: "Bearer access-token-admin", "Content-Type": "application/json" };
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-orders-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });
const bodyHas = async (text) => page.evaluate((t) => document.body.innerText.replace(/ /g, " ").includes(t), text);

// ---- Mehmon: "Sotib olish uchun kiring" → login?next=
await page.goto(`${BASE}/catalog/${BOOK2}`);
await page.waitForSelector("h1:has-text('Ruxsatsiz kitob')", { timeout: 10000 });
const loginHref = await page.getAttribute('a:has-text("Sotib olish uchun tizimga kiring")', "href");
check("Mehmon: login havolasi next= bilan", loginHref === `/login?next=%2Fcatalog%2F${BOOK2}`, loginHref);
await page.click('a:has-text("Sotib olish uchun tizimga kiring")');
await page.waitForURL((u) => u.pathname === "/login");
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/catalog/${BOOK2}`, { timeout: 10000 });
check("Login'dan keyin katalog sahifasiga qaytdi", true);

// ---- Buyurtma berish → PENDING → To'ladim → AWAITING_REVIEW
await page.waitForSelector("text=Buyurtma berish", { timeout: 10000 });
await page.click("text=Buyurtma berish");
await page.waitForSelector("text=Buyurtma yaratildi", { timeout: 5000 });
check("POST /orders → PENDING + ko'rsatma", await bodyHas("To'lov kutilmoqda"));
let orders = await mockGet("/__orders");
check("Buyurtma summasi kitob narxidan", orders[0]?.amount === "70000.00" && orders[0]?.status === "PENDING");
await page.click("text=To'ladim — chek yuborish");
await page.fill('textarea[placeholder^="Chek raqami"]', "Payme 555");
await page.click("text=Yuborish");
await page.waitForSelector("text=Tekshirilmoqda", { timeout: 5000 });
check("Chek → AWAITING_REVIEW", (await bodyHas("To'lov administrator tomonidan tekshirilmoqda")));
await page.screenshot({ path: OUT + "80-order-awaiting.png" });

// ---- Reload: holat saqlangan (ordersApi.mine dan)
await page.reload();
await page.waitForSelector("text=Tekshirilmoqda", { timeout: 10000 });
check("Reload: buyurtma holati ko'rsatiladi (qayta buyurtma tugmasi yo'q)", (await page.locator("text=Buyurtma berish").count()) === 0);

// ---- Admin rad etadi → REJECTED + sabab + qayta buyurtma
orders = await mockGet("/__orders");
await fetch(`${API}/admin/orders/${orders[0].id}/reject`, { method: "POST", headers: ah, body: JSON.stringify({ reason: "Chek topilmadi" }) });
await page.reload();
await page.waitForSelector("text=Chek topilmadi", { timeout: 10000 });
check("REJECTED: sabab ko'rsatildi + 'Buyurtma berish' qayta mavjud", (await page.locator("text=Buyurtma berish").count()) === 1);

// ---- Qayta buyurtma → admin tasdiqlaydi → APPROVED → 'Kitobni ochish' → kitob sahifasi ochiladi (ruxsat)
await page.click("text=Buyurtma berish");
await page.waitForSelector("text=To'lov kutilmoqda", { timeout: 5000 });
orders = await mockGet("/__orders");
await fetch(`${API}/admin/orders/${orders[0].id}/approve`, { method: "POST", headers: ah });
await page.reload();
await page.waitForSelector("text=Bu kitob kutubxonangizda bor", { timeout: 10000 });
check("APPROVED → ruxsat berildi → 'O'qish' ko'rinadi", (await page.locator('a:has-text("O\'qish")').count()) === 1);

// ---- 2FA login
await page.goto(`${BASE}/library`);
await page.click('header [data-testid="user-menu"]');
await page.click('[data-testid="logout"]');
await page.waitForURL((u) => u.pathname === "/login");
await page.fill('input[autocomplete="username"]', "2fa@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForSelector('input[autocomplete="one-time-code"]', { timeout: 5000 });
check("2FA: TOTP_REQUIRED → kod maydoni chiqdi (xatosiz)", (await page.locator("text=talab qilinadi").count()) === 0);
await page.fill('input[autocomplete="one-time-code"]', "000000");
await page.click('button[type="submit"]');
await page.waitForSelector("text=Tasdiqlash kodi noto'g'ri", { timeout: 5000 });
check("2FA: noto'g'ri kod → INVALID_TOTP", true);
await page.fill('input[autocomplete="one-time-code"]', "123456");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`, { timeout: 10000 });
check("2FA: to'g'ri kod → kirdi", true);

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
