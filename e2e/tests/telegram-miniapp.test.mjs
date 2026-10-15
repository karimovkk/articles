// 106/110: Telegram Mini App — Telegram ichida (soxta `window.Telegram.WebApp`): mehmon sifatida katalog, sotib olishda
// kirish saytdagidek (telefon + parol; parolsiz `initData` kirish va telefon ulashish YO'Q), "Saytda ochish"
// (MainButton → handoff → openLink), to'lov havolasi Telegram'da (openTelegramLink);
// sayt: /auth/handoff?token= → kirgan holda, token bir martalik; oddiy brauzerda SDK yuklanmaydi; frame-ancestors.
import { launch, BASE, reset, mockGet, ignorablePageError, makeCheck } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
const BOOK2 = "33333333-3333-4333-8333-333333333333";
const { check, done } = makeCheck();
await reset("");
const browser = await launch();
const errors = [];
const INIT = `query_id=AAH1&user=${encodeURIComponent(JSON.stringify({ id: 777, first_name: "Ali", last_name: "Valiyev" }))}&auth_date=1760000000&hash=good`;
const tgLog = async () => (await mockGet("/__log")).filter((l) => l.startsWith("POST /auth/telegram/"));

/** Telegram WebApp soxta obyekti (SDK o'rniga) */
async function miniApp(initData) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36" });
  let sdkRequests = 0;
  await ctx.route("https://telegram.org/**", (r) => { sdkRequests++; return r.abort(); });
  await ctx.addInitScript((initData) => {
    const calls = (window.__tg = { ready: 0, expand: 0, close: 0, links: [], tgLinks: [], main: { text: "", visible: false, handlers: [] } });
    window.Telegram = {
      WebApp: {
        initData, platform: "android", version: "8.0",
        ready: () => calls.ready++, expand: () => calls.expand++, close: () => calls.close++,
        openLink: (u) => calls.links.push(u), openTelegramLink: (u) => calls.tgLinks.push(u),
        MainButton: {
          setText: (t) => (calls.main.text = t), show: () => (calls.main.visible = true), hide: () => (calls.main.visible = false),
          onClick: (h) => calls.main.handlers.push(h), offClick: (h) => (calls.main.handlers = calls.main.handlers.filter((x) => x !== h)),
          showProgress: () => {}, hideProgress: () => {},
        },
      },
    };
  }, initData);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
  return { ctx, page, sdk: () => sdkRequests };
}

// ---- 1) Mini App: /tg → katalog MEHMON sifatida (avtomatik kirish yo'q)
const { ctx, page } = await miniApp(INIT);
await page.goto(`${BASE}/tg#tgWebAppData=${encodeURIComponent(INIT)}&tgWebAppVersion=8.0`);
await page.waitForURL(`${BASE}/catalog`, { timeout: 30000 });
await page.waitForFunction(() => window.__tg.ready > 0 && window.__tg.expand > 0, null, { timeout: 10000 });
const st = await page.evaluate(() => ({ access: localStorage.getItem("a365.access"), main: window.__tg.main.visible }));
check("110: /tg → katalog mehmon sifatida: ready()/expand(), token yo'q, Telegram kirish so'rovi yo'q", !st.access && (await tgLog()).length === 0, JSON.stringify(st));
check("110: mehmonda MainButton 'Saytda ochish' ko'rinmaydi, telefon taklifi yo'q", !st.main && (await page.locator('[data-testid="tg-phone"]').count()) === 0);

// ---- 2) Sotib olish → saytdagidek kirish (telefon + parol) → kitobga qaytish
await page.goto(`${BASE}/catalog/${BOOK2}`);
await page.click('a:has-text("Sotib olish uchun tizimga kiring")');
await page.waitForURL((u) => u.pathname === "/login", { timeout: 15000 });
const loginReq = page.waitForRequest((r) => r.url().endsWith("/auth/login") && r.method() === "POST");
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
const loginBody = JSON.parse((await loginReq).postData() ?? "{}");
await page.waitForURL(`${BASE}/catalog/${BOOK2}`, { timeout: 15000 });
check("110: Mini App'da kirish — oddiy POST /auth/login, device_name 'Telegram · Android'", loginBody.device_name === "Telegram · Android", loginBody.device_name);

// ---- 3) MainButton "Saytda ochish" → handoff → openLink (faqat kirgandan keyin)
await page.waitForFunction(() => window.__tg.main.visible && window.__tg.main.handlers.length > 0, null, { timeout: 10000 });
check("MainButton: 'Saytda ochish' ko'rinadi", (await page.evaluate(() => window.__tg.main.text)) === "Saytda ochish");
await page.evaluate(() => window.__tg.main.handlers.at(-1)());
await page.waitForFunction(() => window.__tg.links.length > 0, null, { timeout: 10000 });
const handoffUrl = await page.evaluate(() => window.__tg.links[0]);
check("Bosildi → POST /auth/telegram/handoff, openLink(/auth/handoff?token=…)", /\/auth\/handoff\?token=ho-/.test(handoffUrl) && (await tgLog()).includes("POST /auth/telegram/handoff"), handoffUrl);

