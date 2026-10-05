// 44.4 — Admin "To'lovlar" (GET /admin/stats/payments): bo'sh holat; ko'rsatkichlar (jami tushum, tasdiqlangan,
// o'rtacha chek); holatlar; oylik tushum grafigi — ustun soni = oylar, hover va klaviatura fokusida maslahat (qiymat +
// oy + buyurtmalar), "Jadval" ko'rinishi; kitoblar jadvali; menyuda "To'lovlar"; telefonda toshish yo'q.
import { launch, BASE, API_HOST, reset, ignorablePageError } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-payments-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });
const text = (sel) => page.textContent(sel).then((s) => (s ?? "").replace(/\s+/g, " ").trim());

await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "admin@articles365.local");
await page.fill('input[type="password"]', "Admin12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });

// Bo'sh holat
await page.goto(`${BASE}/admin`);
await page.click('a[href="/admin/payments"]');
await page.waitForURL(`${BASE}/admin/payments`);
await page.waitForSelector('[data-testid="payments-page"]', { timeout: 15000 });
check("Menyu: 'To'lovlar' → /admin/payments", true);
check("Bo'sh holat: tushum 0, 'Hali tasdiqlangan to'lov yo'q'", (await text('[data-testid="pay-total"]')).startsWith("0") && (await page.locator("text=Hali tasdiqlangan to'lov yo'q").count()) > 0);

// Ma'lumot: 7 oy
await fetch(`${API_HOST}/__seed-payments?months=7`);
const stats = await (await fetch(`${API_HOST}/api/v1/admin/stats/payments`, { headers: { Authorization: "Bearer access-token-admin" } })).json();
await page.reload();
await page.waitForSelector('[data-testid="revenue-chart"]', { timeout: 15000 });
const fmt = (n) => Math.round(n).toLocaleString("ru-RU").replace(/ /g, " ");
check("Ko'rsatkichlar serverdagidek (jami, tasdiqlangan, o'rtacha)", (await text('[data-testid="pay-total"]')).startsWith(fmt(stats.total_revenue)) && (await text('[data-testid="pay-approved"]')) === String(stats.approved_orders) && (await text('[data-testid="pay-average"]')).startsWith(fmt(stats.average_order_value)), `${await text('[data-testid="pay-total"]')} / ${fmt(stats.total_revenue)}`);
check("Holatlar: Tasdiqlangan soni", (await text('[data-testid="pay-statuses"]')).includes(String(stats.orders_by_status.APPROVED)));
check("Grafik: ustunlar soni = oylar soni (7)", (await page.locator('[data-testid="revenue-col"]').count()) === stats.revenue_by_month.length && stats.revenue_by_month.length === 7);

// Hover → maslahat (qiymat + oy + buyurtmalar)
const m4 = stats.revenue_by_month[4];
await page.locator('[data-testid="revenue-col"]').nth(4).hover();
await page.waitForSelector('[data-testid="revenue-tip"]', { timeout: 3000 });
const tip = await text('[data-testid="revenue-tip"]');
check("Hover: maslahatda qiymat, oy (yil bilan) va buyurtmalar", tip.startsWith(fmt(m4.revenue)) && tip.includes("2026") && tip.includes(`${m4.orders} ta buyurtma`), tip);
await page.screenshot({ path: OUT + "82-admin-payments.png" });
await page.mouse.move(5, 5);

// Klaviatura: Tab bilan ustunga → maslahat
await page.locator('[data-testid="revenue-col"]').first().focus();
await page.waitForSelector('[data-testid="revenue-tip"]', { timeout: 3000 });
check("Klaviatura fokusi: maslahat chiqadi, aria-label'da qiymat", ((await page.getAttribute('[data-testid="revenue-col"] >> nth=0', "aria-label")) ?? "").replace(/\s+/g, " ").includes(fmt(stats.revenue_by_month[0].revenue)));

// Jadval ko'rinishi
await page.click('[data-testid="pay-toggle-table"]');
await page.waitForSelector('[data-testid="pay-month-table"]');
check("Jadval: 7 qator, eng yangi oy birinchi", (await page.locator('[data-testid="pay-month-table"] tbody tr').count()) === 7 && (await text('[data-testid="pay-month-table"] tbody tr:first-child')).includes("Okt 2026"));
check("Kitoblar jadvali: serverdagi kitoblar soni", (await page.locator('[data-testid="pay-book-table"] tbody tr').count()) === stats.revenue_by_book.length);

// Telefon + qorong'i
await page.setViewportSize({ width: 390, height: 844 });
await page.click('[data-testid="pay-toggle-table"]');
await page.waitForSelector('[data-testid="revenue-chart"]');
const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
check("390px: gorizontal toshish yo'q", sw <= 1, `+${sw}`);

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
