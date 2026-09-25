// 35 — Savatcha va ko'p kitobga chegirma: backend qo'llamasa ko'rinmaydi; mehmon savatga qo'shadi va kirgach savat
// saqlanadi; narx pog'onalari (1 — o'z narxi, 2 — 39 000, 3+ — 30 000), keyingi pog'ona maslahati, tejash; kutubxonadagi
// kitob savatdan chiqariladi; "Buyurtma berish" → bitta buyurtma (items, subtotal, discount, amount); admin
// tasdiqlasa hamma kitoblarga ruxsat; profilda ko'p kitobli buyurtma; telefon/planshet/TV'da gorizontal scroll yo'q.
import { launch, BASE, API_HOST, reset, mockGet, ignorablePageError } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const OWNED = "11111111-1111-4111-8111-111111111111"; // "Test kitob" — foydalanuvchida bor
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-cart-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });
const text = (sel) => page.textContent(sel).then((s) => (s ?? "").replace(/\s+/g, " ").trim());

// ---- Backend qo'llamasa (GET /pricing yo'q) — savatcha umuman ko'rinmaydi
await fetch(`${API_HOST}/__pricing?off=1`);
await page.goto(`${BASE}/catalog`);
await page.waitForSelector('[data-testid="book-card"]', { timeout: 30000 });
await page.waitForTimeout(800);
check("Backend chegirmani qo'llamasa: aksiya, 'Savatga' va header savatchasi yo'q", (await page.locator('[data-testid="pricing-promo"], [data-testid="add-to-cart"], [data-testid="header-cart"]').count()) === 0);
await fetch(`${API_HOST}/__pricing`);

// ---- Mehmon: aksiya banneri, savatga qo'shish
await page.goto(`${BASE}/catalog`);
await page.waitForSelector('[data-testid="pricing-promo"]', { timeout: 30000 });
check("Katalogda aksiya: 1 ta / 2 ta 39 000 / 3+ ta 30 000", (await text('[data-testid="pricing-promo"]')).includes("39 000") && (await text('[data-testid="pricing-promo"]')).includes("30 000"));
await page.waitForSelector('[data-testid="add-to-cart"]');
const freeCardHasCart = await page.evaluate(() => [...document.querySelectorAll('[data-testid="book-card"]')].filter((c) => /(^|\s)0 so.m/.test(c.textContent)).some((c) => c.querySelector('[data-testid="add-to-cart"]')));
check("Bepul kitob kartasida 'Savatga' yo'q", !freeCardHasCart);
// "Kitob 2" va "Kitob 3" (49 000) — savatga
const addByTitle = async (title) => {
  const card = page.locator('[data-testid="book-card"]', { has: page.locator(".bcard-title", { hasText: new RegExp(`^${title}$`) }) });
  await card.locator('[data-testid="add-to-cart"]').click();
  await card.locator('[data-testid="in-cart"]').waitFor({ timeout: 3000 });
};
await addByTitle("Kitob 2");
await addByTitle("Kitob 3");
check("Header savatchasi: 2", (await text('[data-testid="cart-count"]')) === "2");

await page.click('[data-testid="header-cart"]');
await page.waitForURL(`${BASE}/cart`);
await page.waitForSelector('[data-testid="cart-item"]');
await page.waitForFunction(() => document.querySelector('[data-testid="cart-total"]')?.textContent.includes("78"), null, { timeout: 5000 });
check("2 ta kitob: donasi 39 000, jami 78 000, asl narx chizilgan", (await text('[data-testid="cart-total"]')).startsWith("78 000") && (await page.locator('[data-testid="cart-old-price"]').count()) === 2 && (await text('[data-testid="cart-item"]:first-child [data-testid="cart-unit-price"]')).startsWith("39 000"));
check("Keyingi pog'ona maslahati: yana 1 ta → 30 000", (await text('[data-testid="cart-next"]')).includes("1 ta") && (await text('[data-testid="cart-next"]')).includes("30 000"));
check("Tejash: 20 000", (await text('[data-testid="cart-savings"]')).includes("20 000"));
check("Mehmon: 'Buyurtma berish' o'rniga kirish (next=/cart)", (await page.getAttribute('[data-testid="cart-login"]', "href")) === "/login?next=%2Fcart");

