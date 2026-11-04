// 124: o'qish musiqasi — admin yuklaydi (drag-drop/tanlash, progress, format tekshiruvi, nom, kayfiyat, yoqish/o'chirish,
// tasdiq bilan o'chirish); reader: faqat admin yuklagan treklar (o'rnatilgan tovushlar yo'q), bir bosishda yoqish,
// o'zi boshlanmaydi, bet/maqola almashganda davom etadi, M tugmasi, trek tanlash, ovoz (←/→ betni varaqlamaydi),
// eslab qolish, uyqu taymeri; treklar yo'q (bo'sh ro'yxat / 404 / 500 / tarmoq xatosi) — musiqa tugmasi yo'q;
// eski "ambient" localStorage qiymati; telefon toolbar'i; sahifa rangi (sepiya) va diqqat rejimi.
import { launch, BASE, API_HOST, reset, mockGet, selectPick, confirmDialog, ignorablePageError, makeCheck } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
// Hisobot uchun ixtiyoriy nusxa (masalan, E2E_SHOTS=/tmp/articles-music → …-tracks.png / …-empty.png)
const SHOTS = process.env.E2E_SHOTS ?? "";
const MOCK = new URL("../mock/", import.meta.url).pathname;
const ART1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", ART2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const { check, done } = makeCheck();
await reset("");
const browser = await launch({ args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
const errors = [];

async function signedIn(token, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, ...opts });
  await ctx.addCookies([{ name: "a365_auth", value: "1", url: BASE }]);
  await ctx.addInitScript((tok) => {
    localStorage.setItem("a365.access", tok);
    localStorage.setItem("a365.refresh", "refresh-x");
  }, token);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
  return { ctx, page };
}
const dbg = (page) => page.evaluate(() => window.__a365music?.());
const playing = (page) => page.getAttribute('[data-testid="music-control"]', "data-playing");

// ---- 1) Admin: Musiqa sahifasi
{
  const { ctx, page } = await signedIn("access-token-admin");
  await page.goto(`${BASE}/admin/music`);
  await page.waitForSelector('[data-testid="music-admin-row"]', { timeout: 60000 });
  check("Admin menyusida 'Musiqa' bandi", (await page.locator('.nav-item[href="/admin/music"]').count()) === 1);
  check("Ro'yxat: 3 ta trek (nofaoli ham)", (await page.locator('[data-testid="music-admin-row"]').count()) === 3);
  // yangi treklar kayfiyati — Tabiat; .ogg yuklash
  await selectPick(page, '[data-testid="music-new-mood"]', "NATURE");
  await page.setInputFiles('[data-testid="music-file"]', [MOCK + "upload-test.ogg"]);
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="music-admin-row"]').length === 4, null, { timeout: 15000 });
  const up = (await mockGet("/__music")).tracks.at(-1);
  check("OGG yuklandi: kayfiyat 'Tabiat', nom fayldan, davomiylik brauzerdan", up.mood === "NATURE" && up.title === "upload-test" && up.duration_seconds > 0 && up.mime_type === "audio/ogg", JSON.stringify({ mood: up.mood, title: up.title, d: up.duration_seconds }));
  // noto'g'ri format — klientda rad etiladi (serverga ketmaydi)
  const before = (await mockGet("/__music")).tracks.length;
  await page.setInputFiles('[data-testid="music-file"]', [MOCK + "book.pdf"]);
  await page.waitForSelector('[data-testid="music-job-error"]', { timeout: 5000 });
  check("PDF → 'MP3, OGG yoki M4A emas' (serverga yuborilmadi)", /MP3, OGG yoki M4A/.test(await page.textContent('[data-testid="music-job-error"]')) && (await mockGet("/__music")).tracks.length === before);
  // nomini o'zgartirish
  const row1 = page.locator('[data-testid="music-admin-row"]').first();
  await row1.locator('[data-testid="music-rename"]').click();
  await page.fill('[data-testid="music-rename-input"]', "Ertalabki choy");
  await page.press('[data-testid="music-rename-input"]', "Enter");
  await page.waitForTimeout(400);
  check("Nomi o'zgardi (serverda ham)", (await mockGet("/__music")).tracks[0].title === "Ertalabki choy");
  // kayfiyat
  await selectPick(page, row1.locator('[data-testid="music-mood"]'), "CLASSICAL");
  await page.waitForTimeout(300);
  check("Kayfiyat → Klassika", (await mockGet("/__music")).tracks[0].mood === "CLASSICAL");
  // yoqish/o'chirish
  await row1.locator('[data-testid="music-active"]').click();
  await page.waitForTimeout(300);
  check("Switch → o'quvchilardan yashirildi", (await mockGet("/__music")).tracks[0].is_active === false);
  await row1.locator('[data-testid="music-active"]').click();
  await page.waitForTimeout(300);
  // tinglab ko'rish
  await row1.locator('[data-testid="music-preview"]').click();
  await page.waitForTimeout(800);
  check("Tinglab ko'rish tugmasi → pauza belgisi", (await row1.locator('[data-testid="music-preview"]').getAttribute("aria-label")) === "To'xtatish");
  await row1.locator('[data-testid="music-preview"]').click();
  // o'chirish (tasdiq bilan)
  const nBefore = (await mockGet("/__music")).tracks.length;
  await page.locator('[data-testid="music-admin-row"]').nth(2).locator('[data-testid="music-delete"]').click();
  await confirmDialog(page, false);
  check("O'chirish: 'Bekor' — o'chmadi", (await mockGet("/__music")).tracks.length === nBefore);
  await page.locator('[data-testid="music-admin-row"]').nth(2).locator('[data-testid="music-delete"]').click();
  await confirmDialog(page, true);
  await page.waitForTimeout(300);
  check("O'chirish: tasdiq → o'chdi", (await mockGet("/__music")).tracks.length === nBefore - 1 && (await page.locator('[data-testid="music-admin-row"]').count()) === nBefore - 1);
  await page.screenshot({ path: OUT + "124-admin-music.png", fullPage: true });
  // telefon
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  check("Admin musiqa 390px: gorizontal scroll yo'q", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: OUT + "124-admin-music-390.png", fullPage: true });
  // backend'da endpoint yo'q
  await fetch(`${API_HOST}/__music?off=1`);
  await page.reload();
  await page.waitForSelector('[data-testid="music-missing"]', { timeout: 15000 });
  check("Backend'da musiqa API yo'q → tushunarli xabar (xato emas)", (await page.locator('[data-testid="music-missing"]').count()) === 1);
  await fetch(`${API_HOST}/__music?off=0`);
  await ctx.close();
}