// ---- 4) Boshqa sahifa (hash'siz) — Telegram ichida deb taniladi, kirgan holat saqlanadi
await page.goto(`${BASE}/daily`);
await page.waitForFunction(() => window.__tg.main.visible, null, { timeout: 10000 });
check("Boshqa sahifada ham Mini App rejimi (MainButton)", true);

// ---- 5) Buyurtma → bot havolasi Telegram'ning o'zida (openTelegramLink), yangi oyna yo'q
await page.goto(`${BASE}/catalog/${BOOK2}`);
await page.waitForSelector("text=Buyurtma berish", { timeout: 20000 });
const pages0 = ctx.pages().length;
await page.click("text=Buyurtma berish");
await page.waitForFunction(() => window.__tg.tgLinks.length > 0, null, { timeout: 10000 });
check("Buyurtma → openTelegramLink(t.me/…start=…), yangi oyna ochilmadi", (await page.evaluate(() => window.__tg.tgLinks[0])).startsWith("https://t.me/articles365_test_bot?start=") && ctx.pages().length === pages0);
await page.screenshot({ path: OUT + "106b-tg-order.png" });
// 109: Mini App yopiladi — bot chati (to'lov) ko'rinadi
await page.waitForFunction(() => window.__tg.close > 0, null, { timeout: 5000 }).catch(() => undefined);
check("109: havoladan keyin Mini App yopildi (close()) — to'lov bot chatida ko'rinadi", (await page.evaluate(() => window.__tg.close)) === 1);
check("110: Telegram'da hech qachon parolsiz kirish so'ralmadi", !(await tgLog()).includes("POST /auth/telegram/webapp"));

// ---- 6) Sayt (oddiy brauzer): handoff → kirgan holda, token manzildan olib tashlandi
const site = await browser.newContext({ viewport: { width: 1280, height: 800 } });
let siteSdk = 0;
await site.route("https://telegram.org/**", (r) => { siteSdk++; return r.abort(); });
const sp = await site.newPage();
sp.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
const url = handoffUrl.replace(/^https?:\/\/[^/]+/, BASE);
await sp.goto(url);
await sp.waitForURL(`${BASE}/library`, { timeout: 30000 });
const sAccess = await sp.evaluate(() => localStorage.getItem("a365.access"));
check("Sayt: handoff almashtirildi → kutubxona, kirgan holda (shu akkaunt)", (sAccess ?? "").startsWith("access-token-ho-") && (await tgLog()).includes("POST /auth/telegram/handoff/exchange"), sAccess);
check("Oddiy brauzerda Telegram SDK yuklanmadi, Mini App paneli yo'q", siteSdk === 0 && (await sp.locator('[data-testid="tg-dock"]').count()) === 0);
// Bir martalik
const sp2 = await (await browser.newContext()).newPage();
await sp2.goto(url);
await sp2.waitForSelector("text=Havola eskirgan yoki ishlatilgan", { timeout: 15000 });
check("Token bir martalik: qayta ochilsa — 'Havola eskirgan…' + kirish havolasi; manzilda token yo'q", (await sp2.locator('a[href="/login"]').count()) > 0 && !sp2.url().includes("token="));
await sp2.screenshot({ path: OUT + "106c-handoff-expired.png" });

// ---- 7) /tg oddiy brauzerda
await sp.goto(`${BASE}/tg`);
await sp.waitForSelector("text=Bu sahifa Telegram uchun", { timeout: 15000 });
check("/tg oddiy brauzerda — 'Telegram ichida oching' + katalog havolasi", (await sp.locator('[data-testid="tg-entry"] a[href="/catalog"]').count()) === 1);

// ---- 8) Telegram Web iframe'da ocha oladi (frame-ancestors), admin — yo'q
const h1 = await fetch(`${BASE}/catalog`).then((r) => r.headers);
const h2 = await fetch(`${BASE}/admin`, { redirect: "manual" }).then((r) => r.headers);
check("Sahifalar: frame-ancestors web.telegram.org, X-Frame-Options yo'q", (h1.get("content-security-policy") ?? "").includes("frame-ancestors 'self' https://web.telegram.org") && !h1.get("x-frame-options"), `${h1.get("content-security-policy")} / ${h1.get("x-frame-options")}`);
check("Admin: X-Frame-Options DENY, frame-ancestors 'none'", h2.get("x-frame-options") === "DENY" && (h2.get("content-security-policy") ?? "").includes("frame-ancestors 'none'"), `${h2.get("content-security-policy")} / ${h2.get("x-frame-options")}`);

check("Sahifa xatolari yo'q", errors.length === 0, errors.join(" | ").slice(0, 300));
await done(browser);
