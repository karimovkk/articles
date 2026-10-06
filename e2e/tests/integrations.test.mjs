// 57 — Admin "Integratsiya" (GET/PUT /admin/integration-settings): manba belgilari (server / admin / o'rnatilmagan);
// maxfiy kalit (bot token) hech qachon ko'rsatilmaydi — faqat "••••abcd", "O'zgartirish" → parol maydoni; faqat
// o'zgargan kalitlar yuboriladi; "Tozalash" → "" (server qiymatiga qaytadi); token o'zgarsa — "Webhook'ni yangilash"
// (POST …/telegram/set-webhook); menyuda "Integratsiya"; telefonda toshish yo'q.
import { launch, BASE, reset, mockGet, ignorablePageError } from "../lib.mjs";
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
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-integrations-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });
const text = (sel) => page.textContent(sel).then((s) => (s ?? "").replace(/\s+/g, " ").trim());
const src = (key) => text(`[data-testid="int-${key.replace(/\W/g, "-")}-source"]`);
const tid = (key, suffix = "") => `[data-testid="int-${key.replace(/\W/g, "-")}${suffix}"]`;

await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "admin@articles365.local");
await page.fill('input[type="password"]', "Admin12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
await page.goto(`${BASE}/admin`);
await page.click('a[href="/admin/integrations"]');
await page.waitForSelector('[data-testid="integrations-page"]', { timeout: 15000 });
check("Menyu: 'Integratsiya' → /admin/integrations", page.url().endsWith("/admin/integrations"));

// Boshlang'ich holat: server (env) qiymatlari, maxfiy token niqoblangan
check("8 ta kalit: Telegram (5) + To'lov (3)", (await page.locator('[data-testid="int-row"]').count()) === 8);
check("Manba: bot username — 'Server (env)', guruh — 'O'rnatilmagan'", (await src("telegram.bot_username")) === "Server (env)" && (await src("telegram.order_group_id")) === "O'rnatilmagan");
const html = await page.content();
check("Bot token: faqat '••••abcd', to'liq qiymat sahifada yo'q", (await text(tid("telegram.bot_token", "-preview"))) === "••••abcd" && !html.includes("ENVTOKEN"));
check("Saqlash o'chiq (o'zgarish yo'q)", await page.locator('[data-testid="integrations-save"]').isDisabled());

// Oddiy kalit: guruh ID
await page.fill(tid("telegram.order_group_id"), "-1001234567890");
check("O'zgarish soni tugmada: 'Saqlash (1)'", (await text('[data-testid="integrations-save"]')) === "Saqlash (1)");
// Maxfiy: "O'zgartirish" → parol maydoni
await page.click(tid("telegram.bot_token", "-edit"));
check("Token: 'O'zgartirish' → parol maydoni (bo'sh)", (await page.getAttribute(tid("telegram.bot_token"), "type")) === "password" && (await page.inputValue(tid("telegram.bot_token"))) === "");
await page.fill(tid("telegram.bot_token"), "987654:NEWTOKENwxyz");
await page.screenshot({ path: OUT + "90-admin-integrations.png", fullPage: true });
await page.click('[data-testid="integrations-save"]');
await page.waitForSelector("text=Saqlandi — o'zgarish darhol kuchga kirdi", { timeout: 5000 });
let st = await mockGet("/__integrations");
check("PUT: faqat o'zgargan 2 kalit (guruh + token)", JSON.stringify(Object.keys(st.log[0]).sort()) === JSON.stringify(["telegram.bot_token", "telegram.order_group_id"]) && st.log[0]["telegram.order_group_id"] === "-1001234567890", JSON.stringify(st.log[0]));
check("Saqlangach: guruh — 'Admin sozlamasi', token — '••••wxyz'", (await src("telegram.order_group_id")) === "Admin sozlamasi" && (await text(tid("telegram.bot_token", "-preview"))) === "••••wxyz");

// Token o'zgardi → webhook'ni yangilash taklifi
check("Token o'zgargach: 'webhook'ni yangilang' ogohlantirishi", (await text('[data-testid="webhook-block"]')).includes("Bot token o'zgardi"));
await page.click('[data-testid="set-webhook"]');
await page.waitForSelector("text=Webhook ulandi", { timeout: 5000 });
st = await mockGet("/__integrations");
check("POST …/telegram/set-webhook → 'Webhook ulandi: <url>'", st.webhookCalls === 1 && (await text('[data-testid="webhook-block"]')).includes("/telegram/webhook"));

// Tozalash → "" (server qiymatiga qaytadi)
await page.click(tid("telegram.order_group_id", "-clear"));
check("Tozalash: 'admin qiymati o'chadi' izohi", (await page.locator(tid("telegram.order_group_id", "-cleared")).count()) === 1);
await page.click('[data-testid="integrations-save"]');
await page.waitForFunction(() => document.querySelector('[data-testid="int-telegram-order_group_id-source"]')?.textContent === "O'rnatilmagan", null, { timeout: 5000 });
st = await mockGet("/__integrations");
check("PUT: { telegram.order_group_id: \"\" } → 'O'rnatilmagan'", JSON.stringify(st.log.at(-1)) === JSON.stringify({ "telegram.order_group_id": "" }), JSON.stringify(st.log.at(-1)));

// Karta: qiymatni o'zgartirib, yana asliga qaytarsa — o'zgarish hisoblanmaydi
await page.fill(tid("payment.card_number"), "8600999988887777");
await page.fill(tid("payment.card_number"), "8600123412345678");
check("Asl qiymatga qaytdi → o'zgarish yo'q (saqlash o'chiq)", await page.locator('[data-testid="integrations-save"]').isDisabled());

// Telefon
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
check("390px: gorizontal toshish yo'q", sw <= 1, `+${sw}`);
await page.screenshot({ path: OUT + "91-admin-integrations-390.png", fullPage: true });

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
