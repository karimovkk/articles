// Buyurtma oqimi (15-bo'lim) prod backend'da, frontend orqali (ikki tab): /payment-info, buyurtma → PENDING,
// 409 ORDER_ALREADY_PENDING → mavjud buyurtma, bekor qilish (CANCELLED), eskirgan tabda 409 INVALID_ORDER_STATE,
// GET /orders/{id}, reject sababi 422, admin chek fayli (RECEIPT_NOT_FOUND / mavjud chekni ko'rish — faqat o'qish).
// Prod'da 1 ta buyurtma yaratadi va uni BEKOR QILADI (CANCELLED yozuv qoladi). Chek YUBORILMAYDI —
// Telegram'ga xabar ketmaydi. Boshqa qurilmalar sessiyalariga tegmaydi (qurilma limiti 2 — bitta joy bo'sh bo'lishi
// kerak); oxirida chiqadi va joy bo'shaydi.
import { launch, confirmDialog, selectPick } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const BASE = process.env.E2E_BASE ?? "http://localhost:3200";
const API = process.env.A365_API ?? "https://articles.api.cognilabs.org/api/v1";
const EMAIL = process.env.A365_EMAIL, PASS = process.env.A365_PASS;
if (!EMAIL || !PASS) throw new Error("A365_EMAIL va A365_PASS env orqali berilsin");
const DEVICE = "fe-smoke-orders"; // brauzer va API so'rovlari bitta qurilma sifatida
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
const j = async (r) => { try { return await r.json(); } catch { return null; } };
for (const pth of ["/login", "/library", "/catalog", "/profile", "/admin/orders"]) await fetch(`${BASE}${pth}`).catch(() => undefined);

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript((d) => localStorage.setItem("a365.device", d), DEVICE);
const page = await ctx.newPage();
const pageErrors = [], apiCalls = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
ctx.on("response", (r) => { if (r.url().includes("/api/v1/")) apiCalls.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });

