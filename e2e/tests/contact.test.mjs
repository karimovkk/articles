// 113: bog'lanish — o'ng pastki burchakda Telegram tugmasi → karta (@I365_admin, nusxa olish, "Telegram'da yozish" →
// https://t.me/I365_admin yangi oynada); Escape / tashqariga bosish — yopiladi; telefon kengligida sig'adi; qorong'i
// mavzu; login sahifasida yo'q; Telegram Mini App'da — openTelegramLink + close().
import { launch, BASE, reset, ignorablePageError, makeCheck } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
const { check, done } = makeCheck();
await reset("");
const browser = await launch();
const errors = [];
const stubTme = (ctx) => ctx.route(/^https:\/\/t\.me\//, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>ok</title>" }));
const watch = (page) => page.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));

// ---- 1) Kompyuter
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, permissions: ["clipboard-read", "clipboard-write"] });
  await stubTme(ctx);
  const page = await ctx.newPage();
  watch(page);
  await page.goto(`${BASE}/catalog`);
  await page.waitForSelector('[data-testid="contact-fab"]', { timeout: 30000 });
  const fab = await page.locator('[data-testid="contact-fab"]').boundingBox();
  check("Tugma o'ng pastki burchakda", fab && fab.x + fab.width > 1366 - 40 && fab.y + fab.height > 860 - 40, JSON.stringify(fab));
  check("Karta yopiq", !(await page.locator('[data-testid="contact-card"]').isVisible()));

  await page.click('[data-testid="contact-fab"]');
  await page.waitForSelector('[data-testid="contact-card"]', { state: "visible" });
  const href = await page.getAttribute('[data-testid="contact-write"]', "href");
  check("Karta: '@I365_admin', 'Telegram'da yozish' → https://t.me/I365_admin (yangi oyna)", (await page.textContent('[data-testid="contact-handle"]'))?.trim() === "@I365_admin" && href === "https://t.me/I365_admin" && (await page.getAttribute('[data-testid="contact-write"]', "target")) === "_blank");
  check("Ochilganda fokus 'Telegram'da yozish' da, aria-expanded=true", (await page.evaluate(() => document.activeElement?.dataset.testid)) === "contact-write" && (await page.getAttribute('[data-testid="contact-fab"]', "aria-expanded")) === "true");
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + "113-contact-desktop.png" });

  await page.click('[data-testid="contact-copy"]');
  await page.waitForSelector('[data-testid="contact-copy"]:has-text("Nusxalandi")', { timeout: 3000 });
  check("Nusxa olish → buferda '@I365_admin'", (await page.evaluate(() => navigator.clipboard.readText())) === "@I365_admin");

  const [popup] = await Promise.all([page.waitForEvent("popup"), page.click('[data-testid="contact-write"]')]);
  await popup.waitForLoadState().catch(() => undefined);
  check("Yozish → yangi oynada t.me/I365_admin", popup.url() === "https://t.me/I365_admin", popup.url());
  await popup.close();

  await page.keyboard.press("Escape");
  await page.waitForSelector('[data-testid="contact-card"]', { state: "hidden", timeout: 3000 });
  check("Escape — yopildi", true);
  await page.click('[data-testid="contact-fab"]');
  await page.waitForSelector('[data-testid="contact-card"]', { state: "visible" });
  await page.mouse.click(500, 300);
  await page.waitForSelector('[data-testid="contact-card"]', { state: "hidden", timeout: 3000 });
  check("Tashqariga bosish — yopildi", true);

  await page.goto(`${BASE}/login`);
  await page.waitForSelector("form", { timeout: 20000 });
  check("Login sahifasida bog'lanish tugmasi yo'q", (await page.locator('[data-testid="contact-fab"]').count()) === 0);
  await ctx.close();
}

// ---- 2) Telefon + qorong'i mavzu
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => localStorage.setItem("a365.theme", "dark"));
  const page = await ctx.newPage();
  watch(page);
  await page.goto(`${BASE}/catalog`);
  await page.waitForSelector('[data-testid="contact-fab"]', { timeout: 30000 });
  await page.tap('[data-testid="contact-fab"]');
  await page.waitForSelector('[data-testid="contact-card"]', { state: "visible" });
  await page.waitForTimeout(300);
  const box = await page.locator('[data-testid="contact-card"]').boundingBox();
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  check("Telefon: karta ekranga sig'adi, gorizontal scroll yo'q", box && box.x >= 8 && box.x + box.width <= 390 - 8 && box.y >= 0 && scrollW <= 390, `${JSON.stringify(box)} sw=${scrollW}`);
  await page.screenshot({ path: OUT + "113-contact-phone-dark.png" });
  await ctx.close();
}

// ---- 3) Telegram Mini App — chat Telegram'ning o'zida, Mini App yopiladi
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.route("https://telegram.org/**", (r) => r.abort());
  await ctx.addInitScript(() => {
    const calls = (window.__tg = { tgLinks: [], close: 0 });
    window.Telegram = {
      WebApp: {
        initData: "query_id=x&user=%7B%22id%22%3A778%7D&auth_date=1760000000&hash=good",
        ready() {}, expand() {}, close: () => calls.close++, openLink() {}, openTelegramLink: (u) => calls.tgLinks.push(u),
        MainButton: { setText() {}, show() {}, hide() {}, onClick() {}, offClick() {} },
      },
    };
  });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(`${BASE}/catalog`);
  await page.waitForSelector('[data-testid="contact-fab"]', { timeout: 30000 });
  await page.tap('[data-testid="contact-fab"]');
  await page.tap('[data-testid="contact-write"]');
  await page.waitForFunction(() => window.__tg.close > 0, null, { timeout: 5000 }).catch(() => undefined);
  const tg = await page.evaluate(() => window.__tg);
  check("Mini App: openTelegramLink(t.me/I365_admin) + close(), yangi oyna yo'q", tg.tgLinks[0] === "https://t.me/I365_admin" && tg.close === 1 && ctx.pages().length === 1, JSON.stringify(tg));
  await ctx.close();
}

check("Sahifa xatolari yo'q", errors.length === 0, errors.join(" | ").slice(0, 300));
await done(browser);
