// 78: chap pastki karta — "Buy Real Books": Uzum Market'dagi do'konga yangi oynada olib boradi; kitoblarimiz
// muqovalari 3D halqada aylanadi (reduced-motion — harakatsiz). Havola admin "Integratsiya" sahifasida o'zgaradi
// (berilmagan bo'lsa — Uzum'da qidiruv). Telefon menyusida ham.
import { launch, BASE, reset, mockGet, ignorablePageError, makeCheck } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
const DEFAULT = "https://uzum.uz/uz/search?query=Articles365";
const CUSTOM = "https://uzum.uz/uz/shop/articles365";
const { check, done } = makeCheck();
await reset("");
const browser = await launch();
const errors = [];
const watch = (p) => p.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
const stubUzum = (ctx) => ctx.route(/^https:\/\/uzum\.uz\//, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>Uzum</title>" }));

// ---- Mehmon, kompyuter
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await stubUzum(ctx);
const page = await ctx.newPage();
watch(page);
await page.goto(`${BASE}/daily`);
await page.waitForSelector('[data-testid="buy-books"]', { timeout: 20000 });
const card = page.locator('[data-testid="buy-books"]');
const attrs = await card.evaluate((a) => ({ href: a.getAttribute("href"), target: a.target, rel: a.rel, text: a.innerText.replace(/\s+/g, " ").trim() }));
check("Karta: 'Buy Real Books' + 'Uzum Market', standart havola — Uzum'da qidiruv", attrs.text.includes("Buy Real Books") && attrs.text.includes("Uzum Market") && attrs.href === DEFAULT, JSON.stringify(attrs));
check("Yangi oynada (target=_blank, rel=noopener noreferrer)", attrs.target === "_blank" && /noopener/.test(attrs.rel) && /noreferrer/.test(attrs.rel));
check("Eski 'O'qing / O'rganing / O'sing' kartasi yo'q", (await page.locator(".client-promo").count()) === 0 && !(await page.textContent("body")).includes("O'rganing"));
// 86: muqovalar — login sahifasidagi "365" jurnallari (tekis variant), hammasi yuklangan
await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="buy-books-cover"] img')].every((im) => im.complete && im.naturalWidth > 0), null, { timeout: 15000 });
const ring = await page.evaluate(() => {
  const r = document.querySelector('[data-testid="buy-books-ring"]');
  const a = r.getAnimations().find((x) => x.animationName === "bb-spin");
  const imgs = [...document.querySelectorAll('[data-testid="buy-books-cover"] img')];
  return { covers: imgs.length, srcs: imgs.map((im) => im.getAttribute("src")), running: a?.playState === "running", t0: getComputedStyle(r).transform };
});
await page.waitForTimeout(700);
const t1 = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="buy-books-ring"]')).transform);
check("7 ta '365' jurnali (login'dagi bilan bir xil) halqada aylanmoqda", ring.covers === 7 && ring.srcs.every((x, i) => x === `/covers/mag-${i + 1}.webp`) && ring.running && ring.t0 !== t1, JSON.stringify(ring.srcs));
await card.hover();
await page.waitForTimeout(200);
check("Ustiga kelinganda aylanish to'xtaydi (ko'rib olish uchun)", (await page.evaluate(() => document.querySelector('[data-testid="buy-books-ring"]').getAnimations().find((x) => x.animationName === "bb-spin")?.playState)) === "paused");
await page.locator(".client-sidebar").screenshot({ path: OUT + "99-buy-books-light-1440.png" });
const [popup] = await Promise.all([page.waitForEvent("popup", { timeout: 5000 }), card.click()]);
check("Bosilganda — Uzum Market yangi oynada ochildi, sayt o'z joyida", popup.url() === DEFAULT && page.url().endsWith("/daily"), popup.url());
await popup.close();

// ---- Admin: havolani o'zgartirish (Integratsiya)
const admin = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
watch(admin);
await admin.goto(`${BASE}/login`);
await admin.fill('input[autocomplete="username"]', "admin@articles365.local");
await admin.fill('input[type="password"]', "Admin12345!");
await admin.click('button[type="submit"]');
await admin.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
await admin.goto(`${BASE}/admin/integrations`);
await admin.waitForSelector('[data-testid="shop-card"]', { timeout: 20000 });
await admin.fill('[data-testid="shop-url"]', "http://example.com/shop");
check("Admin: https bo'lmagan havola rad etiladi", (await admin.locator('[data-testid="shop-url-invalid"]').count()) === 1 && (await admin.isDisabled('[data-testid="shop-save"]')));
await admin.fill('[data-testid="shop-url"]', CUSTOM);
await admin.click('[data-testid="shop-save"]');
await admin.waitForSelector("text=Do'kon havolasi saqlandi", { timeout: 8000 });
const saved = await mockGet("/__app-settings");
check("Admin: havola saqlandi (app-settings → shop.uzum_url)", saved.shop?.uzum_url === CUSTOM, JSON.stringify(saved.shop));
await admin.locator('[data-testid="shop-card"]').screenshot({ path: OUT + "99-admin-shop-link.png" });

await page.reload();
await page.waitForFunction((u) => document.querySelector('[data-testid="buy-books"]')?.getAttribute("href") === u, CUSTOM, { timeout: 10000 }).catch(() => {});
check("Foydalanuvchida yangi havola", (await card.getAttribute("href")) === CUSTOM);

// ---- Qorong'i mavzu va telefon menyusi
await page.evaluate(() => localStorage.setItem("a365.theme", "dark"));
await page.reload();
await page.waitForSelector('[data-testid="buy-books"]');
await page.waitForTimeout(800);
await page.locator(".client-sidebar").screenshot({ path: OUT + "99-buy-books-dark-1440.png" });

for (const W of [390, 320]) {
  const m = await (await browser.newContext({ viewport: { width: W, height: 780 }, hasTouch: true, isMobile: true })).newPage();
  watch(m);
  await m.goto(`${BASE}/daily`);
  await m.click('[data-testid="client-menu"]');
  await m.waitForSelector('.client-sidebar.open [data-testid="buy-books"]', { timeout: 8000 });
  await m.waitForTimeout(500);
  const g = await m.evaluate(() => {
    const r = document.querySelector('[data-testid="buy-books"]').getBoundingClientRect();
    const s = document.querySelector(".client-sidebar").getBoundingClientRect();
    return { in: r.left >= s.left && r.right <= s.right + 0.5 && r.bottom <= innerHeight + 0.5, w: Math.round(r.width), sw: document.documentElement.scrollWidth - innerWidth };
  });
  check(`${W}px menyu: karta to'liq ko'rinadi, toshish yo'q`, g.in && g.sw <= 1, JSON.stringify(g));
  await m.screenshot({ path: OUT + `99-buy-books-${W}-menu.png` });
  await m.context().close();
}

// ---- Harakatni kamaytirish — aylanmaydi
const rm = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })).newPage();
await rm.goto(`${BASE}/daily`);
await rm.waitForSelector('[data-testid="buy-books-ring"]');
check("prefers-reduced-motion: muqovalar harakatsiz", (await rm.evaluate(() => document.querySelector('[data-testid="buy-books-ring"]').getAnimations().length)) === 0);
await rm.context().close();

// Standartga qaytarish
await admin.click('[data-testid="shop-reset"]');
await admin.waitForSelector("text=Standart havola tiklandi", { timeout: 8000 });
check("Admin: standartga qaytarildi (kalit o'chdi)", !("shop" in (await mockGet("/__app-settings"))));

check("Sahifa xatolari yo'q", errors.length === 0, errors.join(" | ").slice(0, 300));
await done(browser);
