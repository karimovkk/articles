// Task 7.6 — bildirishnomalar: qo'ng'iroq soni, ro'yxat, o'qildi, barchasini o'qildi, turga qarab havola
import { launch, BASE, API, reset } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const BOOK2 = "33333333-3333-4333-8333-333333333333";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");
const ah = { Authorization: "Bearer access-token-admin", "Content-Type": "application/json" };
// 2 ta bildirishnoma: umumiy + ruxsat berildi (admin grant)
await fetch(`${API.replace("/api/v1", "")}/__notify?title=Salom&body=Tizim%20xabari`);
await fetch(`${API}/admin/book-access`, { method: "POST", headers: ah, body: JSON.stringify({ user_id: "u1u1u1u1-u1u1-4u1u-8u1u-u1u1u1u1u1u1", book_id: BOOK2 }) });

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-notif-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });
const bodyHas = async (text) => page.evaluate((t) => document.body.innerText.includes(t), text);

await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);
await page.waitForSelector('[data-testid="unread-count"]', { timeout: 10000 });
check("Header qo'ng'irog'i: o'qilmagan soni 2", (await page.textContent('[data-testid="unread-count"]')) === "2");

await page.click('a[href="/notifications"]');
await page.waitForSelector("text=Kitobga ruxsat berildi", { timeout: 10000 });
check("Ro'yxat: 2 ta, ikkalasi o'qilmagan (bold), tur yorlig'i", (await page.locator("[data-unread]").count()) === 2 && (await bodyHas("Ruxsat berildi")) && (await bodyHas("Tizim xabari")));
check("ACCESS_GRANTED → kitob sahifasi havolasi", (await page.locator(`a[href="/books/${BOOK2}"]`).count()) === 1);
await page.screenshot({ path: OUT + "90-notifications.png" });

// bittasini ochish → o'qildi + havolaga o'tish
await page.click("text=Kitobga ruxsat berildi");
await page.waitForURL(`${BASE}/books/${BOOK2}`, { timeout: 10000 });
await page.waitForFunction(() => document.querySelector('[data-testid="unread-count"]')?.textContent === "1", null, { timeout: 8000 });
check("Bildirishnoma ochildi → o'qildi (soni 1) va kitob sahifasiga o'tdi", true);

// faqat o'qilmaganlar filtri + barchasini o'qildi
await page.goto(`${BASE}/notifications`);
await page.waitForSelector("text=Salom", { timeout: 10000 });
await page.click('[data-testid="unread-only"]');
await page.waitForFunction(() => document.querySelectorAll("[data-unread]").length === 1 && !document.body.innerText.includes("Kitobga ruxsat berildi"), null, { timeout: 8000 });
check("Faqat o'qilmaganlar filtri (unread_only)", true);
await page.click("text=Barchasini o'qildi deb belgilash");
await page.waitForFunction(() => !document.querySelector('[data-testid="unread-count"]'), null, { timeout: 8000 });
check("Barchasini o'qildi → qo'ng'iroq badge yo'qoldi", true);

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
