// 44.4 — Admin "To'lovlar" (GET /admin/stats/payments): bo'sh holat; ko'rsatkichlar (jami tushum, tasdiqlangan,
// o'rtacha chek); holatlar; oylik tushum grafigi — ustun soni = oylar, hover va klaviatura fokusida maslahat (qiymat +
// oy + buyurtmalar), "Jadval" ko'rinishi; kitoblar jadvali; menyuda "To'lovlar"; telefonda toshish yo'q.
import { launch, BASE, API_HOST, reset, ignorablePageError, selectPick } from "../lib.mjs";
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
await fetch(`${API_HOST}/__seed-payments?months=7&mixed=1`);
const stats = await (await fetch(`${API_HOST}/api/v1/admin/stats/payments`, { headers: { Authorization: "Bearer access-token-admin" } })).json();
await page.reload();
await page.waitForSelector('[data-testid="revenue-chart"]', { timeout: 15000 });
const fmt = (n) => Math.round(n).toLocaleString("ru-RU").replace(/ /g, " ");
check("Ko'rsatkichlar serverdagidek (jami, tasdiqlangan, o'rtacha)", (await text('[data-testid="pay-total"]')).startsWith(fmt(stats.total_revenue)) && (await text('[data-testid="pay-approved"]')) === String(stats.approved_orders) && (await text('[data-testid="pay-average"]')).startsWith(fmt(stats.average_order_value)), `${await text('[data-testid="pay-total"]')} / ${fmt(stats.total_revenue)}`);
// 60: holatlar — donut: bo'lak har holatga (0 bo'lsa yo'q), markazda jami; hover/fokus — shu holat soni va ulushi
const st = stats.orders_by_status;
const all = Object.values(st).reduce((a, b) => a + b, 0);
const nonZero = Object.entries(st).filter(([, n]) => n > 0);
const center = () => text('[data-testid="donut-center"]');
check("Donut: bo'laklar = holatlar soni (0 lilari yo'q), legend ham", (await page.locator('[data-testid="donut-slice"]').count()) === nonZero.length && (await page.locator('[data-testid="donut-legend-row"]').count()) === nonZero.length, `${nonZero.length}`);
check("Markazda jami buyurtmalar", (await center()).startsWith(String(all)), await center());
const pct = Math.round((st.REJECTED / all) * 100);
const legendRej = await text('[data-testid="donut-legend-row"][data-status="REJECTED"]');
check("Legend: rang + nom + son + foiz ('Rad etilgan 2 12%')", legendRej.includes("Rad etilgan") && legendRej.includes(String(st.REJECTED)) && legendRej.includes(`${pct}%`), legendRej);
await page.locator('[data-testid="donut-slice"][data-status="REJECTED"]').hover();
await page.waitForFunction((n) => document.querySelector('[data-testid="donut-center"]')?.textContent?.startsWith(String(n)), st.REJECTED, { timeout: 3000 });
check("Bo'lak ustida: markazda shu holat soni va ulushi, boshqalar xira", (await center()).includes(`Rad etilgan · ${pct}%`) && (await page.locator(".donut-slice.dim").count()) === nonZero.length - 1, await center());
await page.mouse.move(5, 5);
await page.locator('[data-testid="donut-legend-row"][data-status="APPROVED"]').focus();
await page.waitForFunction((n) => document.querySelector('[data-testid="donut-center"]')?.textContent?.startsWith(String(n)), st.APPROVED, { timeout: 3000 });
check("Klaviatura (legend fokus) → bo'lak ajraldi, markazda soni", (await page.getAttribute('[data-testid="donut-slice"][data-status="APPROVED"]', "class"))?.includes("on"));
await page.locator('[data-testid="donut-legend-row"][data-status="APPROVED"]').blur();
const sliceFill = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="donut-slice"][data-status="APPROVED"]')).fill);
check("Rang: tasdiqlangan — #1f9d55 (yorug')", sliceFill === "rgb(31, 157, 85)", sliceFill);
await page.locator('[data-testid="status-donut"]').screenshot({ path: OUT + "94-status-donut.png" });

// 52: oylik tushum — chiziqli grafik
const chart = await page.evaluate(() => ({
  line: !!document.querySelector('[data-testid="revenue-chart"] path.rev-line'),
  area: !!document.querySelector('[data-testid="revenue-chart"] path.rev-area'),
  bars: document.querySelectorAll('[data-testid="revenue-chart"] .rev-bar').length,
  stroke: getComputedStyle(document.querySelector('[data-testid="revenue-chart"] path.rev-line')).strokeWidth,
}));
check("Grafik: chiziqli (2px chiziq + yengil to'ldirish, ustunlar yo'q)", chart.line && chart.area && chart.bars === 0 && chart.stroke === "2px", JSON.stringify(chart));
check("Grafik: nuqtalar soni = oylar soni (7)", (await page.locator('[data-testid="revenue-point"]').count()) === stats.revenue_by_month.length && stats.revenue_by_month.length === 7);
const lastM = stats.revenue_by_month.at(-1);
check("Oxirgi nuqta qiymati yozilgan (faqat u)", ((await text('[data-testid="revenue-end-label"]')) ?? "").length > 0 && (await page.locator('[data-testid="revenue-end-label"]').count()) === 1, `${await text('[data-testid="revenue-end-label"]')} ~ ${lastM.revenue}`);

