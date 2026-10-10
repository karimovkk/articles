// 76: Daily Articles — ulashish: kartalarda, tekin kitob sahifasida va tekin maqola o'quvchisida. Havolani nusxalash
// (bufer), Telegram / WhatsApp / Facebook / X (yangi oynada, to'g'ri kodlangan havola), telefonda tizim "Ulashish"
// oynasi; pullik (365 Magazine) kitoblarda tugma yo'q.
import { launch, BASE, reset, ignorablePageError, makeCheck } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
const FREE_BOOK = "22222222-2222-4222-8222-000000000000"; // "Kitob 1" — tekin
const FREE_ART = "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1";
const { check, done } = makeCheck();
await reset("");
const browser = await launch();
const errors = [];

// Tashqi tarmoqlar — so'rov tashqariga chiqmaydi (oyna ochilgani va manzili tekshiriladi)
const stubExternal = (ctx) => ctx.route(/^https:\/\/(t\.me|wa\.me|www\.facebook\.com|x\.com)\//, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>ok</title>" }));

// ---- Kompyuter
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, permissions: ["clipboard-read", "clipboard-write"] });
  await stubExternal(ctx);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
  await page.goto(`${BASE}/daily`);
  await page.waitForSelector('[data-testid="book-card"]', { timeout: 20000 });
  const cards = await page.locator('[data-testid="book-card"]').count();
  const shares = await page.locator('[data-testid="card-share"]').count();
  check("Daily Articles: har bir kartada 'Ulashish' tugmasi", cards > 0 && shares === cards, `${shares}/${cards}`);
  const first = page.locator('[data-testid="book-card"]').first();
  const href = await first.locator(".bcard-link").getAttribute("href");
  const title = (await first.locator(".bcard-title").textContent()).trim();
  const want = `${BASE}${href}`;

  await first.locator('[data-testid="card-share"]').click();
  await page.waitForSelector('[data-testid="card-share-copy"]', { timeout: 3000 });
  const items = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="card-share-"]')].map((e) => e.dataset.testid.replace("card-share-", "")));
  check("Menyu: nusxalash, Telegram, WhatsApp, Facebook, X", ["copy", "telegram", "whatsapp", "facebook", "x"].every((k) => items.includes(k)), items.join(","));
  await page.waitForTimeout(300); // ochilish animatsiyasi (140 ms) tugasin
  const menuBg = await page.evaluate(() => { const m = document.querySelector('[data-testid="card-share-copy"]').closest(".menu"); const cs = getComputedStyle(m); return { bg: cs.backgroundColor, op: cs.opacity }; });
  check("Menyu foni to'liq (shaffof emas) — matn o'qiladi", /^rgb\(255, 255, 255\)$/.test(menuBg.bg) && menuBg.op === "1", JSON.stringify(menuBg));
  await page.screenshot({ path: OUT + "99-share-menu-1366.png" });
  await page.click('[data-testid="card-share-copy"]');
  await page.waitForTimeout(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check("Havolani nusxalash: buferda kitobning to'liq havolasi", clip === want, `${clip} / ${want}`);
  const copiedTitle = await first.locator('[data-testid="card-share"]').getAttribute("title");
  check("Nusxalangach — ✓ 'Havola nusxalandi' (2 s)", copiedTitle === "Havola nusxalandi" && (await first.locator('[data-testid="card-share"].is-copied').count()) === 1, copiedTitle);
  await page.waitForTimeout(2300);
  check("2 s dan keyin tugma odatiy holatga qaytdi", (await first.locator('[data-testid="card-share"]').getAttribute("title")) === "Ulashish");

  const text = `«${title}» — Articles365 da bepul o'qing`;
  const expected = {
    telegram: `https://t.me/share/url?url=${encodeURIComponent(want)}&text=${encodeURIComponent(text)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${want}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(want)}`,
    x: `https://x.com/intent/post?url=${encodeURIComponent(want)}&text=${encodeURIComponent(text)}`,
  };
  for (const [k, url] of Object.entries(expected)) {
    await first.locator('[data-testid="card-share"]').click();
    await page.waitForSelector(`[data-testid="card-share-${k}"]`, { timeout: 3000 });
    const [popup] = await Promise.all([page.waitForEvent("popup", { timeout: 5000 }), page.click(`[data-testid="card-share-${k}"]`)]);
    const opened = popup.url();
    const opener = await popup.evaluate(() => window.opener === null).catch(() => true);
    // Brauzer ba'zi belgilarni (') boshqacha kodlaydi — manzil va parametrlar dekodlangan holda taqqoslanadi
    const norm = (u) => { const x = new URL(u); return `${x.origin}${x.pathname}?${[...x.searchParams].map(([a, b]) => `${a}=${b}`).join("&")}`; };
    check(`${k}: yangi oynada, to'g'ri havola va matn (opener yo'q)`, norm(opened) === norm(url) && opener, norm(opened));
    await popup.close();
  }
  // Karta bosilmadi (ulashish tugmasi kartaning havolasini ochib yubormaydi)
  check("Ulashish tugmasi kartani ochib yubormaydi", page.url().endsWith("/daily"));

  // Pullik (365 Magazine) — ulashish yo'q
  await page.goto(`${BASE}/catalog`);
  await page.waitForSelector('[data-testid="book-card"]', { timeout: 20000 });
  check("365 Magazine kartalarida ulashish tugmasi yo'q", (await page.locator('[data-testid="card-share"]').count()) === 0);

  // Tekin kitob sahifasi
  await page.goto(`${BASE}/catalog/${FREE_BOOK}`);
  await page.waitForSelector('[data-testid="book-share"]', { timeout: 15000 });
  await page.click('[data-testid="book-share"]');
  await page.click('[data-testid="book-share-copy"]');
  await page.waitForTimeout(300);
  check("Tekin kitob sahifasi: 'Ulashish' — sahifa havolasi nusxalandi", (await page.evaluate(() => navigator.clipboard.readText())) === `${BASE}/catalog/${FREE_BOOK}`);
  await page.screenshot({ path: OUT + "99-share-book-1366.png" });

  // Tekin maqola (mehmon) — o'quvchida
  await page.goto(`${BASE}/reader/${FREE_ART}`);
  await page.waitForSelector('[data-testid="reader-share"]', { timeout: 20000 });
  await page.click('[data-testid="reader-share"]');
  await page.click('[data-testid="reader-share-copy"]');
  await page.waitForTimeout(300);
  check("Tekin maqola o'quvchisi: maqola havolasi nusxalandi", (await page.evaluate(() => navigator.clipboard.readText())) === `${BASE}/reader/${FREE_ART}`);
  await ctx.close();
}