let H = null;
const created = [];
const front = async (pg) => { await pg.bringToFront(); await pg.waitForFunction(() => document.visibilityState === "visible", null, { timeout: 10000 }); };
const api = (path, init = {}) => fetch(`${API}${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });

async function cleanup() {
  // Yaratilgan va hali ochiq buyurtmalarni bekor qilish, keyin chiqish (qurilma joyi bo'shaydi)
  for (const id of created) {
    const o = await j(await api(`/orders/${id}`));
    if (o && (o.status === "PENDING" || o.status === "AWAITING_REVIEW")) console.log(`(prod) tozalash: ${id} → ${(await api(`/orders/${id}/cancel`, { method: "POST" })).status}`);
  }
  if (H) console.log(`(prod) logout → ${(await api("/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: await page.evaluate(() => localStorage.getItem("a365.refresh")).catch(() => null) }) })).status}`);
}
async function fail(e) {
  console.log("❌ XATO:", e.message.split("\n")[0]);
  for (const [i, pg] of ctx.pages().entries()) {
    await pg.screenshot({ path: OUT + `99-smoke-orders-failure-${i}.png` }).catch(() => {});
    console.log(`   tab ${i}: ${pg.url()} | panel=${await pg.getAttribute('[data-testid="order-panel"]', "data-status", { timeout: 1000 }).catch(() => "—")} | ${(await pg.textContent("main", { timeout: 1000 }).catch(() => ""))?.replace(/\s+/g, " ").slice(0, 220)}`);
  }
  await cleanup().catch(() => {});
  await browser.close();
  process.exit(1);
}

try {
// ---- Login (UI)
await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', EMAIL);
await page.fill('input[type="password"]', PASS);
await page.click('button[type="submit"]');
await Promise.race([page.waitForURL(`${BASE}/library`, { timeout: 45000 }), page.waitForSelector("text=Qurilmalar limiti", { timeout: 45000 })]);
if (!page.url().endsWith("/library")) {
  console.log("❌ Login bo'lmadi (qurilma limiti?) — bitta qurilmadan chiqing:", (await page.textContent("main").catch(() => ""))?.slice(0, 200));
  await browser.close();
  process.exit(1);
}
H = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("a365.access"))}`, "X-Device-Id": DEVICE };
check("Login (UI, qurilma limiti ichida)", true);

// ---- /payment-info
const pi = await api("/payment-info");
const info = await j(pi);
check("GET /payment-info → 200 {card_number, recipient, instructions}", pi.status === 200 && info && "card_number" in info && "recipient" in info && "instructions" in info, JSON.stringify(info));
const hasPayment = !!(info?.card_number || info?.recipient || info?.instructions);

// ---- Kitob tanlash: katalogda bor, kutubxonada yo'q, ochiq buyurtmasi yo'q
const cat = await j(await fetch(`${API}/catalog?page=1&page_size=50`));
const lib = await j(await api("/library?page=1&page_size=100"));
const owned = new Set((lib?.items ?? lib ?? []).map((b) => b.book_id));
const mine = (await j(await api("/orders"))) ?? [];
const openBooks = new Set(mine.filter((o) => o.status === "PENDING" || o.status === "AWAITING_REVIEW").map((o) => o.book_id));
const book = (cat?.items ?? []).map((b) => ({ ...b, id: b.book_id })).find((b) => !owned.has(b.id) && !openBooks.has(b.id));
if (!book) { console.log("❌ Mos kitob topilmadi (hammasi kutubxonada yoki ochiq buyurtmada)"); await cleanup(); await browser.close(); process.exit(1); }
console.log(`(prod) kitob: ${book.title} (${book.id})`);

// ---- Ikki tab bir kitobda (ochiq buyurtma yo'q): A — buyurtma beradi, B — eskirgan holatda qoladi
await page.goto(`${BASE}/catalog/${book.id}`);
await page.waitForSelector('[data-testid="order-panel"] button:has-text("Buyurtma berish")', { timeout: 45000 });
const pageB = await ctx.newPage();
pageB.on("pageerror", (e) => pageErrors.push(e.message));
await pageB.goto(`${BASE}/catalog/${book.id}`);
await pageB.waitForSelector('[data-testid="order-panel"] button:has-text("Buyurtma berish")', { timeout: 45000 });

// ---- A: buyurtma berish → PENDING (+ rekvizitlar, agar backend'da to'ldirilgan bo'lsa)
await front(page);
await page.click("button:has-text('Buyurtma berish')");
await page.waitForSelector('[data-testid="order-panel"][data-status="PENDING"]', { timeout: 20000 });
const o1 = (await j(await api("/orders"))).find((o) => o.book_id === book.id && o.status === "PENDING");
if (o1) created.push(o1.id);
check("UI: POST /orders → 201 PENDING, has_receipt_file=false", apiCalls.includes("201 POST /api/v1/orders") && o1?.has_receipt_file === false, JSON.stringify(o1 && { status: o1.status, has_receipt_file: o1.has_receipt_file }));
if (hasPayment) {
  await page.waitForSelector('[data-testid="payment-details"]', { timeout: 20000 });
  const card = (await page.textContent('[data-testid="payment-card"]').catch(() => null))?.trim() ?? "";
  check("Rekvizitlar bloki: karta 4 talik guruhlarda + qabul qiluvchi", card === info.card_number.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ") && (await page.textContent('[data-testid="payment-recipient"]')) === info.recipient.trim(), card);
} else {
  await page.waitForTimeout(1500);
  check("Rekvizitlar bo'sh → blok yashirin (xato yo'q)", (await page.locator('[data-testid="payment-details"]').count()) === 0);
}
await page.screenshot({ path: OUT + "p20-smoke-order-pending.png" });

// ---- API: takroriy buyurtma → 409 ORDER_ALREADY_PENDING + details; GET /orders/{id}; admin chek yo'q → 404; bo'sh sabab → 422
const dup = await api("/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ book_id: book.id }) });
const dupErr = (await j(dup))?.error;
check("409 ORDER_ALREADY_PENDING, details {order_id, status}", dup.status === 409 && dupErr?.code === "ORDER_ALREADY_PENDING" && dupErr?.details?.order_id === o1?.id && dupErr?.details?.status === "PENDING", JSON.stringify(dupErr));
const g = await api(`/orders/${o1.id}`);
const gj = await j(g);
check("GET /orders/{id} → 200, holat PENDING", g.status === 200 && gj?.id === o1.id && gj?.status === "PENDING");
const noRc = await api(`/admin/orders/${o1.id}/receipt`);
check("GET /admin/orders/{id}/receipt (chek yo'q) → 404 RECEIPT_NOT_FOUND", noRc.status === 404 && (await j(noRc))?.error?.code === "RECEIPT_NOT_FOUND");
const emptyReason = await api(`/admin/orders/${o1.id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "" }) });
check("Reject bo'sh sabab → 422, buyurtma o'zgarmadi", emptyReason.status === 422 && (await j(await api(`/orders/${o1.id}`)))?.status === "PENDING");

