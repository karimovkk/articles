// Task 7.5 / 14 / 15 / 56 — buyurtma oqimi (katalog): to'lov FAQAT Telegram bot orqali (deep-link — saytda karta va
// chek formasi yo'q), bot holatni o'zgartiradi → sayt kuzatadi (PENDING'da ham), bot sozlanmagan / 409 INVALID_ORDER_STATE,
// bekor qilish (CANCELLED), 409 ORDER_ALREADY_PENDING → mavjud buyurtma, kuzatuv GET /orders/{id} (APPROVED/REJECTED),
// 409 ALREADY_HAS_ACCESS, bildirishnoma havolasi + 2FA login
import { launch, BASE, API_HOST, API, reset, mockGet, confirmDialog, ignorablePageError } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const BOOK2 = "33333333-3333-4333-8333-333333333333";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");
const ah = { Authorization: "Bearer access-token-admin", "Content-Type": "application/json" };
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-orders-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });
const bodyHas = async (text) => page.evaluate((t) => document.body.innerText.replace(/ /g, " ").includes(t), text);
// Kuzatuvni (polling) tezlashtirish: sahifaga "qaytish" — focus hodisasi
const nudge = () => page.evaluate(() => window.dispatchEvent(new Event("focus")));

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

// ---- Buyurtma berish → PENDING → Telegram orqali to'lash (bot) → AWAITING_REVIEW
await page.waitForSelector("text=Buyurtma berish", { timeout: 10000 });
await page.click("text=Buyurtma berish");
await page.waitForSelector("text=Buyurtma yaratildi", { timeout: 5000 });
check("POST /orders → PENDING + ko'rsatma", await bodyHas("To'lov kutilmoqda"));
let orders = await mockGet("/__orders");
check("Buyurtma summasi kitob narxidan", orders[0]?.amount === "70000.00" && orders[0]?.status === "PENDING" && orders[0]?.has_receipt_file === false);
// ---- 56: to'lov — faqat Telegram bot: saytda karta/chek formasi yo'q, "Telegram orqali to'lash" → deep-link
await ctx.route("https://t.me/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<html><body>Telegram</body></html>" }));
await page.waitForSelector('[data-testid="tg-pay-btn"]', { timeout: 5000 });
check(
  "PENDING: 'Telegram orqali to'lash' + izoh; karta va chek formasi yo'q",
  ((await page.textContent('[data-testid="tg-pay-btn"]')) ?? "").includes("Telegram orqali to'lash") &&
    (await bodyHas("Karta raqami, chek yuborish va tasdiq — Telegram botda")) &&
    (await page.locator('[data-testid="payment-details"], [data-testid="receipt-form"], [data-testid="receipt-file"]').count()) === 0 &&
    !(await bodyHas("To'ladim")),
);
await page.screenshot({ path: OUT + "81-order-payment.png" });
const [popup] = await Promise.all([page.waitForEvent("popup"), page.click('[data-testid="tg-pay-btn"]')]);
await popup.waitForURL(/t\.me\/articles365_test_bot\?start=/, { timeout: 8000 });
check("Bosildi → POST /orders/{id}/telegram-link, Telegram yangi oynada (deep-link, start=token)", (await mockGet("/__log")).includes(`POST /orders/${orders[0].id}/telegram-link`) && popup.url().startsWith("https://t.me/articles365_test_bot?start=tg"), popup.url());
await popup.close();
await page.waitForSelector("text=Telegram ochildi", { timeout: 3000 });
check("Izoh: 'Telegram ochildi — to'lovni botda yakunlang'", true);

// Bot chekni qabul qildi (AWAITING_REVIEW) → sayt kuzatuvda (PENDING'da ham) reload'siz yangilanadi
await fetch(`${API_HOST}/__set-order?id=${orders[0].id}&status=AWAITING_REVIEW`);
await nudge();
await page.waitForSelector('[data-testid="awaiting-hint"]', { timeout: 10000 });
check("Bot → AWAITING_REVIEW: reload'siz 'Chek administrator tekshiruvida' + 'Telegram botni ochish'", (await bodyHas("Chek administrator tekshiruvida")) && ((await page.textContent('[data-testid="tg-pay-btn"]')) ?? "").includes("Telegram botni ochish"));
await page.screenshot({ path: OUT + "80-order-awaiting.png" });

// Bot sozlanmagan (deep_link: null) → tushunarli xabar, ochilgan bo'sh oyna yopiladi
await fetch(`${API_HOST}/__tg-link?off=1`);
const pagesBefore = ctx.pages().length;
await page.click('[data-testid="tg-pay-btn"]');
await page.waitForSelector("text=Telegram bot hozircha sozlanmagan", { timeout: 5000 });
await page.waitForTimeout(400);
check("deep_link bo'sh → 'bot hozircha sozlanmagan', bo'sh oyna yopildi", ctx.pages().length === pagesBefore, `${ctx.pages().length}/${pagesBefore}`);
await fetch(`${API_HOST}/__tg-link?off=0`);

// ---- 409 INVALID_ORDER_STATE (Telegram'da hal qilingan) → tushunarli xabar, holat yangilanadi
await page.route("**/api/v1/orders/*/telegram-link", (r) => r.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: { code: "INVALID_ORDER_STATE", message: "x", details: null } }) }));
await page.click('[data-testid="tg-pay-btn"]');
await page.waitForSelector("text=Buyurtma holati allaqachon o'zgargan", { timeout: 5000 });
await page.waitForTimeout(400);
check("409 INVALID_ORDER_STATE → xabar, oyna yopildi", ctx.pages().length === pagesBefore);
await page.unroute("**/api/v1/orders/*/telegram-link");

