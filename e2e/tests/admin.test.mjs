// Task 7.7 — admin: maqolalar CRUD/fayl/TOC, buyurtmalar approve/reject, foydalanuvchi yaratish/parol/sessiyalar, eksport, nomlar
import { launch, BASE, API, reset, mockGet, selectPick, confirmDialog } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const BOOK = "11111111-1111-4111-8111-111111111111", BOOK2 = "33333333-3333-4333-8333-333333333333";
const USER_ID = "u1u1u1u1-u1u1-4u1u-8u1u-u1u1u1u1u1u1";
const PDF = new URL("../mock/book.pdf", import.meta.url).pathname;
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");
const uh = { Authorization: "Bearer access-token-1", "Content-Type": "application/json" };
const o = await (await fetch(`${API}/orders`, { method: "POST", headers: uh, body: JSON.stringify({ book_id: BOOK2 }) })).json();
// Chek — multipart/form-data (buyurtma oqimi v1.0)
const receiptForm = new FormData();
receiptForm.append("receipt_note", "Chek 777");
receiptForm.append("file", new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64")], { type: "image/png" }), "chek.png");
await fetch(`${API}/orders/${o.id}/receipt`, { method: "POST", headers: { Authorization: uh.Authorization }, body: receiptForm });

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-admin-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });
const bodyHas = async (text) => page.evaluate((t) => document.body.innerText.replace(/ /g, " ").includes(t), text);

