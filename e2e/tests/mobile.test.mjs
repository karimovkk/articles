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
await page.waitForFunction(() => document.querySelectorAll(".reader-page").length === 1, null, { timeout: 5000 });
await page.waitForTimeout(600);
const fits = await page.evaluate(() => { const r = document.querySelector(".reader-page").getBoundingClientRect(); return r.width <= 360 && r.height <= 740; });
console.log(fits ? "✅ 360px varaqlash: sahifa sig'adi" : "❌ 360px varaqlash: sahifa sig'maydi");
// swipe chapga → keyingi sahifa
const before = await page.$eval(".reader-page", (e) => e.dataset.page);
await page.touchscreen.tap(180, 400); // fokus
await page.evaluate(() => {
  const el = document.querySelector(".reader-page").closest(".relative.h-full");
  const t = (type, x) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === "touchend" ? [] : [new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 })], changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 })] }));
  t("touchstart", 300); t("touchend", 100);
});
await page.waitForTimeout(400);
const after = await page.$eval(".reader-page", (e) => e.dataset.page);
console.log(Number(after) === Number(before) + 1 ? `✅ Swipe chapga → keyingi sahifa (${before}→${after})` : `❌ Swipe ishlamadi (${before}→${after})`);
await page.screenshot({ path: OUT + "08-mobile-night-page.png" });
await browser.close();