// Hover → maslahat (qiymat + oy + buyurtmalar)
const m4 = stats.revenue_by_month[4];
await page.locator('[data-testid="revenue-point"]').nth(4).hover();
await page.waitForSelector('[data-testid="revenue-tip"]', { timeout: 3000 });
const tip = await text('[data-testid="revenue-tip"]');
check("Hover: maslahatda qiymat, oy (yil bilan) va buyurtmalar", tip.startsWith(fmt(m4.revenue)) && tip.includes("2026") && tip.includes(`${m4.orders} ta buyurtma`), tip);
check("Hover: vertikal chiziq va faol nuqta, oy yozuvi ajraldi", (await page.locator(".rev-cross").count()) === 1 && (await page.locator('[data-testid="revenue-active-dot"]').count()) === 1 && (await page.locator(".rev-x.on").count()) === 1);
await page.waitForTimeout(900); // chizilish animatsiyasi tugasin
await page.screenshot({ path: OUT + "82-admin-payments.png" });
await page.mouse.move(5, 5);

// Klaviatura: fokus → maslahat; ← → bilan oylar bo'ylab
await page.locator('[data-testid="revenue-point"]').first().focus();
await page.waitForSelector('[data-testid="revenue-tip"]', { timeout: 3000 });
check("Klaviatura fokusi: maslahat chiqadi, aria-label'da qiymat", ((await page.getAttribute('[data-testid="revenue-point"] >> nth=0', "aria-label")) ?? "").replace(/\s+/g, " ").includes(fmt(stats.revenue_by_month[0].revenue)));
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(150);
check("→ tugmasi: keyingi oy maslahati", (await text('[data-testid="revenue-tip"]')).startsWith(fmt(stats.revenue_by_month[1].revenue)), await text('[data-testid="revenue-tip"]'));

// Jadval ko'rinishi
await page.click('[data-testid="pay-toggle-table"]');
await page.waitForSelector('[data-testid="pay-month-table"]');
check("Jadval: 7 qator, eng yangi oy birinchi", (await page.locator('[data-testid="pay-month-table"] tbody tr').count()) === 7 && (await text('[data-testid="pay-month-table"] tbody tr:first-child')).includes("Okt 2026"));
check("Kitoblar jadvali: serverdagi kitoblar soni", (await page.locator('[data-testid="pay-book-table"] tbody tr').count()) === stats.revenue_by_book.length);

