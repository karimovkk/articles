// Task 7.5 / 14 — buyurtma oqimi v1.0 (katalog): chek RASMI (multipart), validatsiya, kuzatuv (APPROVED/REJECTED),
// 409 ALREADY_HAS_ACCESS, bildirishnoma havolasi + 2FA login
import { launch, BASE, API, reset, mockGet } from "../lib.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
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
// Test fayllari: haqiqiy 1×1 PNG, matn fayli, 10 MB dan katta "JPEG"
const PNG = OUT + "receipt.png", TXT = OUT + "receipt.txt", BIG = OUT + "receipt-big.jpg";
writeFileSync(PNG, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));
writeFileSync(TXT, "bu rasm emas");
writeFileSync(BIG, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(10 * 1024 * 1024 + 10, 1)]));
const pickReceipt = (file) => page.setInputFiles('[data-testid="receipt-file"]', file);
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

// ---- Buyurtma berish → PENDING → To'ladim (chek rasmi) → AWAITING_REVIEW
await page.waitForSelector("text=Buyurtma berish", { timeout: 10000 });
await page.click("text=Buyurtma berish");
await page.waitForSelector("text=Buyurtma yaratildi", { timeout: 5000 });
check("POST /orders → PENDING + ko'rsatma", await bodyHas("To'lov kutilmoqda"));
let orders = await mockGet("/__orders");
check("Buyurtma summasi kitob narxidan", orders[0]?.amount === "70000.00" && orders[0]?.status === "PENDING");
await page.click("text=To'ladim — chek yuborish");
await page.waitForSelector('[data-testid="receipt-form"]');
check("Chek formasi: rasm tanlash zonasi + tavsiya matni", (await page.locator('[data-testid="receipt-drop"]').count()) === 1 && (await bodyHas("JPEG, PNG yoki WebP")));
// Klient tekshiruvi: rasm emas / 10 MB dan katta — so'rov ketmaydi
await pickReceipt(TXT);
await page.waitForSelector("text=Chek rasmi JPEG, PNG yoki WebP bo'lishi kerak", { timeout: 3000 });
await pickReceipt(BIG);
await page.waitForSelector("text=Chek rasmi 10 MB dan oshmasligi kerak", { timeout: 3000 });
check("Klient: rasm emas va > 10 MB — xato, serverga so'rov yo'q", (await mockGet("/__receipts")).length === 0);
// Yaroqli PNG → oldindan ko'rish → olib tashlash → qayta tanlash
await pickReceipt(PNG);
await page.waitForSelector('[data-testid="receipt-preview"] img', { timeout: 3000 });
check("Yaroqli rasm: oldindan ko'rish (blob) + fayl nomi", (await page.locator('[data-testid="receipt-preview"] img').getAttribute("src"))?.startsWith("blob:") && (await bodyHas("receipt.png")));
await page.click('button[aria-label="Rasmni olib tashlash"]');
check("Rasm olib tashlandi → qayta tanlash zonasi", (await page.locator('[data-testid="receipt-drop"]').count()) === 1);
await pickReceipt(PNG);
await page.waitForSelector('[data-testid="receipt-preview"]');
// Server xatosi INVALID_FILE (422) → tarjima qilingan matn
await page.route("**/api/v1/orders/*/receipt", (r) => r.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: { code: "INVALID_FILE", message: "bad", details: null } }) }));
await page.click('[data-testid="receipt-submit"]');
await page.waitForSelector("text=Fayl turi noto'g'ri", { timeout: 5000 });
check("Server 422 INVALID_FILE → tushunarli xabar, forma saqlandi", (await page.locator('[data-testid="receipt-preview"]').count()) === 1);
await page.unroute("**/api/v1/orders/*/receipt");
await page.fill('textarea[placeholder^="Chek raqami"]', "Payme 555");
await page.click('[data-testid="receipt-submit"]');
await page.waitForSelector('[data-testid="awaiting-hint"]', { timeout: 5000 });
const rc = await mockGet("/__receipts");
check("Chek multipart yuborildi: file (image/png) + receipt_note", rc.length === 1 && rc[0].file?.type === "image/png" && rc[0].file.size > 0 && rc[0].note === "Payme 555", JSON.stringify(rc));
check("AWAITING_REVIEW: kutish matni", await bodyHas("Chek administrator tekshiruvida"));
await page.screenshot({ path: OUT + "80-order-awaiting.png" });

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

// ---- Qayta buyurtma → chek RASMSIZ (faqat izoh, fallback) → admin tasdiqlaydi → kuzatuv → APPROVED
await page.click("text=Qayta buyurtma berish");
await page.waitForSelector("text=To'lov kutilmoqda", { timeout: 5000 });
await page.click("text=To'ladim — chek yuborish");
await page.fill('textarea[placeholder^="Chek raqami"]', "Naqd to'landi");
await page.click('[data-testid="receipt-submit"]');
await page.waitForSelector('[data-testid="awaiting-hint"]', { timeout: 5000 });
check("Rasmsiz chek (faqat izoh) → AWAITING_REVIEW", (await mockGet("/__receipts"))[1]?.file === null);
orders = await mockGet("/__orders");
await fetch(`${API}/admin/orders/${orders[0].id}/approve`, { method: "POST", headers: ah });
await nudge();
await page.waitForSelector("text=To'lov tasdiqlandi", { timeout: 10000 });
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
