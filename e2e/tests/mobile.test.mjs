import { launch, BASE } from "../lib.mjs";
import { IS_CHROMIUM } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, ...(IS_CHROMIUM ? { isMobile: true } : {}) });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);
await page.goto(`${BASE}/reader/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`);
await page.waitForFunction(() => document.querySelector(".reader-page canvas")?.width > 0, null, { timeout: 20000 });
await page.waitForTimeout(500);
const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
console.log(noHScroll ? "✅ 360px: gorizontal scroll yo'q" : "❌ 360px: gorizontal scroll bor");
await page.screenshot({ path: OUT + "07-mobile-scroll.png" });
// tungi rejim + varaqlash
await page.click('button[title="Tungi rejim"]');
await page.click('button[aria-label="O\'qish rejimi"]');
await page.waitForFunction(() => document.querySelector('[data-testid="flip-stage"]') && [...document.querySelectorAll(".flip-leaf")].filter((l) => getComputedStyle(l).visibility === "visible").length === 1, null, { timeout: 5000 });
await page.waitForTimeout(600);
const fits = await page.evaluate(() => { const r = [...document.querySelectorAll(".flip-leaf")].find((l) => getComputedStyle(l).visibility === "visible").getBoundingClientRect(); return r.width <= 360 && r.height <= 740; });
console.log(fits ? "✅ 360px varaqlash: sahifa sig'adi" : "❌ 360px varaqlash: sahifa sig'maydi");
// swipe chapga → keyingi sahifa
// Ko'rinadigan (joriy) varaq — FlipStage qo'shni sahifalarni yashirin holda oldindan render qiladi
const visiblePage = () => page.evaluate(() => [...document.querySelectorAll(".flip-leaf")].find((l) => getComputedStyle(l).visibility === "visible")?.dataset.leaf);
const before = await visiblePage();
await page.touchscreen.tap(180, 400); // fokus
// Sensor swipe: pointer hodisalari (pointerType=touch) — FlipStage sudrashni shu orqali boshqaradi
await page.evaluate(async () => {
  const el = document.querySelector('[data-testid="flip-stage"]');
  const ev = (type, x) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: x, clientY: 400, button: type === "pointerdown" ? 0 : -1, buttons: type === "pointerup" ? 0 : 1 }));
  ev("pointerdown", 300);
  for (let x = 290; x >= 80; x -= 30) { ev("pointermove", x); await new Promise((r) => setTimeout(r, 16)); }
  ev("pointerup", 80);
});
await page.waitForFunction(() => !document.querySelector('[data-testid="flip-stage"]').dataset.flipping, null, { timeout: 4000 });
const after = await visiblePage();
console.log(Number(after) === Number(before) + 1 ? `✅ Swipe chapga → keyingi sahifa (varaq animatsiyasi bilan, ${before}→${after})` : `❌ Swipe ishlamadi (${before}→${after})`);
await page.screenshot({ path: OUT + "08-mobile-night-page.png" });
await browser.close();
