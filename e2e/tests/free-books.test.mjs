// 37 — Tekin kitoblar: admin "Tekin kitob" kaliti (narx maydoni yo'qoladi, price 0 + is_free), pullik kitobda narx
// majburiy; katalogda "Tekin" belgisi va "O'qish" (savatcha yo'q); mehmon kitob sahifasidan kirishsiz o'qiydi — banner,
// faqat mundarija/qidiruv, tanlashda ro'yxatdan o'tish taklifi, progress/annotatsiya so'rovlari yo'q; pullik kitob
// reader'i mehmonni login'ga (next bilan) yuboradi; tekin kitobga buyurtma — 422; telefon/planshet'da gorizontal scroll yo'q.
import { launch, BASE, API, reset, mockGet, ignorablePageError } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const FREE_BOOK = "22222222-2222-4222-8222-000000000000"; // "Kitob 1" — narxi 0
const FREE_ART = "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1";
const PAID_ART = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"; // "Ruxsatsiz kitob" maqolasi
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-free-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });
const text = (sel) => page.textContent(sel).then((s) => (s ?? "").replace(/\s+/g, " ").trim());

// ---- Server: tekin kitobga buyurtma — 422 BOOK_IS_FREE
const ord = await fetch(`${API}/orders`, { method: "POST", headers: { Authorization: "Bearer access-token-1", "Content-Type": "application/json" }, body: JSON.stringify({ book_id: FREE_BOOK }) });
check("Tekin kitobga buyurtma: 422 BOOK_IS_FREE", ord.status === 422 && (await ord.json()).error?.code === "BOOK_IS_FREE");

// ---- Katalog (mehmon): "Tekin" belgisi, narx o'rniga "Tekin", "O'qish" tugmasi, savatcha yo'q
await page.goto(`${BASE}/catalog`);
await page.waitForSelector('[data-testid="book-card"]', { timeout: 30000 });
const freeCard = page.locator('[data-testid="book-card"]', { has: page.locator(".bcard-title", { hasText: /^Kitob 1$/ }) });
await freeCard.waitFor();
check("Katalog: tekin kartada 'Tekin' belgisi", (await freeCard.locator('[data-testid="free-tag"]').count()) === 1);
check("Katalog: narx o'rnida 'Tekin'", (await freeCard.locator(".bcard-price.free").textContent())?.trim() === "Tekin");
check("Katalog: tekin kartada 'Savatga' yo'q", (await freeCard.locator('[data-testid="add-to-cart"]').count()) === 0);
const paidCard = page.locator('[data-testid="book-card"]', { has: page.locator(".bcard-title", { hasText: /^Kitob 2$/ }) });
check("Katalog: pullik kartada 'Tekin' belgisi yo'q, 'Savatga' bor", (await paidCard.locator('[data-testid="free-tag"]').count()) === 0 && (await paidCard.locator('[data-testid="add-to-cart"]').count()) === 1);
await freeCard.screenshot({ path: OUT + "50-free-card.png" });

// ---- Kitob sahifasi (mehmon): "Bu kitob tekin" paneli, maqolalar, "O'qishni boshlash"
await page.goto(`${BASE}/catalog/${FREE_BOOK}`);
await page.waitForSelector('[data-testid="free-read"]', { timeout: 20000 });
check("Kitob sahifasi: narx 'Tekin'", (await text('[data-testid="book-free-price"]')) === "Tekin");
check("Kitob sahifasi: mehmonga 'ro'yxatdan o'tmasdan o'qing' matni", (await text('[data-testid="free-read"]')).includes("Ro'yxatdan o'tmasdan"));
check("Kitob sahifasi: 2 ta maqola ro'yxati", (await page.locator(".free-read-item").count()) === 2);
check("Kitob sahifasi: buyurtma/savatcha tugmalari yo'q", (await page.locator('[data-testid="add-to-cart"], [data-testid="book-cart"]').count()) === 0);
await page.screenshot({ path: OUT + "51-free-book.png", fullPage: true });

// ---- Mehmon reader: kirishsiz ochiladi
const before = (await mockGet("/__log")).length;
await page.click('[data-testid="free-start"]');
await page.waitForURL(`${BASE}/reader/${FREE_ART}`, { timeout: 15000 });
await page.waitForFunction(() => document.querySelector('[data-page="1"] canvas')?.width > 0 && document.querySelectorAll('[data-page="1"] .textLayer span').length > 3, null, { timeout: 30000 });
check("Mehmon reader'da (login'ga yo'naltirilmadi)", page.url().endsWith(`/reader/${FREE_ART}`));
check("Mehmon banneri: ro'yxatdan o'tish / kirish", (await page.locator('[data-testid="guest-banner"] a[href^="/register"]').count()) === 1 && (await page.locator('[data-testid="guest-banner"] a[href^="/login"]').count()) === 1);
check("Suv belgisi: mehmon", (await page.locator("text=mehmon").count()) > 0);
await page.screenshot({ path: OUT + "52-free-reader-guest.png" });

