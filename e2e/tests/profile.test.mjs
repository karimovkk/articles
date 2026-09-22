// Task 7.4 — profil: parol o'zgartirish, 2FA (QR, enable/disable), buyurtmalarim (receipt → admin approve)
import { launch, BASE, API, reset, mockGet } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const BOOK2 = "33333333-3333-4333-8333-333333333333";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");
const uh = { Authorization: "Bearer access-token-1", "Content-Type": "application/json" };
const ah = { Authorization: "Bearer access-token-admin", "Content-Type": "application/json" };
const order = await (await fetch(`${API}/orders`, { method: "POST", headers: uh, body: JSON.stringify({ book_id: BOOK2 }) })).json();

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-profile-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });
const bodyHas = async (text) => page.evaluate((t) => document.body.innerText.replace(/ /g, " ").includes(t), text);

await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);
await page.goto(`${BASE}/profile`);
await page.waitForSelector("text=Parolni o'zgartirish", { timeout: 10000 });

// ---- Parol: noto'g'ri joriy parol → xato; mos kelmaslik; muvaffaqiyat
const pwCard = page.locator("form", { has: page.locator('input[autocomplete="current-password"]') });
await pwCard.locator('input[autocomplete="current-password"]').fill("wrong");
await pwCard.locator('input[autocomplete="new-password"]').nth(0).fill("NewPass123");
await pwCard.locator('input[autocomplete="new-password"]').nth(1).fill("NewPass124");
await pwCard.locator('button[type="submit"]').click();
await page.waitForSelector("text=Parollar mos emas", { timeout: 5000 });
check("Parol: tasdiqlash mos kelmasa — klient xatosi", true);
await pwCard.locator('input[autocomplete="new-password"]').nth(1).fill("NewPass123");
await pwCard.locator('button[type="submit"]').click();
await page.waitForSelector("text=Login yoki parol noto'g'ri", { timeout: 5000 });
check("Parol: noto'g'ri joriy parol → backend xato matni", true);
await pwCard.locator('input[autocomplete="current-password"]').fill("User12345!");
await pwCard.locator('button[type="submit"]').click();
await page.waitForSelector("text=Parol o'zgartirildi", { timeout: 5000 });
check("Parol: muvaffaqiyatli o'zgartirildi (POST /me/password)", true);

// ---- 2FA: holat (two_factor_enabled=false → faqat "yoqish"), setup → QR → kod
check("2FA holati: O'chirilgan badge, faqat 'yoqish' tugmasi", (await bodyHas("O'chirilgan")) && (await page.locator("text=2FA o'chirish").count()) === 0);
await page.click("text=2FA yoqish");
await page.waitForSelector("canvas[aria-label='QR']", { timeout: 5000 });
const qrDrawn = await page.evaluate(() => { const c = document.querySelector("canvas[aria-label='QR']"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let dark = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 128) dark++; return c.width > 100 && dark > 500; });
check("2FA: QR canvas lokal chizildi (tashqi servissiz)", qrDrawn);
check("2FA: kalit (secret) ko'rsatildi", await bodyHas("JBSWY3DPEHPK3PXP"));
await page.fill('input[autocomplete="one-time-code"]', "000000");
await page.click("text=Yoqish");
await page.waitForSelector("text=Tasdiqlash kodi noto'g'ri", { timeout: 5000 });
check("2FA: noto'g'ri kod → INVALID_TOTP matni", true);
await page.fill('input[autocomplete="one-time-code"]', "123456");
await page.click("text=Yoqish");
await page.waitForSelector("text=2FA yoqildi", { timeout: 5000 });
await page.waitForFunction(() => document.body.innerText.includes("Yoqilgan"), null, { timeout: 5000 });
check("2FA: yoqildi → holat 'Yoqilgan' (user refresh), faqat 'o'chirish' tugmasi", (await page.locator("text=2FA yoqish").count()) === 0);
await page.click("text=2FA o'chirish");
await page.fill('input[autocomplete="one-time-code"]', "123456");
await page.click("text=O'chirish");
await page.waitForSelector("text=2FA o'chirildi", { timeout: 5000 });
check("2FA: o'chirildi", true);

// ---- Buyurtmalarim: PENDING → To'ladim → AWAITING_REVIEW → admin approve → APPROVED
await page.waitForSelector("text=Ruxsatsiz kitob", { timeout: 8000 });
check("Buyurtma: kitob nomi (katalogdan), narx, holat 'To'lov kutilmoqda'", (await bodyHas("70 000 so'm")) && (await bodyHas("To'lov kutilmoqda")));
await page.click("text=To'ladim — chek yuborish");
// Chek rasmi (1×1 PNG) + izoh — multipart
await page.setInputFiles('[data-testid="receipt-file"]', { name: "chek.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") });
await page.waitForSelector('[data-testid="receipt-preview"]', { timeout: 3000 });
await page.fill('textarea[placeholder^="Chek raqami"]', "Chek #123");
await page.click('[data-testid="receipt-submit"]');
await page.waitForSelector("text=Tekshirilmoqda", { timeout: 5000 });
const o1 = (await mockGet("/__orders"))[0];
const r1 = (await mockGet("/__receipts"))[0];
check("Buyurtmalarim: chek rasmi + izoh (multipart) → AWAITING_REVIEW", o1.status === "AWAITING_REVIEW" && o1.receipt_note === "Chek #123" && r1?.file?.type === "image/png", JSON.stringify(r1));
await page.screenshot({ path: OUT + "70-profile-orders.png" });
await fetch(`${API}/admin/orders/${order.id}/approve`, { method: "POST", headers: ah });
// Kuzatuv: reload'siz — sahifaga qaytish (focus) holatni yangilaydi
await page.evaluate(() => window.dispatchEvent(new Event("focus")));
await page.waitForSelector("text=Tasdiqlangan", { timeout: 10000 });
check("Admin tasdiqladi → kuzatuv (reload'siz) APPROVED + 'Kitobni ochish' havolasi", (await page.locator(`a[href="/books/${BOOK2}"]`).count()) >= 1);

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
