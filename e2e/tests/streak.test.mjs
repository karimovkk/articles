// 44.6 / 59 — Kunlik o'qish seriyasi (streak) va reyting: header'da 🔥 N (bugun o'qilmagan bo'lsa — xira); reader'da sahifa
// almashsa (progress) seriya "bugun" bo'ladi va chip darhol yangilanadi; "Reyting" sahifasi — o'z ko'rsatkichlarim,
// top-20, o'zim topda bo'lmasam alohida qatorda; menyuda "Reyting"; telefonda toshish yo'q.
import { launch, BASE, API_HOST, reset, mockGet, ignorablePageError } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const USER_ID = "u1u1u1u1-u1u1-4u1u-8u1u-u1u1u1u1u1u1";
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-streak-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });
const chip = async () => ({ n: ((await page.textContent('[data-testid="streak-chip"]')) ?? "").trim(), active: await page.getAttribute('[data-testid="streak-chip"]', "data-active") });

// Kechagacha 4 kunlik seriya, bugun hali o'qilmagan
await fetch(`${API_HOST}/__seed-streak?user=${USER_ID}&current=4&longest=9&total=20`);
await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
await page.waitForSelector('[data-testid="streak-chip"]', { timeout: 10000 });
let c = await chip();
check("Header: 🔥 4, bugun o'qilmagan — xira", c.n === "4" && c.active === "0", JSON.stringify(c));
check("Menyuda 'Reyting'", (await page.locator('.client-sidebar a[href="/leaderboard"]').count()) === 1);

// O'qish → seriya bugun (5), chip darhol yangilanadi
await page.goto(`${BASE}/reader/${ART}`);
await page.waitForFunction(() => document.querySelector('[data-page="1"] canvas')?.width > 0, null, { timeout: 30000 });
await page.fill('input[aria-label="Sahifa"]', "3");
await page.press('input[aria-label="Sahifa"]', "Enter");
await page.waitForTimeout(2500); // progress debounce
check("Progress saqlandi → serverda seriya bugun (5)", (await mockGet("/__streaks"))[USER_ID]?.current === 5);
await page.goto(`${BASE}/library`);
await page.waitForSelector('[data-testid="streak-chip"][data-active="1"]', { timeout: 10000 });
c = await chip();
check("Header: 🔥 5, faol (bugun o'qildi)", c.n === "5" && c.active === "1", JSON.stringify(c));

// Reyting: 25 ta boshqa o'quvchi → men topda emasman, alohida qatorda
await fetch(`${API_HOST}/__seed-streak?leaders=25`);
await page.click('[data-testid="streak-chip"]');
await page.waitForURL(`${BASE}/leaderboard`);
await page.waitForSelector('[data-testid="leaderboard"]', { timeout: 10000 });
const my = ((await page.textContent('[data-testid="my-streak"]')) ?? "").replace(/\s+/g, " ");
check("O'z ko'rsatkichlarim: 5 kun, eng uzun 9, jami 21, 'Bugun o'qidingiz'", my.includes("5 kun") && my.includes("9 kun") && my.includes("21 kun") && my.includes("Bugun o'qidingiz"), my);
check("Top-20 + o'zim alohida qatorda (26-o'rin)", (await page.locator('[data-testid="lb-row"]').count()) === 20 && ((await page.textContent('[data-testid="lb-me"]')) ?? "").includes("26"));
check("1-o'rin ajratilgan, olov bilan joriy seriya", (await page.locator(".lb-rank.top1").count()) === 1 && ((await page.textContent('[data-testid="lb-row"] >> nth=0')) ?? "").includes("40"));
await page.screenshot({ path: OUT + "85-leaderboard.png", fullPage: true });

await page.setViewportSize({ width: 360, height: 760 });
await page.waitForTimeout(300);
const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
check("360px: reyting sig'adi", sw <= 1, `+${sw}`);
await page.screenshot({ path: OUT + "86-leaderboard-360.png", fullPage: true });

// 59: telefonda olovcha header'da ko'rinadi (avval ≤ 700 px da yashirilgan edi); eng og'ir holat — 3 xonali seriya
await fetch(`${API_HOST}/__seed-streak?user=${USER_ID}&current=123&longest=123&total=130`);
for (const w of [320, 360, 390, 430]) {
  await page.setViewportSize({ width: w, height: 760 });
  await page.goto(`${BASE}/catalog`);
  await page.waitForFunction(() => document.querySelector('[data-testid="streak-chip"]')?.textContent?.includes("123"), null, { timeout: 10000 });
  const g = await page.evaluate(() => {
    const vis = (el) => el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
    const chipEl = document.querySelector('[data-testid="streak-chip"]');
    const c = chipEl.getBoundingClientRect();
    const brand = document.querySelector('[data-testid="header-brand"]').getBoundingClientRect();
    const actions = [...document.querySelector(".client-actions").children].filter(vis).map((e) => e.getBoundingClientRect());
    return { chipVisible: vis(chipEl) && c.left >= 0 && c.right <= innerWidth, gap: Math.round(Math.min(...actions.map((r) => r.left)) - brand.right), sw: document.documentElement.scrollWidth - innerWidth };
  });
  // gap — logo va birinchi tugma orasi (header grid oralig'i 6 px — kamida shuncha)
  check(`${w}px: header'da olovcha (123) ko'rinadi, logo bilan ustma-ust emas, toshish yo'q`, g.chipVisible && g.gap >= 6 && g.sw <= 1, JSON.stringify(g));
}
await page.screenshot({ path: OUT + "87-streak-header-320.png", clip: { x: 0, y: 0, width: 430, height: 70 } });

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