await reset("");
// ---- 2) Reader: bir bosishda yoqish, davom etish, eslab qolish
{
  const { ctx, page } = await signedIn("access-token-1");
  await page.goto(`${BASE}/reader/${ART1}`);
  await page.waitForSelector('[data-page="1"] canvas', { timeout: 60000 });
  await page.waitForTimeout(1500);
  check("O'zi boshlanmaydi (avtoijro yo'q)", (await playing(page)) === "0" && (await dbg(page)).audioPaused);
  await page.click('[data-testid="music-toggle"]');
  await page.waitForFunction(() => !window.__a365music().audioPaused, null, { timeout: 10000 });
  const d1 = await dbg(page);
  check("1 bosish → birinchi trek o'ynaydi", (await playing(page)) === "1" && /\/music\/tracks\/9a9a9a9a-0000-4000-8000-000000000001\/stream/.test(d1.audioSrc), d1.audioSrc);
  await page.waitForTimeout(1400);
  check("Ovoz silliq kuchaydi (0 dan tanlangan balandlikkacha)", Math.abs((await dbg(page)).audioVolume - 0.6) < 0.05, String((await dbg(page)).audioVolume));
  // bet almashishi
  await page.fill('input[aria-label="Sahifa"]', "3");
  await page.press('input[aria-label="Sahifa"]', "Enter");
  await page.waitForTimeout(800);
  check("Bet almashganda davom etadi", !(await dbg(page)).audioPaused);
  // keyingi maqola (layout saqlanadi)
  await page.click(`a[href="/reader/${ART2}"]`);
  await page.waitForURL(`${BASE}/reader/${ART2}`, { timeout: 15000 });
  await page.waitForSelector('[data-testid="music-control"]', { timeout: 30000 });
  await page.waitForTimeout(800);
  check("Keyingi maqolaga o'tganda ham davom etadi", !(await dbg(page)).audioPaused && (await playing(page)) === "1");
  // M — to'xtatish
  await page.locator("body").click({ position: { x: 5, y: 300 } }).catch(() => undefined);
  await page.keyboard.press("m");
  await page.waitForFunction(() => window.__a365music().audioPaused, null, { timeout: 5000 });
  check("M tugmasi → to'xtadi (silliq so'nib)", (await playing(page)) === "0");
  // panel: faqat treklar — o'rnatilgan tovushlar yo'q
  await page.click('[data-testid="music-open"]');
  await page.waitForSelector('[data-testid="music-panel"]');
  check("Panelda faqat faol treklar (nofaol 'Arxiv' yo'q)", (await page.locator('[data-testid="music-track"]').count()) === 2);
  check("Panelda o'rnatilgan tovushlar (yomg'ir/to'lqin/shovqin) yo'q", (await page.locator('[data-testid^="music-ambient"], .music-amb').count()) === 0 && !/Yomg'ir|To'lqinlar|Sokin shovqin|Fon tovushlari/.test(await page.textContent('[data-testid="music-panel"]')));
  await page.locator('[data-testid="music-track"]').nth(1).click();
  await page.waitForFunction(() => !window.__a365music().audioPaused && /000000000002\/stream/.test(window.__a365music().audioSrc), null, { timeout: 10000 });
  check("Ikkinchi trek tanlandi → o'sha o'ynaydi", (await playing(page)) === "1" && /Chuqur diqqat/.test(await page.textContent(".music-now-title")));
  // ovoz: ←/→ slider'da — betni varaqlamaydi
  const pageBefore = await page.inputValue('input[aria-label="Sahifa"]');
  await page.focus('[data-testid="music-volume"]');
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(400);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("a365.music")));
  check("Ovoz ← ← → 50% (saqlandi), bet o'zgarmadi", Math.abs(saved.volume - 0.5) < 0.001 && (await page.inputValue('input[aria-label="Sahifa"]')) === pageBefore, JSON.stringify(saved));
  // uyqu taymeri
  await page.click('[data-testid="music-sleep-15"]');
  await page.waitForTimeout(1200);
  check("Uyqu taymeri 15 daq. — qolgan vaqt ko'rinadi", /14:5\d/.test(await page.textContent('[data-testid="music-panel"]')));
  await page.screenshot({ path: OUT + "124-reader-music.png" });
  if (SHOTS) await page.screenshot({ path: SHOTS + "-tracks.png" });
  // qayta yuklash — o'zi boshlanmaydi, lekin oxirgi manba eslab qolingan
  await page.reload();
  await page.waitForSelector('[data-testid="music-toggle"]', { timeout: 60000 });
  await page.waitForTimeout(1200);
  check("Qayta yuklash: avtoijro yo'q", (await playing(page)) === "0");
  await page.click('[data-testid="music-toggle"]');
  await page.waitForFunction(() => !window.__a365music().audioPaused, null, { timeout: 10000 });
  const d3 = await dbg(page);
  check("1 bosish → eslab qolingan 'Chuqur diqqat' davom etadi", /000000000002\/stream/.test(d3.audioSrc), JSON.stringify(d3));
  // kitob sahifasiga chiqish — to'xtaydi
  await page.goto(`${BASE}/reader/${ART1}`);
  await ctx.close();
}

