// 97 → 99: admin — kitobni o'chirish: xavfli zona, tasdiq (bekor qilinsa — hech narsa), bitta DELETE (force yo'q, 409 yo'q);
// buyurtmalar, belgilar, lug'at SAQLANADI — kitobdan uziladi (book_id = null, nom snapshot); natija ro'yxatda
// ("… o'chirildi (N ta maqola). Saqlandi: …"); o'chgan kitob buyurtmasi admin, "Buyurtmalarim" va to'lov statistikasida —
// havolasiz, "(o'chirilgan)".
import { launch, BASE, API, reset, mockGet, confirmDialog, ignorablePageError, makeCheck } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
const BOOK = "11111111-1111-4111-8111-111111111111", BOOK2 = "33333333-3333-4333-8333-333333333333";
const { check, done } = makeCheck();
await reset("");
// BOOK2: foydalanuvchi buyurtmasi (tasdiqlangan) + belgi + lug'at so'zi
const U = { Authorization: "Bearer access-token-1", "Content-Type": "application/json" };
const ART2 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ord = await (await fetch(`${API}/orders`, { method: "POST", headers: U, body: JSON.stringify({ book_id: BOOK2 }) })).json();
await fetch(`${API}/admin/orders/${ord.id}/approve`, { method: "POST", headers: { Authorization: "Bearer access-token-admin" } });
await fetch(`${API}/articles/${ART2}/annotations`, { method: "POST", headers: U, body: JSON.stringify({ type: "HIGHLIGHT", page: 1, selected_text: "x", color: "#93c5fd" }) });
await fetch(`${API}/me/vocabulary`, { method: "POST", headers: U, body: JSON.stringify({ article_id: ART2, word: "resilience", page: 1 }) });
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
check("O'chirildi: bitta DELETE (force'siz), ro'yxatga qaytdi, natija xabari (saqlanganlarsiz)", (await log()).length === 1 && !(await has(BOOK)) && note.includes("Test kitob") && note.includes("ta maqola") && !note.includes("Saqlandi"), note);
check("Kitob ro'yxatda yo'q", (await page.locator(`a[href="/admin/books/${BOOK}"]`).count()) === 0);
check("Cascade: maqolalar ham o'chdi", !(await mockGet("/__questions")).some((q) => q.article_id === "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));

// ---- Buyurtmali kitob: bitta tasdiq → bitta DELETE; buyurtma, belgi, lug'at saqlanadi
await page.goto(`${BASE}/admin/books/${BOOK2}`);
await page.waitForSelector('[data-testid="book-delete"]', { timeout: 30000 });
check("Xavfli zona: 'to'lov tarixi … saqlanadi'", ((await page.textContent('[data-testid="book-danger-zone"]')) ?? "").includes("saqlanadi"));
await page.click('[data-testid="book-delete"]');
await page.waitForSelector('[data-testid="confirm-dialog"]');
check("Tasdiq oynasi: buyurtma va o'quvchi ma'lumotlari saqlanishi aytilgan", ((await page.textContent('[data-testid="confirm-dialog"]')) ?? "").includes("saqlanadi"));
await confirmDialog(page);
await page.waitForSelector('[data-testid="book-deleted-note"]', { timeout: 15000 });
const note2 = (await page.textContent('[data-testid="book-deleted-note"]')) ?? "";
check("Ikkinchi tasdiq yo'q: bitta DELETE, force yuborilmadi", (await log()).filter((l) => l.endsWith(BOOK2)).length === 1 && !(await has(BOOK2)) && (await page.locator('[data-testid="confirm-dialog"]').count()) === 0);
check("Natija: 'Saqlandi: 1 ta buyurtma, 1 ta belgi, 1 ta lug'at so'zi'", note2.includes("Saqlandi") && note2.includes("1 ta buyurtma") && note2.includes("1 ta belgi") && note2.includes("1 ta lug'at so'zi"), note2);
const kept = (await mockGet("/__orders")).find((o) => o.id === ord.id);
check("Mock: buyurtma saqlandi — book_id null, nom snapshot", kept && kept.book_id === null && kept.book_title === "Ruxsatsiz kitob", JSON.stringify(kept)?.slice(0, 200));
await page.screenshot({ path: OUT + "99-admin-book-deleted-kept.png" });

// Admin buyurtmalar: havolasiz, "(o'chirilgan)"
await page.goto(`${BASE}/admin/orders`);
await page.waitForSelector('[data-testid="order-book-deleted"]', { timeout: 20000 });
const delCell = (await page.textContent('[data-testid="order-book-deleted"]')) ?? "";
check("Admin buyurtmalar: o'chgan kitob — nom + (o'chirilgan), havola yo'q", delCell.includes("Ruxsatsiz kitob") && delCell.includes("o'chirilgan") && (await page.locator('a:has([data-testid="order-book-deleted"]), a[href="/admin/books/null"]').count()) === 0, delCell);
await page.screenshot({ path: OUT + "99b-admin-orders-deleted-book.png" });
// To'lov statistikasi: daromadda qoladi, havolasiz
await page.goto(`${BASE}/admin/payments`);
await page.waitForSelector('[data-testid="pay-book-deleted"]', { timeout: 20000 });
check("To'lovlar: kitoblar bo'yicha — o'chgan kitob daromadda, havolasiz", ((await page.textContent('[data-testid="pay-book-deleted"]')) ?? "").includes("Ruxsatsiz kitob") && (await page.locator('a[href="/admin/books/null"]').count()) === 0);

// Foydalanuvchi: "Buyurtmalarim" — havolasiz, "Kitobni ochish" yo'q
const user = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
user.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
await user.goto(`${BASE}/login`);
await user.waitForSelector('input[autocomplete="username"]:not([readonly])', { timeout: 60000 });
await user.fill('input[autocomplete="username"]', "user@articles365.local");
await user.fill('input[type="password"]', "User12345!");
await user.click('button[type="submit"]');
await user.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
await user.goto(`${BASE}/profile`);
await user.waitForSelector('[data-testid="order-book-deleted"]', { timeout: 20000 });
check("Buyurtmalarim: o'chgan kitob — nom + (o'chirilgan), havolasiz, 'Kitobni ochish' yo'q", ((await user.textContent('[data-testid="order-book-deleted"]')) ?? "").includes("Ruxsatsiz kitob") && (await user.locator('a[href="/books/null"], a[href="/catalog/null"]').count()) === 0);
await user.screenshot({ path: OUT + "99c-my-orders-deleted-book.png" });
await user.close();

// ---- Ro'yxatdan o'chirish: har qatorda tugma, tasdiq bilan; qator bosilishi ishlamaydi
await reset("");
await page.goto(`${BASE}/admin/books`);
await page.waitForSelector('[data-testid="book-row-delete"]', { timeout: 30000 });
const rows0 = await page.locator('[data-testid="book-row-delete"]').count();
const row = page.locator("tr", { has: page.locator(`a[href="/admin/books/${BOOK}"]`) });
await row.locator('[data-testid="book-row-delete"]').click();
await page.waitForSelector('[data-testid="confirm-dialog"]');
check("Ro'yxat: har kitobda o'chirish tugmasi; bosilganda tasdiq (kitob sahifasiga o'tmadi)", rows0 >= 2 && page.url().endsWith("/admin/books") && ((await page.textContent('[data-testid="confirm-dialog"]')) ?? "").includes("Test kitob"));
await confirmDialog(page, false);
check("Bekor — kitob joyida", (await has(BOOK)) && (await log()).length === 0);
await row.locator('[data-testid="book-row-delete"]').click();
await confirmDialog(page);
await page.waitForSelector('[data-testid="book-deleted-note"]', { timeout: 15000 });
await page.waitForFunction((id) => !document.querySelector(`a[href="/admin/books/${id}"]`), BOOK, { timeout: 10000 });
check("Tasdiqlandi — kitob o'chdi, ro'yxatda yo'q, natija xabari", !(await has(BOOK)) && (await page.locator(`a[href="/admin/books/${BOOK}"]`).count()) === 0 && ((await page.textContent('[data-testid="book-deleted-note"]')) ?? "").includes("Test kitob"));
await page.screenshot({ path: OUT + "97b-admin-books-list-delete.png" });

check("Sahifa xatolari yo'q", errors.length === 0, errors.join(" | ").slice(0, 300));
await done(browser);
