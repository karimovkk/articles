// 106: Telegram Mini App — Telegram ichida (soxta `window.Telegram.WebApp`): parolsiz kirish (initData o'zgartirilmasdan),
// "Saytda ochish" (MainButton → handoff → openLink), to'lov havolasi Telegram'da (openTelegramLink);
// sayt: /auth/handoff?token= → kirgan holda, token bir martalik; oddiy brauzerda SDK yuklanmaydi; frame-ancestors.
import { launch, BASE, API_HOST, reset, mockGet, ignorablePageError, makeCheck } from "../lib.mjs";
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  let sdkRequests = 0;
  await ctx.route("https://telegram.org/**", (r) => { sdkRequests++; return r.abort(); });
  await ctx.addInitScript((initData) => {
    const calls = (window.__tg = { ready: 0, expand: 0, close: 0, links: [], tgLinks: [], main: { text: "", visible: false, handlers: [] } });
    window.Telegram = {
      WebApp: {
        initData, platform: "android", version: "8.0",
        ready: () => calls.ready++, expand: () => calls.expand++,
        // 116: real Telegram chat ochilgach Mini App'ni fonga o'tkazadi — close() havola bilan bir vazifada bo'lishi kerak
        close: () => { calls.close++; calls.closeSync = !!calls.linkTask; },
        openLink: (u) => calls.links.push(u),
        openTelegramLink: (u) => { calls.tgLinks.push(u); calls.linkTask = true; setTimeout(() => (calls.linkTask = false), 0); },
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

// ---- 1) Mini App: /tg → parolsiz kirish → katalog
const { ctx, page } = await miniApp(INIT);
await page.goto(`${BASE}/tg#tgWebAppData=${encodeURIComponent(INIT)}&tgWebAppVersion=8.0`);
await page.waitForURL(`${BASE}/catalog`, { timeout: 30000 });
const last = (await mockGet("/__tg-last")).body;
check("Kirish: initData O'ZGARTIRILMASDAN, device_name 'Telegram Mini App'", last?.init_data === INIT && last?.device_name === "Telegram Mini App", JSON.stringify(last)?.slice(0, 160));
const st = await page.evaluate(() => ({ tg: window.__tg, access: localStorage.getItem("a365.access"), secret: localStorage.getItem("a365.device.secret") }));
check("ready() va expand() chaqirildi; tokenlar va device_secret saqlandi", st.tg.ready > 0 && st.tg.expand > 0 && st.access === "access-token-tg-777" && st.secret === "secret-tg-777", JSON.stringify(st));

// ---- 2) 112: telefon ulashish taklifi yo'q (phone_required bo'lsa ham)
await page.waitForSelector('[data-testid="book-card"]', { timeout: 20000 });
check("112: 'Telefon raqamingizni ulashing' ko'rsatilmaydi", (await page.locator("text=Telefon raqamingizni ulashing").count()) === 0 && (await page.locator('[data-testid="tg-phone"]').count()) === 0);
await page.screenshot({ path: OUT + "112-tg-no-phone.png" });

// ---- 3) MainButton "Saytda ochish" → handoff → openLink
await page.waitForFunction(() => window.__tg.main.visible && window.__tg.main.handlers.length > 0, null, { timeout: 10000 });
check("MainButton: 'Saytda ochish' ko'rinadi", (await page.evaluate(() => window.__tg.main.text)) === "Saytda ochish");
await page.evaluate(() => window.__tg.main.handlers.at(-1)());
await page.waitForFunction(() => window.__tg.links.length > 0, null, { timeout: 10000 });
const handoffUrl = await page.evaluate(() => window.__tg.links[0]);
check("Bosildi → POST /auth/telegram/handoff, openLink(https://articles365.uz/auth/handoff?token=…) — 115", /^https:\/\/articles365\.uz\/auth\/handoff\?token=ho-/.test(handoffUrl) && (await tgLog()).includes("POST /auth/telegram/handoff"), handoffUrl);

// ---- 4) Boshqa sahifa (hash'siz) — Telegram ichida deb taniladi, qayta kirish so'ralmaydi
const n0 = (await tgLog()).filter((l) => l === "POST /auth/telegram/webapp").length;
await page.goto(`${BASE}/daily`);
await page.waitForFunction(() => window.__tg.main.visible, null, { timeout: 10000 });
check("Boshqa sahifada ham Mini App rejimi (MainButton), qayta kirish yo'q", (await tgLog()).filter((l) => l === "POST /auth/telegram/webapp").length === n0);

// ---- 4b) 111: faqat sotib olish va kirish sahifalari — boshqa manzil → /catalog; menyu qisqa
await page.waitForURL(`${BASE}/catalog`, { timeout: 10000 });
check("111: /daily Mini App'da → /catalog", page.url() === `${BASE}/catalog`, page.url());
await page.goto(`${BASE}/library`);
await page.waitForURL(`${BASE}/catalog`, { timeout: 10000 });
check("111: /library Mini App'da → /catalog", page.url() === `${BASE}/catalog`, page.url());
await page.waitForSelector('[data-testid="book-card"]', { timeout: 20000 });
const nav = await page.evaluate(() => ({
  links: [...document.querySelectorAll(".client-side-nav a")].map((a) => a.getAttribute("href")),
  sw: !!document.querySelector('[data-testid="catalog-switch"]'),
  bell: !!document.querySelector('[data-testid="notification-bell"], .client-header a[href="/notifications"]'),
}));
check("111: menyuda faqat sotib olish ('/catalog'), almashtirgich va qo'ng'iroq yo'q", nav.links.every((h) => h === "/catalog" || h === "/cart") && nav.links.includes("/catalog") && !nav.sw && !nav.bell, JSON.stringify(nav));
await page.screenshot({ path: OUT + "111-tg-catalog.png" });

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
const closed = await page.evaluate(() => ({ close: window.__tg.close, sync: window.__tg.closeSync }));
check("109/116: havoladan keyin Mini App darhol yopildi (close(), taymersiz) — to'lov bot chatida ko'rinadi", closed.close === 1 && closed.sync === true, JSON.stringify(closed));

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

// ---- 8) Buzuq imzo → tushunarli xabar
const bad = await miniApp(INIT.replace("hash=good", "hash=bad"));
await bad.page.goto(`${BASE}/catalog#tgWebAppData=x`);
await bad.page.waitForSelector('[data-testid="tg-error"]', { timeout: 15000 });
check("TELEGRAM_AUTH_FAILED → 'Telegram orqali kirib bo'lmadi…'", ((await bad.page.textContent('[data-testid="tg-error"]')) ?? "").includes("Telegram orqali kirib bo'lmadi"));

// ---- 8b) 117: haqiqiy SDK'dek — `#tgWebAppData` ni faqat yuklangan paytda o'qiydi (sekin tarmoq, iPhone). Mini App
// ruxsat etilmagan sahifada ochiladi → darhol `/catalog` (hash yo'qoladi) — SDK baribir initData'ni oladi
{
  const INIT3 = INIT.replace("%22id%22%3A777", "%22id%22%3A779");
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const SDK = `(function(){var d=function(s){try{return decodeURIComponent(s.replace(/\\+/g,'%20'))}catch(e){return s}};
    var q=location.hash.replace(/^#/,''),p={};if(q.length)q.split('&').forEach(function(x){var a=x.split('=');p[d(a[0])]=a[1]==null?null:d(a[1])});
    var st=null;try{st=JSON.parse(sessionStorage.getItem('__telegram__initParams'))}catch(e){}
    if(st)for(var k in st)if(typeof p[k]==='undefined')p[k]=st[k];sessionStorage.setItem('__telegram__initParams',JSON.stringify(p));
    var c=window.__tg={hashAtLoad:location.hash,main:{visible:false,text:''}};
    window.Telegram={WebApp:{initData:p.tgWebAppData||'',platform:p.tgWebAppPlatform,version:p.tgWebAppVersion,ready:function(){},expand:function(){},close:function(){},
      openLink:function(){},openTelegramLink:function(){},MainButton:{setText:function(t){c.main.text=t},show:function(){c.main.visible=true},hide:function(){c.main.visible=false},
      onClick:function(){},offClick:function(){},showProgress:function(){},hideProgress:function(){}}}};})();`;
  await ctx3.route("https://telegram.org/**", async (r) => {
    await new Promise((res) => setTimeout(res, 2500));
    await r.fulfill({ status: 200, contentType: "application/javascript", body: SDK }).catch(() => undefined);
  });
  const p3 = await ctx3.newPage();
  p3.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
  await p3.goto(`${BASE}/daily#tgWebAppData=${encodeURIComponent(INIT3)}&tgWebAppVersion=8.0&tgWebAppPlatform=ios`);
  await p3.waitForURL(`${BASE}/catalog`, { timeout: 15000 });
  await p3.waitForFunction(() => window.__tg?.main?.visible, null, { timeout: 15000 }).catch(() => undefined);
  const r3 = await p3.evaluate(() => ({ hash: window.__tg?.hashAtLoad ?? null, init: window.Telegram?.WebApp?.initData ?? "", main: window.__tg?.main ?? null, access: localStorage.getItem("a365.access") }));
  check("117: SDK hash'siz yuklandi (sahifa allaqachon /catalog'da) — initData baribir bor", r3.hash === "" && r3.init === INIT3, JSON.stringify({ hash: r3.hash, init: r3.init.slice(0, 40) }));
  check("117: parolsiz kirildi va 'Saytda ochish' ko'rinadi (to'lov Mini App yo'lidan ketadi)", r3.access === "access-token-tg-779" && r3.main?.visible === true && r3.main?.text === "Saytda ochish", JSON.stringify(r3.main) + " " + r3.access);
  await ctx3.close();
}

// ---- 8c) 118: SDK yuklanmadi (iPhone) — faqat Telegram ko'prigi (`TelegramWebviewProxy`): to'lov havolasi va close()
// ko'prik orqali; pastda diagnostika kartasi. Ko'prik ham yo'q → jim emas: xato + diagnostika
for (const withProxy of [true, false]) {
  const ctx4 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx4.route("https://telegram.org/**", (r) => r.abort());
  await ctx4.addCookies([{ name: "a365_auth", value: "1", url: BASE }]);
  await ctx4.addInitScript((withProxy) => {
    localStorage.setItem("a365.access", "access-token-1c");
    localStorage.setItem("a365.refresh", "refresh-1c");
    window.__events = [];
    if (withProxy) window.TelegramWebviewProxy = { postEvent: (t, d) => window.__events.push([t, JSON.parse(d)]) };
  }, withProxy);
  const p4 = await ctx4.newPage();
  p4.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
  await p4.goto(`${BASE}/catalog/${BOOK2}#tgWebAppData=${encodeURIComponent(INIT)}&tgWebAppVersion=8.0&tgWebAppPlatform=ios`);
  await p4.waitForSelector('[data-testid="tg-diag"]', { timeout: 20000 });
  const diag = (await p4.textContent('[data-testid="tg-diag"] code')) ?? "";
  if (withProxy) check("118: SDK yo'q — pastda diagnostika (sdk=error, proxy=1, boot=hash)", /sdk=error/.test(diag) && /proxy=1/.test(diag) && /boot=hash:/.test(diag), diag);
  // 1-aylanishda buyurtma yaratiladi — 2-sida o'sha buyurtmaning "Telegram orqali to'lash" tugmasi
  const buy = p4.locator('[data-testid="tg-pay-btn"], button:has-text("Buyurtma berish")').first();
  await buy.waitFor({ timeout: 20000 });
  const pages4 = ctx4.pages().length;
  await buy.click();
  if (withProxy) {
    await p4.waitForFunction(() => window.__events.some((e) => e[0] === "web_app_close"), null, { timeout: 10000 }).catch(() => undefined);
    const ev = await p4.evaluate(() => window.__events);
    const link = ev.find((e) => e[0] === "web_app_open_tg_link");
    check("118: ko'prik orqali web_app_open_tg_link(/articles365_test_bot?start=…) va darhol web_app_close; yangi oyna yo'q",
      /^\/articles365_test_bot\?start=/.test(link?.[1]?.path_full ?? "") && ev.findIndex((e) => e[0] === "web_app_close") === ev.indexOf(link) + 1 && ctx4.pages().length === pages4, JSON.stringify(ev));
    await p4.screenshot({ path: OUT + "118-tg-bridge-diag.png" });
  } else {
    await p4.waitForSelector("text=Telegram bilan aloqa yo'q", { timeout: 10000 }).catch(() => undefined);
    const txt = (await p4.locator("text=Telegram bilan aloqa yo'q").first().textContent().catch(() => "")) ?? "";
    check("118: ko'prik ham yo'q — jim emas: 'Telegram bilan aloqa yo'q…' + diagnostika, tg:// ga o'tilmadi", txt.includes("proxy=0") && p4.url().startsWith(BASE), txt + " " + p4.url());
  }
  await ctx4.close();
}

// ---- 9) Telegram Web iframe'da ocha oladi (frame-ancestors), admin — yo'q
const h1 = await fetch(`${BASE}/catalog`).then((r) => r.headers);
const h2 = await fetch(`${BASE}/admin`, { redirect: "manual" }).then((r) => r.headers);
check("Sahifalar: frame-ancestors web.telegram.org, X-Frame-Options yo'q", (h1.get("content-security-policy") ?? "").includes("frame-ancestors 'self' https://web.telegram.org") && !h1.get("x-frame-options"), `${h1.get("content-security-policy")} / ${h1.get("x-frame-options")}`);
check("Admin: X-Frame-Options DENY, frame-ancestors 'none'", h2.get("x-frame-options") === "DENY" && (h2.get("content-security-policy") ?? "").includes("frame-ancestors 'none'"), `${h2.get("content-security-policy")} / ${h2.get("x-frame-options")}`);

check("Sahifa xatolari yo'q", errors.length === 0, errors.join(" | ").slice(0, 300));
await done(browser);