// ---- 64: davr (yil / oy / kun / soat) va oraliq — bitta filtr qatori, hamma narsaga ta'sir qiladi
// Brauzer yuborgan so'rovlar (mock logida query yo'q) — oxirgisi
const statReqs = [];
page.on("request", (r) => r.url().includes("/admin/stats/payments") && statReqs.push(r.url()));
const lastReq = async () => statReqs.at(-1) ?? "";
await page.click('[data-testid="pay-toggle-table"]'); // grafikka qaytish
await page.waitForSelector('[data-testid="revenue-chart"]');
check("Filtrlar qatori: 4 davr + oraliq", (await page.locator('[data-testid^="pay-g-"]').count()) === 4 && (await page.locator('[data-testid="pay-range"]').count()) === 1);
await page.click('[data-testid="pay-g-day"]');
await page.waitForFunction(() => document.querySelector(".card-title")?.parentElement && [...document.querySelectorAll(".card-title")].some((e) => e.textContent.includes("kunlar bo'yicha")), null, { timeout: 8000 });
await page.waitForFunction(() => document.querySelectorAll('[data-testid="revenue-point"]').length > 7, null, { timeout: 8000 });
const dayPts = await page.locator('[data-testid="revenue-point"]').count();
await page.waitForTimeout(900);
await page.locator('[data-testid="revenue-chart"]').screenshot({ path: OUT + "97-payments-days.png" });
check("Kun: so'rov group_by=day; bo'sh kunlar 0 bilan (nuqtalar > 7, ≤ 400)", (await lastReq()).includes("group_by=day") && dayPts > 7 && dayPts <= 400, `${dayPts}`);
await page.click('[data-testid="pay-toggle-table"]');
await page.waitForSelector('[data-testid="pay-month-table"]');
check("Kun jadvali: faqat to'lovli kunlar, to'liq sana ('15 okt 2026')", (await page.locator('[data-testid="pay-month-table"] tbody tr').count()) === 7 && (await text('[data-testid="pay-month-table"] tbody tr:first-child')).includes("15 okt 2026"));
await page.click('[data-testid="pay-toggle-table"]');
await page.click('[data-testid="pay-g-year"]');
await page.waitForFunction(() => document.querySelectorAll('[data-testid="revenue-point"]').length === 1, null, { timeout: 8000 });
check("Yil: bitta nuqta ('2026')", ((await text('[data-testid="revenue-end-label"]')) ?? "").length > 0 && (await lastReq()).includes("group_by=year"));
await page.click('[data-testid="pay-g-hour"]');
await page.waitForFunction(() => document.querySelectorAll('[data-testid="revenue-point"]').length === 7, null, { timeout: 8000 });
await page.locator('[data-testid="revenue-point"]').last().hover();
await page.waitForSelector('[data-testid="revenue-tip"]', { timeout: 3000 });
const hourTip = await text('[data-testid="revenue-tip"]');
check("Soat: UTC 00:00 → Toshkent '05:00' (maslahatda '15 okt, 05:00')", hourTip.includes("15 okt, 05:00"), hourTip);
await page.mouse.move(5, 5);
// Oraliq: "Oxirgi 7 kun" → date_from/date_to, davr — kun; kartalar shu oraliqdan
await selectPick(page, '[data-testid="pay-range"]', "7d");
await page.waitForFunction(() => !document.querySelector('[data-testid="pay-content"]')?.getAttribute("aria-busy")?.includes("true"), null, { timeout: 8000 });
await page.waitForTimeout(400);
const req7 = await lastReq();
const q7 = new URLSearchParams(req7.split("?")[1] ?? "");
const exp7 = await (await fetch(`${API_HOST}/api/v1/admin/stats/payments?${q7}`, { headers: { Authorization: "Bearer access-token-admin" } })).json();
check("Oxirgi 7 kun: date_from/date_to yuborildi, davr avtomatik 'Kun'", !!q7.get("date_from") && !!q7.get("date_to") && q7.get("group_by") === "day" && (await page.getAttribute('[data-testid="pay-g-day"]', "aria-pressed")) === "true", req7);
check("Kartalar oraliqqa bo'ysunadi (jami — serverdagidek)", (await text('[data-testid="pay-total"]')).startsWith(fmt(exp7.total_revenue)), `${await text('[data-testid="pay-total"]')} / ${exp7.total_revenue}`);
await page.screenshot({ path: OUT + "96-payments-filters.png" });
await selectPick(page, '[data-testid="pay-range"]', "all");
await page.click('[data-testid="pay-g-month"]');
await page.waitForFunction(() => document.querySelectorAll('[data-testid="revenue-point"]').length === 7, null, { timeout: 8000 });
await page.click('[data-testid="pay-toggle-table"]'); // keyingi bo'lim jadval holatidan boshlaydi
await page.waitForSelector('[data-testid="pay-month-table"]');

// Telefon + qorong'i
await page.setViewportSize({ width: 390, height: 844 });
await page.click('[data-testid="pay-toggle-table"]');
await page.waitForSelector('[data-testid="revenue-chart"]');
const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
check("390px: gorizontal toshish yo'q", sw <= 1, `+${sw}`);
await page.locator('[data-testid="revenue-point"]').nth(6).hover();
await page.waitForSelector('[data-testid="revenue-tip"]', { timeout: 3000 });
const tipBox = await page.evaluate(() => { const r = document.querySelector('[data-testid="revenue-tip"]').getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), w: innerWidth }; });
check("390px: oxirgi oy maslahati ekranga sig'adi", tipBox.l >= 0 && tipBox.r <= tipBox.w, JSON.stringify(tipBox));
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + "83-admin-payments-390.png", fullPage: true });
// Qorong'i mavzu
await page.setViewportSize({ width: 1280, height: 900 });
await page.evaluate(() => { document.documentElement.classList.add("dark"); });
await page.locator('[data-testid="revenue-point"]').nth(2).hover();
await page.waitForSelector('[data-testid="revenue-tip"]', { timeout: 3000 });
const darkLine = await page.evaluate(() => getComputedStyle(document.querySelector("path.rev-line")).stroke);
check("Qorong'i mavzu: chiziq rangi #b8890a", darkLine === "rgb(184, 137, 10)", darkLine);
const darkSlice = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="donut-slice"][data-status="APPROVED"]')).fill);
check("Qorong'i mavzu: donut — tasdiqlangan #21804a", darkSlice === "rgb(33, 128, 74)", darkSlice);
await page.locator('[data-testid="status-donut"]').screenshot({ path: OUT + "95-status-donut-dark.png" });
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + "84-admin-payments-dark.png" });

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