// Panel: faqat mundarija va qidiruv
await page.click('button[aria-label="Panel"]');
await page.waitForSelector('[role="tablist"] [role="tab"]');
const tabs = await page.$$eval('[role="tablist"] [role="tab"]', (els) => els.map((e) => e.textContent.trim()));
check("Mehmon paneli: faqat 2 ta tab (mundarija, qidiruv)", tabs.length === 2, tabs.join(","));
await page.click('button[aria-label="Panel"]');

// Matn tanlash → ranglar paneli o'rniga ro'yxatdan o'tish taklifi
const box = await page.evaluate(() => {
  const sp = [...document.querySelectorAll('[data-page="1"] .textLayer span')].filter((s) => s.textContent.trim())[1].getBoundingClientRect();
  return { x1: sp.left + 3, x2: sp.right - 3, y: sp.top + sp.height / 2 };
});
await page.mouse.move(box.x1, box.y);
await page.mouse.down();
for (let i = 1; i <= 6; i++) {
  await page.mouse.move(box.x1 + ((box.x2 - box.x1) * i) / 6, box.y);
  await page.waitForTimeout(16);
}
await page.mouse.up();
await page.waitForSelector('[data-testid="guest-selection"]', { timeout: 5000 });
check("Tanlash: 'Belgilash va lug'at uchun ro'yxatdan o'ting'", (await text('[data-testid="guest-selection"]')).includes("ro'yxatdan o'ting") && (await page.locator('[data-testid="selection-vocab"]').count()) === 0);
await page.screenshot({ path: OUT + "53-free-reader-selection.png" });

// Sahifa almashtirish → progress/annotatsiya/o'qildi so'rovlari yuborilmaydi
await page.keyboard.press("Escape");
await page.mouse.wheel(0, 2400);
await page.waitForTimeout(2500);
const guestCalls = (await mockGet("/__log")).slice(before).filter((l) => /progress|annotations|heartbeat|mark-read|\/read\b|vocabulary/i.test(l));
check("Mehmon: progress/annotatsiya/lug'at so'rovlari yo'q", guestCalls.length === 0, guestCalls.slice(0, 4).join(" | "));
check("Mehmon: 'O'qildi' tugmasi yo'q", (await page.locator(`button[aria-label="O'qib bo'lindi deb belgilash"]:visible`).count()) === 0);

// Orqaga havola — katalogdagi kitob sahifasiga (mehmonda /books yo'q)
check("Orqaga: /catalog/{kitob}", (await page.locator(`a[href="/catalog/${FREE_BOOK}"]`).count()) > 0);

// ---- Pullik kitob reader'i (mehmon) → login?next=
await page.goto(`${BASE}/reader/${PAID_ART}`);
await page.waitForURL((u) => u.pathname === "/login", { timeout: 20000 });
check("Pullik kitob reader'i: mehmon login'ga, next bilan", new URL(page.url()).searchParams.get("next") === `/reader/${PAID_ART}`);