// ---- B (eskirgan tab): "Buyurtma berish" → 409 ORDER_ALREADY_PENDING → A'dagi buyurtma ko'rsatiladi → bekor qilish
await front(pageB);
await pageB.click("button:has-text('Buyurtma berish')");
await pageB.waitForSelector("text=ochiq buyurtmangiz bor", { timeout: 20000 });
check("UI: 409 → GET /orders/{details.order_id} → mavjud PENDING ko'rsatildi (yangi buyurtma yo'q)", apiCalls.includes("409 POST /api/v1/orders") && apiCalls.includes(`200 GET /api/v1/orders/${o1.id}`) && (await pageB.getAttribute('[data-testid="order-panel"]', "data-status")) === "PENDING" && (await j(await api("/orders"))).filter((o) => o.book_id === book.id && o.status === "PENDING").length === 1);
await pageB.screenshot({ path: OUT + "p21-smoke-order-existing.png" });
await pageB.click('[data-testid="cancel-order"]');
await confirmDialog(pageB, true);
await pageB.waitForSelector("text=Buyurtma bekor qilindi", { timeout: 20000 });
check("UI: POST /orders/{id}/cancel → CANCELLED, 'Buyurtma berish' qaytdi", apiCalls.includes(`200 POST /api/v1/orders/${o1.id}/cancel`) && (await j(await api(`/orders/${o1.id}`)))?.status === "CANCELLED" && (await pageB.locator("button:has-text('Buyurtma berish')").count()) === 1);
await pageB.close();

// ---- API: yopiq buyurtma → 409 INVALID_ORDER_STATE (approve)
const ap = await api(`/admin/orders/${o1.id}/approve`, { method: "POST" });
const apErr = (await j(ap))?.error;
check("CANCELLED'ni approve → 409 INVALID_ORDER_STATE", ap.status === 409 && apErr?.code === "INVALID_ORDER_STATE", `${ap.status} ${apErr?.code}`);

// ---- A (eskirgan: hali PENDING ko'rsatmoqda) → bekor qilish → 409 INVALID_ORDER_STATE → xabar + holat yangilanadi
await front(page);
await page.click('[data-testid="cancel-order"]');
await confirmDialog(page, true);
await page.waitForSelector("text=Buyurtma holati allaqachon o'zgargan", { timeout: 20000 });
await page.waitForSelector("button:has-text('Buyurtma berish')", { timeout: 20000 });
check("UI eskirgan tab: 409 INVALID_ORDER_STATE → tushunarli xabar + 'Buyurtma berish'", apiCalls.includes(`409 POST /api/v1/orders/${o1.id}/cancel`));
await page.screenshot({ path: OUT + "p22-smoke-order-stale.png" });

// ---- Buyurtmalarim: "Bekor qilingan", ochiq buyurtma tugmalari yo'q
await page.goto(`${BASE}/profile`);
await page.waitForFunction((t) => [...document.querySelectorAll("li")].some((l) => l.innerText.includes(t) && l.innerText.includes("Bekor qilingan")), book.title, { timeout: 45000 });
check("Buyurtmalarim: 'Bekor qilingan', bu kitobda bekor qilish tugmasi yo'q", (await page.locator("li", { hasText: book.title }).locator('[data-testid="cancel-order"]').count()) === 0);