// ---- Telefon (390, 320): menyu ekranga sig'adi; tizim "Ulashish" oynasi
for (const W of [390, 320]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 780 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => {
    window.__shared = null;
    navigator.share = (d) => {
      window.__shared = d;
      return Promise.resolve();
    };
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
  await page.goto(`${BASE}/daily`);
  await page.waitForSelector('[data-testid="card-share"]', { timeout: 20000 });
  const first = page.locator('[data-testid="book-card"]').first();
  const href = await first.locator(".bcard-link").getAttribute("href");
  await first.locator('[data-testid="card-share"]').tap();
  await page.waitForSelector('[data-testid="card-share-native"]', { timeout: 3000 });
  const fit = await page.evaluate(() => {
    const m = document.querySelector('[data-testid="card-share-copy"]').closest('[role="menu"]').getBoundingClientRect();
    return { l: Math.round(m.left), r: Math.round(m.right), b: Math.round(m.bottom), w: innerWidth, h: innerHeight };
  });
  check(`${W}px: menyu ekranga sig'adi`, fit.l >= 0 && fit.r <= fit.w && fit.b <= fit.h, JSON.stringify(fit));
  const cta = await first.locator(".bcard-cta").evaluate((el) => { const r = el.getBoundingClientRect(); const s = el.querySelector(".share-btn").getBoundingClientRect(); return s.right <= r.right + 0.5 && s.width >= 32; });
  check(`${W}px: ulashish belgisi 'O'qish' yonida, kartadan chiqmaydi`, cta);
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + `99-share-menu-${W}.png` });
  await page.tap('[data-testid="card-share-native"]');
  await page.waitForTimeout(300);
  const shared = await page.evaluate(() => window.__shared);
  check(`${W}px: 'Boshqa ilovalar' — tizim oynasi (Web Share) to'g'ri havola bilan`, shared?.url === `${BASE}${href}` && !!shared?.title, JSON.stringify(shared));
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(`${W}px: gorizontal toshish yo'q`, sw <= 1, `+${sw}`);
  await ctx.close();
}

check("Sahifa xatolari yo'q", errors.length === 0, errors.join(" | ").slice(0, 300));
await done(browser);