// ---- 3) Treklar yo'q — musiqa tugmasi umuman yo'q (bo'sh pleyer, xom kod, o'rnatilgan tovush yo'q)
async function noMusic(name, prep, opts = {}) {
  const { ctx, page } = await signedIn("access-token-1", opts);
  if (opts.route) await page.route("**/music/tracks", (r) => r.abort("failed"));
  await prep?.();
  await page.goto(`${BASE}/reader/${ART1}`);
  await page.waitForSelector('[data-page="1"] canvas', { timeout: 60000 });
  await page.waitForSelector('[data-testid="comfort-open"]', { timeout: 30000 });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => ({
    ctl: document.querySelectorAll('[data-testid="music-control"], [data-testid="music-toggle"], [data-testid="music-panel"]').length,
    raw: /NOT_FOUND|INTERNAL_ERROR|HTTP_\d{3}|\b(404|500)\b/.test(document.querySelector(".reader-toolbar")?.textContent ?? ""),
    sw: document.documentElement.scrollWidth - innerWidth,
  }));
  await page.keyboard.press("m");
  await page.waitForTimeout(500);
  const d = await dbg(page);
  check(`${name}: musiqa tugmasi yo'q, xom kod yo'q, M — jim`, r.ctl === 0 && !r.raw && r.sw <= 1 && d.audioPaused && !d.audioSrc, JSON.stringify({ ...r, ...d }));
  return { ctx, page };
}
{
  await reset("?music=0");
  const { ctx, page } = await noMusic("Bo'sh ro'yxat (admin hali yuklamagan)");
  await page.screenshot({ path: OUT + "124-reader-music-empty.png" });
  if (SHOTS) await page.screenshot({ path: SHOTS + "-empty.png" });
  await ctx.close();
  // telefon — toolbar toshmaydi
  const m = await noMusic("Bo'sh ro'yxat, telefon 390px", null, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await m.ctx.close();
}
await reset("");
for (const [name, q] of [["Endpoint yo'q (404)", "off=1"], ["Server xatosi (500)", "fail=1"]]) {
  await fetch(`${API_HOST}/__music?${q}`);
  const { ctx } = await noMusic(name);
  await ctx.close();
  await fetch(`${API_HOST}/__music?off=0&fail=0`);
}
{
  const { ctx } = await noMusic("Tarmoq xatosi", null, { route: true });
  await ctx.close();
}

// ---- 3b) Eski saqlangan "ambient" manba (o'rnatilgan tovushlar davridan) — e'tiborsiz, birinchi trek o'ynaydi
{
  const { ctx, page } = await signedIn("access-token-1");
  // faqat birinchi yuklashda (keyingi reload'da test o'z qiymatini qo'yadi)
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("a365.music", JSON.stringify({ source: { kind: "ambient", id: "rain" }, volume: 0.4, loop: false }));
  });
  await page.goto(`${BASE}/reader/${ART1}`);
  await page.waitForSelector('[data-testid="music-toggle"]', { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.click('[data-testid="music-toggle"]');
  await page.waitForFunction(() => !window.__a365music().audioPaused, null, { timeout: 10000 });
  const d = await dbg(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("a365.music")));
  check("Eski 'ambient' saqlangan → xatosiz, birinchi trek o'ynaydi, ovoz saqlangan", /000000000001\/stream/.test(d.audioSrc) && saved.source.kind === "track" && Math.abs(saved.volume - 0.4) < 0.001, JSON.stringify({ d, saved }));
  // buzilgan qiymat ham — xatosiz
  await page.evaluate(() => localStorage.setItem("a365.music", "{oops"));
  await page.reload();
  await page.waitForSelector('[data-testid="music-toggle"]', { timeout: 60000 });
  check("Buzilgan localStorage → musiqa tugmasi bor, xato yo'q", (await playing(page)) === "0");
  await ctx.close();
}

