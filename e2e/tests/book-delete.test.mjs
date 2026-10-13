// 97: admin — kitobni butunlay o'chirish (hard delete): xavfli zona, tasdiq (bekor qilinsa — hech narsa), buyurtmasiz
// kitob — bitta DELETE; buyurtmali kitob — 409 BOOK_HAS_ORDERS → ikkinchi tasdiq (buyurtmalar soni) → force=true;
// natija ro'yxatda ("… o'chirildi — N ta maqola, M ta buyurtma"), kitob ro'yxatdan yo'qoladi.
import { launch, BASE, API, reset, mockGet, confirmDialog, ignorablePageError, makeCheck } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
const BOOK = "11111111-1111-4111-8111-111111111111", BOOK2 = "33333333-3333-4333-8333-333333333333";
const { check, done } = makeCheck();
await reset("");
// BOOK2 ga buyurtma (foydalanuvchi)
await fetch(`${API}/orders`, { method: "POST", headers: { Authorization: "Bearer access-token-1", "Content-Type": "application/json" }, body: JSON.stringify({ book_id: BOOK2 }) });
const browser = await launch();
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
await page.goto(`${BASE}/login`);
await page.waitForSelector('input[autocomplete="username"]:not([readonly])', { timeout: 60000 });
await page.fill('input[autocomplete="username"]', "admin@articles365.local");
await page.fill('input[type="password"]', "Admin12345!");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
const has = async (id) => (await mockGet("/__books")).some((b) => b.id === id);
const log = async () => (await mockGet("/__log")).filter((l) => l.startsWith("DELETE /admin/books/"));

// ---- Buyurtmasiz kitob
await page.goto(`${BASE}/admin/books/${BOOK}`);
await page.waitForSelector('[data-testid="book-danger-zone"]', { timeout: 30000 });
check("Xavfli zona: 'Butunlay o'chirish' va izoh (qaytarib bo'lmaydi; vaqtincha — Nofaol qilish)", ((await page.textContent('[data-testid="book-danger-zone"]')) ?? "").includes("Qaytarib bo'lmaydi") && (await page.locator('[data-testid="book-status-switch"]').count()) === 1);
await page.locator('[data-testid="book-danger-zone"]').scrollIntoViewIfNeeded();
await page.screenshot({ path: OUT + "97-admin-book-danger.png" });
await page.click('[data-testid="book-delete"]');
await page.waitForSelector('[data-testid="confirm-dialog"]');
check("Tasdiq oynasi: kitob nomi va 'qaytarib bo'lmaydi'", ((await page.textContent('[data-testid="confirm-dialog"]')) ?? "").includes("Test kitob") && ((await page.textContent('[data-testid="confirm-dialog"]')) ?? "").includes("qaytarib bo'lmaydi"));
await confirmDialog(page, false);
check("Bekor qilindi — so'rov yo'q, kitob joyida", (await log()).length === 0 && (await has(BOOK)));
await page.click('[data-testid="book-delete"]');
await confirmDialog(page);
await page.waitForFunction(() => location.pathname === "/admin/books", null, { timeout: 15000 });
await page.waitForSelector('[data-testid="book-deleted-note"]', { timeout: 10000 });
const note = (await page.textContent('[data-testid="book-deleted-note"]')) ?? "";
check("O'chirildi: bitta DELETE (force'siz), ro'yxatga qaytdi, natija xabari", (await log()).length === 1 && !(await has(BOOK)) && note.includes("Test kitob") && note.includes("0 ta buyurtma"), note);
check("Kitob ro'yxatda yo'q", (await page.locator(`a[href="/admin/books/${BOOK}"]`).count()) === 0);
check("Cascade: maqolalar ham o'chdi", !(await mockGet("/__questions")).some((q) => q.article_id === "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));

// ---- Buyurtmali kitob: 409 → ikkinchi tasdiq → force
await page.goto(`${BASE}/admin/books/${BOOK2}`);
await page.waitForSelector('[data-testid="book-delete"]', { timeout: 30000 });
await page.click('[data-testid="book-delete"]');
await confirmDialog(page);
await page.waitForSelector('[data-testid="confirm-dialog"]:has-text("buyurtma")', { timeout: 8000 });
check("Buyurtmali kitob: 409 → '1 ta buyurtma bor… to'lov tarixi ham yo'qoladi'", ((await page.textContent('[data-testid="confirm-dialog"]')) ?? "").includes("1 ta buyurtma") && (await has(BOOK2)));
await confirmDialog(page, false);
await page.waitForTimeout(300);
check("Ikkinchi tasdiq bekor qilindi — kitob joyida, force yuborilmadi", (await has(BOOK2)) && (await log()).filter((l) => l.endsWith(BOOK2)).length === 1);
await page.click('[data-testid="book-delete"]');
await confirmDialog(page);
await page.waitForSelector('[data-testid="confirm-dialog"]:has-text("buyurtma")', { timeout: 8000 });
await confirmDialog(page);
await page.waitForSelector('[data-testid="book-deleted-note"]', { timeout: 15000 });
check("Tasdiqlandi → yana DELETE (409) va force bilan (jami 3 so'rov), kitob va buyurtmasi o'chdi, '1 ta buyurtma'", (await log()).filter((l) => l.endsWith(BOOK2)).length === 3 && !(await has(BOOK2)) && (await mockGet("/__orders")).length === 0 && ((await page.textContent('[data-testid="book-deleted-note"]')) ?? "").includes("1 ta buyurtma"));
check("Sahifa xatolari yo'q", errors.length === 0, errors.join(" | ").slice(0, 300));
await done(browser);