// ---- Admin: mavjud chekni ko'rish (faqat o'qish) — chek fayli bor buyurtmani API orqali qidirish
let withFile = null;
for (let p = 1; p <= 10 && !withFile; p++) {
  const pg = await j(await api(`/admin/orders?page=${p}&page_size=100`));
  withFile = pg?.items?.find((o) => o.has_receipt_file) ?? null;
  if (!pg?.items?.length || p * 100 >= (pg.total ?? 0)) break;
}
if (withFile) {
  const rr = await api(`/admin/orders/${withFile.id}/receipt`);
  const ct = rr.headers.get("content-type") ?? "";
  const size = (await rr.arrayBuffer()).byteLength;
  check("GET /admin/orders/{id}/receipt → 200 rasm/PDF, no-store + nosniff", rr.status === 200 && /^(image\/|application\/pdf)/.test(ct) && size > 0 && /no-store/.test(rr.headers.get("cache-control") ?? "") && rr.headers.get("x-content-type-options") === "nosniff", `${rr.status} ${ct} ${size}B`);
  await page.goto(`${BASE}/admin/orders`);
  await page.waitForSelector('[data-testid="filter-status"]', { timeout: 45000 });
  await selectPick(page, '[data-testid="filter-status"]', withFile.status);
  await page.waitForFunction(() => document.body.innerText.includes("Jami"), null, { timeout: 20000 });
  const btn = page.locator('[data-testid="view-receipt"]');
  await btn.first().waitFor({ timeout: 20000 }).catch(() => undefined);
  if ((await btn.count()) > 0) {
    await btn.first().click();
    await page.waitForSelector('[data-testid="receipt-viewer-img"], [data-testid="receipt-viewer-pdf"]', { timeout: 20000 });
    check("Admin UI: chek oynada ochildi (blob)", ((await page.getAttribute('[data-testid="receipt-viewer-img"], [data-testid="receipt-viewer-pdf"]', "src")) ?? "").startsWith("blob:"));
    await page.screenshot({ path: OUT + "p23-smoke-admin-receipt.png" });
    await page.keyboard.press("Escape");
    await page.waitForSelector('[data-testid="receipt-viewer"]', { state: "detached", timeout: 5000 });
  } else console.log(`ℹ️  ${withFile.status} filtrining 1-sahifasida chekli qator yo'q — UI oynasi o'tkazib yuborildi`);
} else console.log("ℹ️  Prod'da chek fayli bor buyurtma yo'q — chekni ko'rish o'tkazib yuborildi");

// ---- Admin: CANCELLED filtri
await page.goto(`${BASE}/admin/orders`);
await page.waitForSelector('[data-testid="filter-status"]', { timeout: 45000 });
await selectPick(page, '[data-testid="filter-status"]', "CANCELLED");
await page.waitForFunction((t) => [...document.querySelectorAll("tbody tr")].some((r) => r.innerText.includes(t) && r.innerText.includes("Bekor qilingan")), book.title, { timeout: 20000 });
check("Admin filtri 'Bekor qilingan' → buyurtma ro'yxatda", apiCalls.some((c) => c.startsWith("200 GET /api/v1/admin/orders")));
await page.screenshot({ path: OUT + "p24-smoke-admin-cancelled.png" });

// ---- Xulosa
// Kutilgan: 409 (takroriy buyurtma / eskirgan tabda cancel), katalogdagi ruxsat tekshiruvi (403 = kitob sizniki emas)
const expected = (c) => c === "409 POST /api/v1/orders" || c === `409 POST /api/v1/orders/${o1.id}/cancel` || c === "401 POST /api/v1/auth/refresh" || c === `403 GET /api/v1/reader/books/${book.id}/articles`;
const bad = apiCalls.filter((c) => !c.startsWith("2") && !c.includes("/cover") && !expected(c));
check("Kutilmagan API xatolari yo'q (frontend)", bad.length === 0, bad.join(" | "));
check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
} catch (e) {
  await fail(e);
}
await cleanup();
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