// ---- Reload: holat saqlangan (ordersApi.mine dan)
await page.reload();
await page.waitForSelector('[data-testid="awaiting-hint"]', { timeout: 10000 });
check("Reload: buyurtma holati ko'rsatiladi (qayta buyurtma tugmasi yo'q)", (await page.locator("text=Buyurtma berish").count()) === 0);

// ---- Admin (Telegram/web) rad etadi → kuzatuv (reload'siz) → REJECTED + sabab + "Qayta buyurtma berish"
orders = await mockGet("/__orders");
await fetch(`${API}/admin/orders/${orders[0].id}/reject`, { method: "POST", headers: ah, body: JSON.stringify({ reason: "Chek topilmadi" }) });
await nudge();
await page.waitForSelector('[data-testid="reject-reason"]', { timeout: 10000 });
check("Kuzatuv: REJECTED reload'siz ko'rindi — sabab + 'Qayta buyurtma berish'", (await bodyHas("To'lov rad etildi")) && (await bodyHas("Chek topilmadi")) && (await page.locator("text=Qayta buyurtma berish").count()) === 1);

// ---- Qayta buyurtma → bekor qilish (tasdiqlash oynasi) → CANCELLED → yana "Buyurtma berish"
await page.click("text=Qayta buyurtma berish");
await page.waitForSelector("text=To'lov kutilmoqda", { timeout: 5000 });
await page.click('[data-testid="cancel-order"]');
await confirmDialog(page, false);
check("Bekor qilish: 'Yo'q' → buyurtma o'zgarmadi", (await mockGet("/__orders"))[0]?.status === "PENDING");
await page.click('[data-testid="cancel-order"]');
await confirmDialog(page, true);
await page.waitForSelector("text=Buyurtma bekor qilindi", { timeout: 5000 });
orders = await mockGet("/__orders");
check("POST /orders/{id}/cancel → CANCELLED, 'Buyurtma berish' qaytdi", orders[0]?.status === "CANCELLED" && (await page.locator("button:has-text('Buyurtma berish')").count()) === 1);

// ---- 409 ORDER_ALREADY_PENDING: boshqa joyda (boshqa tab / Telegram) ochiq buyurtma bor → o'sha buyurtma ochiladi
const other = await (await fetch(`${API}/orders`, { method: "POST", headers: { Authorization: "Bearer access-token-1", "Content-Type": "application/json" }, body: JSON.stringify({ book_id: BOOK2 }) })).json();
await page.click("button:has-text('Buyurtma berish')");
await page.waitForSelector("text=ochiq buyurtmangiz bor", { timeout: 5000 });
const log = await mockGet("/__log");
check("409 ORDER_ALREADY_PENDING → GET /orders/{details.order_id}, mavjud PENDING ko'rsatildi (xato emas)", log.includes(`GET /orders/${other.id}`) && (await page.getAttribute('[data-testid="order-panel"]', "data-status")) === "PENDING" && (await mockGet("/__orders")).filter((o) => o.status === "PENDING").length === 1);

// ---- Bot to'lovni qabul qildi → admin tasdiqlaydi → kuzatuv (GET /orders/{id}) → APPROVED (reload'siz)
orders = await mockGet("/__orders");
await fetch(`${API_HOST}/__set-order?id=${orders[0].id}&status=AWAITING_REVIEW`);
await fetch(`${API}/admin/orders/${orders[0].id}/approve`, { method: "POST", headers: ah });
await nudge();
await page.waitForSelector("text=To'lov tasdiqlandi", { timeout: 10000 });
check("Kuzatuv yengil GET /orders/{id} orqali", (await mockGet("/__log")).includes(`GET /orders/${orders[0].id}`));
check("Kuzatuv: APPROVED reload'siz — 'Kitob kutubxonangizda' + kitobni ochish/kutubxona", (await page.locator(`a[href="/books/${BOOK2}"]`).count()) >= 1 && (await page.locator('a[href="/library"]:has-text("Kutubxonaga o\'tish")').count()) === 1);
await page.reload();
await page.waitForSelector("text=Bu kitob kutubxonangizda bor", { timeout: 10000 });
check("Reload: ruxsat berildi → 'O'qish' ko'rinadi", (await page.locator('a:has-text("O\'qish")').count()) === 1);

// ---- Bildirishnoma: ORDER_APPROVED → kitob sahifasi (meta.book_id)
await page.goto(`${BASE}/notifications`);
await page.waitForSelector("text=Buyurtma tasdiqlandi", { timeout: 10000 });
await page.locator("[data-unread]", { hasText: "Buyurtma tasdiqlandi" }).first().click();
await page.waitForURL(`${BASE}/books/${BOOK2}`, { timeout: 8000 });
check("Bildirishnoma ORDER_APPROVED → /books/{book_id}", true);

// ---- 409 ALREADY_HAS_ACCESS → "kutubxonangizda" + kitobni ochish (xom xato emas)
await page.route("**/api/v1/orders", (r) => (r.request().method() === "POST" ? r.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: { code: "ALREADY_HAS_ACCESS", message: "x", details: null } }) }) : r.continue()));
await page.goto(`${BASE}/catalog/22222222-2222-4222-8222-000000000001`);
await page.waitForSelector("text=Buyurtma berish", { timeout: 10000 });
await page.click("text=Buyurtma berish");
await page.waitForSelector('[data-testid="order-owned"]', { timeout: 5000 });
check("409 ALREADY_HAS_ACCESS → 'allaqachon kutubxonangizda' + kitobni ochish", (await bodyHas("Bu kitob allaqachon kutubxonangizda")) && (await page.locator('[data-testid="order-owned"] a[href^="/books/"]').count()) === 1);
await page.unroute("**/api/v1/orders");

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
