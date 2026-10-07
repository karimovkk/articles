// 67 — Admin "Reklama" (broadcast): rasm (ixtiyoriy) + matn → botdagi barcha foydalanuvchilarga. Bo'sh — yuborib
// bo'lmaydi; hisoblagich (rasm bilan ≤ 1024, faqat matn ≤ 4096); yuborishdan oldin tasdiq ("Yo'q" — so'rov yo'q);
// multipart (text + file); jarayon kuzatiladi (har 2.5 s) → "Yuborildi 4/5 · xato 1", DONE; tarix jadvali; telefon.
import { launch, BASE, reset, mockGet, confirmDialog, ignorablePageError } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const IMG = new URL("../../public/bg/article-960.webp", import.meta.url).pathname;
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-broadcast-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });
const text = (sel) => page.textContent(sel).then((s) => (s ?? "").replace(/\s+/g, " ").trim());

await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "admin@articles365.local");
await page.fill('input[type="password"]', "Admin12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
await page.goto(`${BASE}/admin`);
await page.click('a[href="/admin/broadcast"]');
await page.waitForSelector('[data-testid="broadcast-page"]', { timeout: 15000 });
check("Menyu: 'Reklama' → /admin/broadcast", page.url().endsWith("/admin/broadcast"));
check("Bo'sh: yuborish o'chiq, tarix bo'sh", (await page.locator('[data-testid="bc-send"]').isDisabled()) && (await page.locator('[data-testid="bc-row"]').count()) === 0);

// Matn + rasm → hisoblagich 1024 ga o'tadi; uzun matn — xato, yuborib bo'lmaydi
await page.fill('[data-testid="bc-text"]', "Yangi kitoblar keldi! 📚");
check("Faqat matn: hisoblagich '… / 4096'", (await text('[data-testid="bc-counter"]')).endsWith("/ 4096"));
await page.setInputFiles('[data-testid="bc-file"]', IMG);
await page.waitForSelector('[data-testid="bc-image-preview"]', { timeout: 10000 });
check("Rasm qo'shildi: oldindan ko'rish, hisoblagich '… / 1024'", (await text('[data-testid="bc-counter"]')).endsWith("/ 1024"));
await page.fill('[data-testid="bc-text"]', "x".repeat(1100));
check("Rasm bilan 1100 belgi: xato, yuborish o'chiq", (await page.locator('[data-testid="bc-too-long"]').count()) === 1 && (await page.locator('[data-testid="bc-send"]').isDisabled()));
await page.fill('[data-testid="bc-text"]', "Kuz chegirmalari: barcha kitoblar 20% arzon! Bugun bot orqali buyurtma bering.");
check("Telegram ko'rinishi: matn namunada", (await text('[data-testid="bc-preview"]')).includes("Kuz chegirmalari"));
await page.screenshot({ path: OUT + "98-admin-broadcast.png", fullPage: true });

// Tasdiq: "Yo'q" — so'rov yo'q
await page.click('[data-testid="bc-send"]');
await confirmDialog(page, false);
check("Tasdiqda 'Yo'q' → hech narsa yuborilmadi", (await mockGet("/__broadcasts")).length === 0);
await page.click('[data-testid="bc-send"]');
await confirmDialog(page, true);
await page.waitForSelector('[data-testid="bc-progress"]', { timeout: 8000 });
let bs = await mockGet("/__broadcasts");
check("Yuborildi: multipart text + rasm", bs.length === 1 && bs[0].caption.startsWith("Kuz chegirmalari") && bs[0].has_image && /^image\//.test(bs[0]._file?.type ?? ""), JSON.stringify(bs.map((b) => [b.caption?.slice(0, 20), b._file])));
// Jarayon → DONE
await page.waitForFunction(() => document.querySelector('[data-testid="bc-progress"]')?.dataset.status === "DONE", null, { timeout: 20000 });
const prog = await text('[data-testid="bc-progress"]');
check("Jarayon kuzatildi: 'Yuborildi 4/5', 'xato: 1', yakunlandi", prog.includes("4/5") && prog.includes("1") && prog.includes("Yakunlandi"), prog);
check("Forma tozalandi (keyingi reklama uchun)", (await page.inputValue('[data-testid="bc-text"]')) === "" && (await page.locator('[data-testid="bc-image-preview"]').count()) === 0);
await page.waitForFunction(() => document.querySelectorAll('[data-testid="bc-row"]').length === 1 && document.querySelector('[data-testid="bc-row"]')?.textContent.includes("4/5"), null, { timeout: 10000 });
const row = await text('[data-testid="bc-row"]');
check("Tarix: matn, rasm belgisi, 4/5, holat", row.includes("Kuz chegirmalari") && row.includes("4/5") && row.includes("Yakunlandi") && (await page.locator('[data-testid="bc-row"] [data-testid="bc-has-image"]').count()) === 1, row);
await page.screenshot({ path: OUT + "98b-admin-broadcast-done.png", fullPage: true });

// Faqat matn (2000 belgi — 4096 gacha ruxsat)
await page.fill('[data-testid="bc-text"]', "Uzun e'lon. ".repeat(160).trim());
check("Faqat matn 2000+ belgi: yuborish mumkin", !(await page.locator('[data-testid="bc-send"]').isDisabled()) && (await page.locator('[data-testid="bc-too-long"]').count()) === 0);
await page.click('[data-testid="bc-send"]');
await confirmDialog(page, true);
await page.waitForFunction(() => document.querySelectorAll('[data-testid="bc-row"]').length === 2, null, { timeout: 15000 });
bs = await mockGet("/__broadcasts");
check("Ikkinchi reklama: faqat matn (rasmsiz), tarixda 2 ta, eng yangisi tepada", bs.length === 2 && !bs[0].has_image && (await text('[data-testid="bc-row"] >> nth=0')).includes("Uzun e'lon"));

// Telefon
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
check("390px: gorizontal toshish yo'q", sw <= 1, `+${sw}`);

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
