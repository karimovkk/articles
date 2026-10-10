// 81: kitob narxi — asl narx + chegirma narxi. Admin: "Sotuv narxi" + "Asl narx" (ixtiyoriy; sotuv narxidan katta
// bo'lishi kerak, oldindan ko'rish −N%), olib tashlash — `original_price: 0`. Katalog / kitob sahifasi: joriy narx,
// asl narx ustidan chiziq, −N% (backend foizi); tekin — "Tekin". Telefonda sig'adi.
import { launch, BASE, reset, mockGet, mockWait, ignorablePageError, makeCheck } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
const BOOK = "11111111-1111-4111-8111-111111111111"; // "Test kitob" — 45 000
const { check, done } = makeCheck();
await reset("");
const browser = await launch();
const errors = [];
const watch = (p) => p.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));

const admin = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
watch(admin);
await admin.goto(`${BASE}/login`);
await admin.fill('input[autocomplete="username"]', "admin@articles365.local");
await admin.fill('input[type="password"]', "Admin12345!");
await admin.click('button[type="submit"]');
await admin.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });

// ---- Yangi kitob: tekshiruv va yuborilgan maydon
await admin.goto(`${BASE}/admin/books`);
await admin.click('[data-testid="new-book"]');
await admin.waitForSelector('[data-testid="book-original-price"]', { timeout: 10000 });
await admin.fill('[role="dialog"] input[required]:not([type="number"])', "Chegirmali kitob");
await admin.fill('[data-testid="book-price"]', "80000");
await admin.fill('[data-testid="book-original-price"]', "70000");
check("Asl narx sotuv narxidan kichik — ogohlantirish", (await admin.locator('[data-testid="book-original-error"]').count()) === 1);
await admin.click('[role="dialog"] button[type="submit"]');
await admin.waitForTimeout(400);
check("…va yuborilmaydi (forma tekshiradi)", ((await admin.textContent('[role="dialog"]')) ?? "").includes("Asl narx sotuv narxidan katta bo'lishi kerak") && (await mockGet("/__last-book-body")).title !== "Chegirmali kitob");
await admin.fill('[data-testid="book-original-price"]', "100000");
check("Oldindan ko'rish: −20%", ((await admin.textContent('[data-testid="book-discount-preview"]')) ?? "").includes("−20%"));
await admin.locator('[role="dialog"]').screenshot({ path: OUT + "99-admin-book-discount-new.png" });
await admin.click('[role="dialog"] button[type="submit"]');
const created = await mockWait("/__last-book-body", (b) => b.title === "Chegirmali kitob");
check("Yaratildi: price 80000, original_price 100000 yuborildi", Number(created.price) === 80000 && Number(created.original_price) === 100000, JSON.stringify(created));

// ---- Mavjud kitob: asl narx 60 000 → katalogda −25%
await admin.goto(`${BASE}/admin/books/${BOOK}`);
await admin.waitForSelector('[data-testid="book-original-price"]', { timeout: 15000 });
check("Tahrir: asl narx maydoni bo'sh (chegirma yo'q)", (await admin.inputValue('[data-testid="book-original-price"]')) === "");
await admin.fill('[data-testid="book-original-price"]', "60000");
await admin.locator('form:has([data-testid="book-original-price"]) button[type="submit"]').click();
await mockWait("/__books", (l) => l.find((b) => b.id === BOOK)?.original_price === "60000.00");
check("PATCH: original_price 60000 saqlandi", true);

const ctxs = [];
const open = async (w, h, mobile = false) => {
  const c = await browser.newContext({ viewport: { width: w, height: h }, ...(mobile ? { hasTouch: true, isMobile: true } : {}) });
  ctxs.push(c);
  const p = await c.newPage();
  watch(p);
  return p;
};
const page = await open(1366, 900);
await page.goto(`${BASE}/catalog`);
await page.waitForSelector('[data-testid="book-card"]', { timeout: 20000 });
const card = page.locator('[data-testid="book-card"]', { has: page.locator(`.bcard-link[href="/catalog/${BOOK}"]`) });
const tag = await card.evaluate((c) => {
  const t = c.querySelector('[data-testid="price-tag"]');
  return t ? { now: t.querySelector(".pt-now").textContent, old: t.querySelector('[data-testid="price-old"]').textContent, badge: t.querySelector('[data-testid="price-discount"]').textContent, struck: getComputedStyle(t.querySelector(".pt-old")).textDecorationLine } : null;
});
check("Katalog: joriy narx 45 000, asl narx 60 000 ustidan chiziq, −25%", !!tag && tag.now.includes("45") && tag.old.includes("60") && tag.badge === "−25%" && tag.struck.includes("line-through"), JSON.stringify(tag));
const others = await page.locator('[data-testid="price-discount"]').count();
check("Chegirmasiz kitoblarda belgi yo'q (faqat bitta)", others === 1, `${others}`);
await card.screenshot({ path: OUT + "99-discount-card-1366.png" });
await page.goto(`${BASE}/catalog/${BOOK}`);
await page.waitForSelector('[data-testid="price-tag"]', { timeout: 15000 });
check("Kitob sahifasi: chegirma ko'rinadi (−25%)", ((await page.textContent('[data-testid="price-discount"]')) ?? "") === "−25%");
await page.screenshot({ path: OUT + "99-discount-book-1366.png" });

// Telefon: karta ichida sig'adi
for (const W of [320, 390]) {
  const m = await open(W, 760, true);
  await m.goto(`${BASE}/catalog`);
  await m.waitForSelector('[data-testid="price-tag"]', { timeout: 20000 });
  const g = await m.evaluate(() => {
    const t = document.querySelector('[data-testid="price-tag"]');
    const c = t.closest('[data-testid="book-card"]').getBoundingClientRect();
    const r = t.getBoundingClientRect();
    return { inside: r.left >= c.left && r.right <= c.right + 0.5, sw: document.documentElement.scrollWidth - innerWidth };
  });
  check(`${W}px: chegirmali narx kartaga sig'adi, toshish yo'q`, g.inside && g.sw <= 1, JSON.stringify(g));
  await m.locator('[data-testid="book-card"]', { has: m.locator('[data-testid="price-tag"]') }).screenshot({ path: OUT + `99-discount-card-${W}.png` });
}

// ---- Olib tashlash: maydon bo'shatiladi → original_price 0
await admin.fill('[data-testid="book-original-price"]', "");
await admin.locator('form:has([data-testid="book-original-price"]) button[type="submit"]').click();
const body = await mockWait("/__last-book-body", (b) => "original_price" in b && Number(b.original_price) === 0);
check("Olib tashlash: PATCH original_price 0", Number(body.original_price) === 0);
await page.goto(`${BASE}/catalog`);
await page.waitForSelector('[data-testid="book-card"]', { timeout: 20000 });
check("Katalog: chegirma belgisi yo'qoldi", (await page.locator('[data-testid="price-discount"]').count()) === 0);

check("Sahifa xatolari yo'q", errors.length === 0, errors.join(" | ").slice(0, 300));
for (const c of ctxs) await c.close();
await done(browser);