// ---- Kirish → savatcha saqlanadi
await page.click('[data-testid="cart-login"]');
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/cart`, { timeout: 30000 });
await page.waitForSelector('[data-testid="cart-item"]');
check("Kirgandan keyin savatcha saqlangan (2 ta)", (await page.locator('[data-testid="cart-item"]').count()) === 2);

// Tavsiyadan uchinchi kitob → 3+ narx
await page.waitForSelector('[data-testid="cart-suggest"] [data-testid="add-to-cart"]', { timeout: 10000 });
check("Tavsiyalarda kutubxonadagi kitob yo'q", !(await text('[data-testid="cart-suggest"]')).includes("Test kitob"));
await page.locator('[data-testid="cart-suggest"] [data-testid="add-to-cart"]').first().click();
await page.waitForFunction(() => document.querySelectorAll('[data-testid="cart-item"]').length === 3, null, { timeout: 5000 });
await page.waitForFunction(() => document.querySelector('[data-testid="cart-total"]')?.textContent.startsWith("90"), null, { timeout: 5000 });
check("3 ta kitob: donasi 30 000, jami 90 000, eng foydali narx", (await text('[data-testid="cart-total"]')).startsWith("90 000") && (await text('[data-testid="cart-next"]')).includes("30 000") && (await page.locator('.tier-step.active.best').count()) === 1);
await page.screenshot({ path: OUT + "40-cart-3.png", fullPage: true });

// Kutubxonadagi kitob savatga tushib qolsa (masalan, boshqa qurilmada sotib olingan) — olib tashlanadi
await page.evaluate((id) => {
  const items = JSON.parse(localStorage.getItem("a365.cart") ?? "[]");
  items.push({ book_id: id, title: "Test kitob", author: null, price: "45000.00", has_cover: false, added_at: new Date().toISOString() });
  localStorage.setItem("a365.cart", JSON.stringify(items));
}, OWNED);
await page.reload();
await page.waitForFunction(() => document.body.innerText.includes("Kutubxonangizdagi kitoblar savatdan olib tashlandi"), null, { timeout: 10000 });
check("Kutubxonadagi kitob savatdan avtomatik olib tashlandi", (await page.locator(`[data-testid="cart-item"][data-book="${OWNED}"]`).count()) === 0 && (await page.locator('[data-testid="cart-item"]').count()) === 3);

// Bittasini o'chirish → 2 ta narx
await page.locator('[data-testid="cart-remove"]').last().click();
await page.waitForFunction(() => document.querySelector('[data-testid="cart-total"]')?.textContent.startsWith("78"), null, { timeout: 5000 });
check("O'chirilgach narx qayta hisoblandi (78 000)", true);

// ---- Buyurtma berish
await page.click('[data-testid="cart-checkout"]');
await page.waitForSelector('[data-testid="checkout-order"]', { timeout: 10000 });
const orders = await mockGet("/__orders");
const o = orders[0];
check("Server: bitta buyurtma, 2 kitob, subtotal 98 000, chegirma 20 000, summa 78 000", o?.items?.length === 2 && o.subtotal === "98000.00" && o.discount === "20000.00" && o.amount === "78000.00" && o.status === "PENDING", JSON.stringify({ n: o?.items?.length, s: o?.subtotal, d: o?.discount, a: o?.amount }));
check("To'lov bosqichi: jami 78 000, rekvizitlar, 'To'ladim'", (await text('[data-testid="checkout-total"]')).startsWith("78 000") && (await page.locator('[data-testid="checkout-paid"]').count()) === 1);
check("Buyurtmadan keyin savatcha bo'shadi", (await page.locator('[data-testid="cart-count"]').count()) === 0);
await page.screenshot({ path: OUT + "41-cart-checkout.png", fullPage: true });

// Kitob sahifasi: shu kitob ko'p kitobli buyurtmada
await page.goto(`${BASE}/catalog/${o.items[0].book_id}`);
await page.waitForSelector('[data-testid="order-bundle-note"]', { timeout: 15000 });
check("Kitob sahifasi: 'bu kitob 2 ta kitobli buyurtmada'", (await text('[data-testid="order-bundle-note"]')).includes("2 ta"));

// Admin tasdiqlaydi → ikkala kitobga ruxsat
const ap = await fetch(`${API_HOST}/api/v1/admin/orders/${o.id}/approve`, { method: "POST", headers: { Authorization: "Bearer access-token-admin" } });
check("Admin tasdiqladi", ap.status === 200);
await page.goto(`${BASE}/library`);
await page.waitForFunction(() => document.querySelectorAll('[data-testid="book-card"]').length >= 3, null, { timeout: 15000 });
check("Kutubxonada 3 ta kitob (avvalgi + savatchadagi 2 ta)", (await page.locator('[data-testid="book-card"]').count()) === 3);
await page.goto(`${BASE}/profile`);
await page.waitForSelector('[data-testid="order-bundle"]', { timeout: 15000 });
check("Profil: ko'p kitobli buyurtma (2 ta kitob, chegirma)", (await text('[data-testid="order-bundle"]')).includes("2 ta kitob"));

// ---- Responsive: to'la savatcha
await page.goto(`${BASE}/catalog`);
await page.waitForSelector('[data-testid="add-to-cart"]', { timeout: 15000 });
for (let i = 0; i < 3; i++) {
  await page.locator('[data-testid="add-to-cart"]').first().click();
  await page.waitForTimeout(150);
}
await page.goto(`${BASE}/cart`);
await page.waitForSelector('[data-testid="cart-item"]');
const sizes = process.env.E2E_PROD ? [[320, 640], [390, 844], [768, 1024], [1920, 1080], [2560, 1440], [3840, 2160]] : [[320, 640], [768, 1024], [2560, 1440]];
const bad = [];
for (const [w, h] of sizes) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(250);
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  if (r.sw > r.vw + 1) bad.push(`${w}: ${JSON.stringify(r)}`);
  if (w === 320) await page.screenshot({ path: OUT + "42-cart-320.png", fullPage: true });
}
check(`Savatcha ${sizes.length} ta o'lchamda: gorizontal scroll yo'q`, bad.length === 0, bad.join(" | "));

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