// ---- 4) Telefon toolbar'i (320 / 390 / 768) va qulayliklar
{
  const { ctx, page } = await signedIn("access-token-1", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(`${BASE}/reader/${ART1}`);
  await page.waitForSelector('[data-testid="music-toggle"]', { timeout: 60000 });
  await page.waitForTimeout(1500);
  const bad = [];
  for (const w of [320, 390, 768]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => {
      const hd = document.querySelector(".reader-toolbar");
      const vis = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return b.width > 0 && b.right <= innerWidth && b.left >= 0; };
      return { sw: document.documentElement.scrollWidth - innerWidth, hsw: hd.scrollWidth - hd.clientWidth, music: vis('[data-testid="music-toggle"]'), comfort: vis('[data-testid="comfort-open"]'), locale: vis('[data-testid="locale-menu"]') };
    });
    if (r.sw > 1 || r.hsw > 1 || !r.music || !r.comfort || !r.locale) bad.push(`${w}: ${JSON.stringify(r)}`);
  }
  check("Telefon/planshet toolbar: musiqa, Aa, til tugmalari ko'rinadi, toshish yo'q", bad.length === 0, bad.join(" | "));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[data-testid="comfort-open"]');
  await page.click('[data-testid="tone-sepia"]');
  await page.keyboard.press("Escape");
  await page.reload();
  await page.waitForSelector('[data-testid="reader-stage"]', { timeout: 60000 });
  check("Sepiya sahifa rangi eslab qolinadi", (await page.getAttribute('[data-testid="reader-stage"]', "data-tone")) === "sepia");
  await page.keyboard.press("f");
  await page.waitForTimeout(200);
  const hidden = await page.evaluate(() => getComputedStyle(document.querySelector(".reader-toolbar")).display === "none");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const back = await page.evaluate(() => getComputedStyle(document.querySelector(".reader-toolbar")).display !== "none");
  check("Diqqat rejimi: F → toolbar yashirin, Esc → qaytadi", hidden && back);
  await page.evaluate(() => { localStorage.removeItem("a365.reader.sepia"); });
  await ctx.close();
}

check("Sahifa xatolari yo'q", errors.length === 0, errors.join(" | ").slice(0, 300));
await done(browser);