// ---- Responsive: tekin kitob sahifasi va reader
const sizes = process.env.E2E_PROD ? [[320, 640], [390, 844], [768, 1024], [1920, 1080], [3840, 2160]] : [[320, 640], [768, 1024]];
const bad = [];
for (const url of [`/catalog/${FREE_BOOK}`, `/reader/${FREE_ART}`]) {
  await page.goto(`${BASE}${url}`);
  await page.waitForSelector(url.startsWith("/reader") ? '[data-testid="guest-banner"]' : '[data-testid="free-read"]', { timeout: 20000 });
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
    if (r.sw > r.vw + 1) bad.push(`${url} ${w}: ${JSON.stringify(r)}`);
    if (w === 320) await page.screenshot({ path: OUT + `54-free-320-${url.split("/")[1]}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 860 });
}
check(`Tekin kitob sahifasi va reader ${sizes.length} ta o'lchamda: gorizontal scroll yo'q`, bad.length === 0, bad.join(" | "));

// ---- Kirgan foydalanuvchi: tekin kitob — "Kitob barcha uchun ochiq", mehmon banneri yo'q
await page.goto(`${BASE}/login?next=${encodeURIComponent(`/catalog/${FREE_BOOK}`)}`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/catalog/${FREE_BOOK}`, { timeout: 30000 });
await page.waitForSelector('[data-testid="free-read"]', { timeout: 20000 });
check("Kirgan foydalanuvchi: 'barcha uchun ochiq' paneli", (await text('[data-testid="free-read"]')).includes("barcha uchun ochiq"));
await page.click('[data-testid="free-start"]');
await page.waitForURL(`${BASE}/reader/${FREE_ART}`);
await page.waitForFunction(() => document.querySelector('[data-page="1"] canvas')?.width > 0, null, { timeout: 30000 });
check("Kirgan foydalanuvchi reader'ida mehmon banneri yo'q", (await page.locator('[data-testid="guest-banner"]').count()) === 0);
await page.evaluate(() => fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined));
await ctx.clearCookies();
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

// ---- Admin: "Tekin kitob" kaliti
await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "admin@articles365.local");
await page.fill('input[type="password"]', "Admin12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
await page.goto(`${BASE}/admin/books`);
await page.click('[data-testid="new-book"]');
await page.waitForSelector('[data-testid="book-price"]');
await page.locator('[role="dialog"] input').first().fill("Yangi pullik");
const postsBefore = (await mockGet("/__log")).filter((l) => l === "POST /admin/books").length;
await page.locator('[role="dialog"] button[type="submit"]').click();
await page.waitForTimeout(500);
const postsAfter = (await mockGet("/__log")).filter((l) => l === "POST /admin/books").length;
check("Admin: pullik kitobda narxsiz saqlanmaydi", postsAfter === postsBefore && (await page.locator('[role="dialog"]').count()) === 1);
await page.click('[data-testid="book-free"]');
check("Admin: 'Tekin kitob' yoqilsa narx maydoni yo'qoladi", (await page.locator('[data-testid="book-price"]').count()) === 0 && (await page.getAttribute('[data-testid="book-free"]', "aria-checked")) === "true");
await page.screenshot({ path: OUT + "55-admin-free-toggle.png" });
await page.locator('[role="dialog"] input').first().fill("Yangi tekin kitob");
await page.locator('[role="dialog"] button[type="submit"]').click();
await page.waitForURL((u) => /\/admin\/books\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 15000 });
const created = await (await fetch(`${API}/admin/books?search=${encodeURIComponent("Yangi tekin")}`, { headers: { Authorization: "Bearer access-token-admin" } })).json();
const nb = created.items?.[0];
check("Server: yangi kitob is_free=true, narx 0", nb?.is_free === true && Number(nb?.price) === 0, JSON.stringify({ is_free: nb?.is_free, price: nb?.price }));
// Tahrirlash formasi: kalit yoqilgan, narx maydoni yo'q; o'chirilsa narx majburiy
await page.waitForSelector('[data-testid="book-free"]', { timeout: 15000 });
check("Tahrirlash: 'Tekin kitob' yoqilgan, narx maydoni yo'q", (await page.getAttribute('[data-testid="book-free"]', "aria-checked")) === "true" && (await page.locator('[data-testid="book-price"]').count()) === 0);
await page.click('[data-testid="book-free"]');
await page.fill('[data-testid="book-price"]', "65000");
await page.locator('form:has([data-testid="book-free"]) button[type="submit"]').click();
await page.waitForTimeout(800);
const after = await (await fetch(`${API}/admin/books?search=${encodeURIComponent("Yangi tekin")}`, { headers: { Authorization: "Bearer access-token-admin" } })).json();
check("Tahrirlash: tekin → pullik (admin yozgan 65 000), is_free=false", after.items?.[0]?.is_free === false && Number(after.items?.[0]?.price) === 65000, JSON.stringify({ is_free: after.items?.[0]?.is_free, price: after.items?.[0]?.price }));
// Ro'yxatda tekin kitob — "Tekin" belgisi
await page.goto(`${BASE}/admin/books?search=${encodeURIComponent("Kitob 1")}`);
await page.waitForFunction(() => document.body.innerText.includes("Tekin"), null, { timeout: 15000 });
check("Admin ro'yxati: tekin kitobda 'Tekin' belgisi", true);

// Narx — admin qanday kiritsa, katalogda shunday (standart 49 000 emas)
const k2 = (await (await fetch(`${API}/admin/books?search=${encodeURIComponent("Kitob 2")}`, { headers: { Authorization: "Bearer access-token-admin" } })).json()).items.find((b) => b.title === "Kitob 2");
await fetch(`${API}/admin/books/${k2.id}`, { method: "PATCH", headers: { Authorization: "Bearer access-token-admin", "Content-Type": "application/json" }, body: JSON.stringify({ price: "73500", is_free: false }) });
await page.goto(`${BASE}/catalog/${k2.id}`);
await page.waitForFunction(() => document.body.innerText.replace(/\s/g, " ").includes("73 500"), null, { timeout: 15000 }).catch(() => undefined);
check("Katalog: admin kiritgan narx (73 500) ko'rinadi", await page.evaluate(() => document.body.innerText.replace(/\s/g, " ").includes("73 500")));
check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