await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "admin@articles365.local");
await page.fill('input[type="password"]', "Admin12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);

// ---- Dashboard: tekshiruvdagi buyurtmalar plitkasi
await page.goto(`${BASE}/admin`);
await page.waitForSelector("text=Tekshiruvdagi buyurtmalar", { timeout: 10000 });
await page.waitForFunction(() => [...document.querySelectorAll("a")].some((a) => a.href.endsWith("/admin/orders") && /\b1\b/.test(a.innerText)), null, { timeout: 8000 });
check("Dashboard: tekshiruvdagi buyurtmalar = 1", true);

// ---- 11.5 Sidebar yig'ish tugmasi: ikkala holatda ham bir xil balandlikda, sidebar chekkasida; holat saqlanadi
const togglePos = async () => page.evaluate(() => {
  const r = document.querySelector('[data-testid="nav-toggle"]').getBoundingClientRect();
  const sb = document.querySelector(".sidebar").getBoundingClientRect();
  return { cy: Math.round(r.top + r.height / 2), cx: Math.round(r.left + r.width / 2), edge: Math.round(sb.right), w: Math.round(sb.width) };
});
const p1 = await togglePos();
await page.click('[data-testid="nav-toggle"]');
await page.waitForFunction(() => document.querySelector(".app-frame").dataset.nav === "collapsed", null, { timeout: 3000 });
await page.waitForTimeout(350);
const p2 = await togglePos();
check("Sidebar yig'ildi (256 → 84 px)", p1.w > 200 && p2.w < 100, `${p1.w}→${p2.w}`);
check("Yig'ish tugmasi bir xil balandlikda qoldi va chekkada", p1.cy === p2.cy && Math.abs(p1.cx - p1.edge) < 4 && Math.abs(p2.cx - p2.edge) < 4, JSON.stringify([p1, p2]));
check("Sidebar holati localStorage'da", (await page.evaluate(() => localStorage.getItem("a365.adminNav"))) === "collapsed");
await page.click('[data-testid="nav-toggle"]');
await page.waitForFunction(() => document.querySelector(".app-frame").dataset.nav === "open", null, { timeout: 3000 });

// ---- Buyurtmalar: nomlar resolve, approve → ruxsat
await page.goto(`${BASE}/admin/orders`);
await page.waitForSelector("text=Chek 777", { timeout: 10000 });
check("Buyurtmalar: filtr default 'Barcha holatlar'", (await page.locator('[data-testid="filter-status"]').getAttribute("data-value")) === "");
await page.waitForSelector("text=Test User", { timeout: 8000 });
const logN = await mockGet("/__log");
check("Buyurtmalar: user/book nomlari backend maydonlaridan (N+1 so'rov yo'q), chek, holat", (await bodyHas("Ruxsatsiz kitob")) && (await bodyHas("Tekshirilmoqda")) && !logN.some((l) => /^GET \/admin\/(users|books)\/[0-9a-f-]{36}$/.test(l)));
// ---- Chekni ko'rish (GET /admin/orders/{id}/receipt, Bearer → blob): faqat has_receipt_file bo'lsa tugma
check("Chek fayli bor → 'Chekni ko'rish' tugmasi", (await page.locator('[data-testid="view-receipt"]').count()) === 1);
await page.click('[data-testid="view-receipt"]');
await page.waitForSelector('[data-testid="receipt-viewer-img"]', { timeout: 8000 });
check("Chek oynasi: rasm (blob URL) + izoh + yangi oynada ochish", (await page.getAttribute('[data-testid="receipt-viewer-img"]', "src"))?.startsWith("blob:") && (await page.locator('[data-testid="receipt-viewer"] >> text=Chek 777').count()) === 1 && (await page.locator('[data-testid="receipt-viewer"] a:has-text("Yangi oynada ochish")').count()) === 1 && (await mockGet("/__log")).includes(`GET /admin/orders/${o.id}/receipt`));
await page.screenshot({ path: OUT + "63-admin-receipt.png" });
await page.keyboard.press("Escape");
await page.waitForSelector('[data-testid="receipt-viewer"]', { state: "detached", timeout: 5000 });
// Fayl topilmasa (404 RECEIPT_NOT_FOUND) — tushunarli xabar
await page.route("**/api/v1/admin/orders/*/receipt", (r) => r.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "RECEIPT_NOT_FOUND", message: "x", details: null } }) }));
await page.click('[data-testid="view-receipt"]');
await page.waitForSelector("text=Bu buyurtmada chek fayli yo'q", { timeout: 5000 });
check("404 RECEIPT_NOT_FOUND → 'chek fayli yo'q'", (await page.locator('[data-testid="receipt-viewer-img"]').count()) === 0);
await page.unroute("**/api/v1/admin/orders/*/receipt");
await page.keyboard.press("Escape");
await page.waitForSelector('[data-testid="receipt-viewer"]', { state: "detached", timeout: 5000 });
await page.click("text=Tasdiqlash");
// "Barchasi" filtrida buyurtma ro'yxatda qoladi — holati Tasdiqlangan bo'ladi, amal tugmalari yo'qoladi
await page.waitForFunction(() => document.body.innerText.includes("Tasdiqlangan") && ![...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Tasdiqlash"), null, { timeout: 8000 });
const accessAfter = await (await fetch(`${API}/admin/book-access?book_id=${BOOK2}`, { headers: { Authorization: "Bearer access-token-admin" } })).json();
check("Approve → ruxsat yaratildi (book-access)", accessAfter.items.some((a) => a.user_id === USER_ID && a.status === "ACTIVE"));
// reject flow
const o2 = await (await fetch(`${API}/orders`, { method: "POST", headers: uh, body: JSON.stringify({ book_id: "22222222-2222-4222-8222-000000000001" }) })).json();
await selectPick(page, '[data-testid="filter-status"]', "PENDING");
await page.waitForSelector("text=Rad etish", { timeout: 8000 });
await page.click("text=Rad etish");
await page.waitForSelector('[data-testid="reject-reason-input"]');
check("Rad etish: sabab bo'sh — tugma o'chiq (sabab majburiy, userga ko'rinadi)", await page.locator('div[role="dialog"] button[type="submit"]:has-text("Rad etish")').isDisabled());
await page.fill('textarea[placeholder^="Sabab"]', "To'lov kelmadi");
await page.click('button[type="submit"]:has-text("Rad etish")');
await page.waitForFunction(() => document.body.innerText.includes("Ma'lumot yo'q"), null, { timeout: 8000 });
const ord = (await mockGet("/__orders")).find((x) => x.id === o2.id);
check("Reject → REJECTED + sabab", ord?.status === "REJECTED" && ord?.reject_reason === "To'lov kelmadi");
// Bo'sh sabab API'da ham 422
const emptyReason = await fetch(`${API}/admin/orders/${o2.id}/reject`, { method: "POST", headers: { Authorization: "Bearer access-token-admin", "Content-Type": "application/json" }, body: JSON.stringify({ reason: " " }) });
check("Mock: bo'sh sabab → 422 (backend bilan bir xil)", emptyReason.status === 422);
// ---- CANCELLED filtri + 409 INVALID_ORDER_STATE (foydalanuvchi bekor qildi / Telegram'da hal qilindi) → xabar + yangilash
const o3 = await (await fetch(`${API}/orders`, { method: "POST", headers: uh, body: JSON.stringify({ book_id: "22222222-2222-4222-8222-000000000001" }) })).json();
await selectPick(page, '[data-testid="filter-status"]', "CANCELLED");
await page.waitForFunction(() => document.body.innerText.includes("Ma'lumot yo'q"), null, { timeout: 8000 });
await selectPick(page, '[data-testid="filter-status"]', "PENDING");
await page.waitForSelector("button:has-text('Tasdiqlash')", { timeout: 8000 });
await fetch(`${API}/orders/${o3.id}/cancel`, { method: "POST", headers: uh });
await page.click("button:has-text('Tasdiqlash')");
await page.waitForSelector("text=Buyurtma holati allaqachon o'zgargan", { timeout: 8000 });
await page.waitForFunction(() => document.body.innerText.includes("Ma'lumot yo'q"), null, { timeout: 8000 });
check("409 INVALID_ORDER_STATE → xabar + ro'yxat yangilandi (ruxsat berilmadi)", (await mockGet("/__orders")).find((x) => x.id === o3.id)?.status === "CANCELLED");
await selectPick(page, '[data-testid="filter-status"]', "CANCELLED");
await page.waitForSelector("tbody tr:has-text('Bekor qilingan')", { timeout: 8000 });
check("Filtr 'Bekor qilingan' → CANCELLED buyurtma", (await page.locator('[data-testid="view-receipt"]').count()) === 0);

// ---- Maqolalar: yaratish → fayl yuklash → PROCESSING → READY (polling) → TOC → rename → o'chirish
await page.goto(`${BASE}/admin/books/${BOOK}`);
await page.waitForSelector("text=Maqolalar (3)", { timeout: 10000 });
await page.click('[data-testid="tab-access"]');
check("Kitob: ruxsat ro'yxatida user nomi", await bodyHas("Test User"));
await page.click('[data-testid="tab-articles"]');
await page.fill('input[placeholder^="Masalan"]', "Yangi bob");
await page.click("text=Maqola qo'shish");
await page.waitForSelector("text=Maqolalar (4)", { timeout: 8000 });
check("Maqola yaratildi (UPLOADING, faylsiz)", await bodyHas("Yangi bob"));
const row = page.locator("tr", { hasText: "Yangi bob" });
const fileChooser = page.waitForEvent("filechooser");
await row.locator('button:has-text("PDF yuklash")').click();
await (await fileChooser).setFiles(PDF);
await page.waitForFunction(() => [...document.querySelectorAll("tr")].some((r) => r.innerText.includes("Yangi bob") && r.innerText.includes("PROCESSING")), null, { timeout: 10000 });
check("PDF yuklandi → PROCESSING", true);
await page.waitForFunction(() => [...document.querySelectorAll("tr")].some((r) => r.innerText.includes("Yangi bob") && r.innerText.includes("READY")), null, { timeout: 10000 });
check("Polling → READY (3 s da yangilanadi)", true);
const ups = await mockGet("/__uploads");
check("Fayl maqola endpointiga ketdi (multipart)", ups.some((u) => u.path.includes("/articles/") && u.path.endsWith("/file") && u.contentType === "multipart/form-data"));
// TOC (qator menyusi — qo'lbola Menu)
await row.locator('[data-testid="article-menu"]').click();
await page.click('[role="menuitem"]:has-text("Mundarija")');
await page.waitForSelector("text=Qo'lda mundarija", { timeout: 5000 });
await page.fill('input[placeholder="Bo\'lim sarlavhasi"]', "Kirish");
await page.fill('input[placeholder="Sahifa"]', "1");
await page.click("text=Qator qo'shish");
await page.locator('input[placeholder="Bo\'lim sarlavhasi"]').nth(1).fill("Asosiy qism");
await page.locator('input[placeholder="Sahifa"]').nth(1).fill("3");
await selectPick(page, page.locator('[role="combobox"][aria-label="level"]').nth(1), "2");
await page.click('div[role="dialog"] button[type="submit"]');
await page.waitForFunction(() => !document.querySelector('div[role="dialog"]'), null, { timeout: 8000 });
const arts = await mockGet("/__articles");
const nb = arts.find((a) => a.title === "Yangi bob");
check("Qo'lda TOC saqlandi (PUT .../toc: level/title/page)", JSON.stringify(nb?.article_metadata?.toc) === JSON.stringify([{ level: 1, title: "Kirish", page: 1 }, { level: 2, title: "Asosiy qism", page: 3 }]), JSON.stringify(nb?.article_metadata?.toc));
// rename
await row.locator('[data-testid="article-menu"]').click();
await page.click('[role="menuitem"]:has-text("Tahrirlash")');
await page.fill('div[role="dialog"] input', "Yangi bob (tahrir)");
await page.click('div[role="dialog"] button[type="submit"]');
await page.waitForSelector("text=Yangi bob (tahrir)", { timeout: 8000 });
check("Maqola nomi o'zgartirildi (PATCH)", true);
// reorder: move up
await page.locator("tr", { hasText: "Yangi bob (tahrir)" }).locator('button[aria-label="Yuqoriga"]').click();
await page.waitForFunction(() => { const rows = [...document.querySelectorAll("tr[data-article]")]; return rows[2]?.innerText.includes("Yangi bob (tahrir)"); }, null, { timeout: 8000 });
check("Tartib o'zgartirildi (order_index almashinuvi)", true);
// delete (qo'lbola ConfirmDialog)
await page.locator("tr", { hasText: "Yangi bob (tahrir)" }).locator('[data-testid="article-menu"]').click();
await page.click('[role="menuitem"]:has-text("O\'chirish")');
await confirmDialog(page, true);
await page.waitForSelector("text=Maqolalar (3)", { timeout: 8000 });
check("Maqola o'chirildi (DELETE)", true);
await page.screenshot({ path: OUT + "100-admin-articles.png" });

// ---- Foydalanuvchi yaratish → sahifa → parol tiklash → barcha sessiyalarni bekor qilish
await page.goto(`${BASE}/admin/users`);
await page.waitForSelector("text=Foydalanuvchi yaratish", { timeout: 10000 });
await page.click("text=Foydalanuvchi yaratish");
await page.fill('div[role="dialog"] input[placeholder^="user@example"]', "yangi@articles365.local");
await page.locator('div[role="dialog"] input').nth(0).fill("Yangi Foydalanuvchi");
await page.locator('div[role="dialog"] input[type="password"]').fill("Parol12345");
await page.click('div[role="dialog"] button[type="submit"]');
await page.waitForURL((u) => /\/admin\/users\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 10000 });
await page.waitForSelector("text=Yangi Foydalanuvchi", { timeout: 8000 });
check("Foydalanuvchi yaratildi (POST /admin/users) → detail sahifasi", true);
await page.click("text=Parolni tiklash");
await page.fill('div[role="dialog"] input', "Yangi12345");
await page.click('div[role="dialog"] button[type="submit"]');
await page.waitForSelector("text=Parol tiklandi", { timeout: 8000 });
check("Parol tiklandi (POST reset-password)", true);
await page.click("text=Barcha sessiyalarni bekor qilish");
await confirmDialog(page, true);
await page.waitForTimeout(500);
const log = await mockGet("/__log");
check("Barcha sessiyalar bekor qilindi (DELETE /admin/users/{id}/sessions)", log.some((l) => /^DELETE \/admin\/users\/[^/]+\/sessions$/.test(l)));

// ---- Eksport (XLSX yuklab olish)
await page.goto(`${BASE}/admin/users`);
const dl = page.waitForEvent("download");
await page.click("text=Excel (XLSX) yuklab olish");
const d = await dl;
check("Eksport: fayl nomi Content-Disposition'dan (users.xlsx)", d.suggestedFilename() === "users.xlsx", d.suggestedFilename());

// ---- Ruxsatlar ro'yxati: nomlar
await page.goto(`${BASE}/admin/access`);
await page.waitForSelector("text=Test User", { timeout: 10000 });
check("Ruxsatlar: user va kitob nomlari", await bodyHas("Test kitob"));

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
