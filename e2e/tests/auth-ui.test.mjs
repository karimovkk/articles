// 13.1/13.2 — parol ko'z tugmasi (fokus/kursor saqlanadi), kuch indikatori, mos kelish, Caps Lock, auth tab/karusel
import { launch, BASE, reset, makeCheck, ignorablePageError } from "../lib.mjs";
const { check, done } = makeCheck();
await reset("");
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => {
  console.log("❌ XATO:", e.message.split("\n")[0]);
  await browser.close();
  process.exit(1);
});

// ---- Fon: 3D muqovalar devori — ustunlar to'xtovsiz suzadi, "bugungi son" oltin hoshiyada
await page.goto(`${BASE}/login`);
await page.waitForSelector('[data-testid="login-form"]');
await page.waitForFunction(() => { const c = [...document.querySelectorAll(".cw-cover")]; return c.length > 0 && c.every((x) => x.complete && x.naturalWidth > 0); }, null, { timeout: 15000 });
const wall = await page.evaluate(() => {
  const cols = [...document.querySelectorAll(".cw-col")];
  const srcs = new Set([...document.querySelectorAll(".cw-cover")].map((c) => c.getAttribute("src")));
  const plane = getComputedStyle(document.querySelector(".cw-plane")).transform;
  return { cols: cols.length, perCol: cols.map((c) => c.querySelectorAll(".cw-cover").length), srcs: [...srcs].sort(), hot: document.querySelectorAll(".cw-cover.hot").length, plane3d: plane.startsWith("matrix3d") };
});
check("Devor: 9 ustun, har birida 2×5 muqova (choksiz aylanish uchun)", wall.cols === 9 && wall.perCol.every((n) => n === 10), JSON.stringify(wall.perCol));
check("Devor: 7 ta haqiqiy '365' muqovasi ishlatilgan", wall.srcs.length === 7 && wall.srcs.every((s, i) => s === `/covers/mag-${i + 1}.webp`), JSON.stringify(wall.srcs));
check("Devor: 3D qiyshaytirilgan, 'bugungi son' oltin hoshiyada", wall.plane3d && wall.hot === 2, JSON.stringify(wall));
const trackY = () => page.evaluate(() => [...document.querySelectorAll(".cw-track")].map((t) => new DOMMatrix(getComputedStyle(t).transform).m42));
const y1 = await trackY();
await page.waitForTimeout(700);
const y2 = await trackY();
const moved = y1.map((y, i) => y2[i] - y);
check("Devor: ustunlar to'xtovsiz suzadi — juftlari yuqoriga, toqlari pastga", moved.every((d, i) => (i % 2 ? d > 0.5 : d < -0.5)), JSON.stringify(moved.map((d) => d.toFixed(1))));
// Karta devor ustida: shisha (backdrop-filter) va o'ng tomonda
const card = await page.evaluate(() => { const c = document.querySelector(".auth-card"); const r = c.getBoundingClientRect(); const cs = getComputedStyle(c); return { glass: (cs.backdropFilter || cs.webkitBackdropFilter || "").includes("blur"), right: r.left > innerWidth / 2 }; });
check("Karta: shisha effekt, o'ng tomonda", card.glass && card.right, JSON.stringify(card));
check("Katta '365' va shior ko'rinadi", (await page.locator(".auth-big").isVisible()) && (await page.locator(".auth-hero h2").isVisible()));
// "365": bitta nur 3 → 6 → 5 ustidan uzluksiz o'tadi, raqam o'lchami nurga yaqinligiga qarab silliq o'zgaradi —
// animatsiyani aniq paytga qo'yib o'lchaymiz
const digits = await page.evaluate(() => {
  const ds = [...document.querySelectorAll(".auth-big .auth-digit")];
  const at = (el, ms) => {
    const anims = el.getAnimations();
    anims.forEach((a) => { a.pause(); a.currentTime = ms; });
    const cs = getComputedStyle(el);
    const r = { scale: new DOMMatrix(cs.transform).a, bg: parseFloat(cs.backgroundPositionX) };
    anims.forEach((a) => a.play());
    return r;
  };
  // har raqam oynasi: delay 1.2s + i·0.6s; nur 300ms da kiradi, 600ms da o'rtada, 900ms da chiqadi
  const start = (i) => 1200 + i * 600;
  return ds.map((el, i) => ({
    text: el.textContent,
    anims: el.getAnimations().length,
    // nur o'rtada: shu raqam eng katta, qolganlar undan kichik
    peak: at(el, start(i) + 600),
    peakOthers: ds.filter((_, j) => j !== i).map((o) => at(o, start(i) + 600)),
    // o'lcham silliq: kattalashish (450ms) va kichrayish (750ms) paytida oraliq qiymat
    rising: at(el, start(i) + 450),
    falling: at(el, start(i) + 750),
    // keyingi raqamga o'tish (nur shu raqamdan chiqib, keyingisiga kirayotgan payt): ikkalasi ham oraliq o'lchamda
    handoff: i < ds.length - 1 ? [at(el, start(i) + 900), at(ds[i + 1], start(i) + 900)] : null,
    rest: at(el, start(i) + 3500),
  }));
});
const mid = (bg) => bg > 1 && bg < 99;
const between = (s) => s.scale > 1.02 && s.scale < 1.155;
check("'365': 3 raqam, tinch paytda asl o'lchamda", digits.map((d) => d.text).join("") === "365" && digits.every((d) => d.anims === 2 && Math.abs(d.rest.scale - 1) < 0.001), JSON.stringify(digits.map((d) => d.rest)));
check("'365': nur o'rtasida raqam eng katta va yaltiraydi", digits.every((d) => d.peak.scale > 1.15 && mid(d.peak.bg) && d.peakOthers.every((o) => o.scale < d.peak.scale - 0.1)), JSON.stringify(digits.map((d) => [d.peak, d.peakOthers])));
check("'365': o'lcham silliq o'zgaradi (sakramaydi)", digits.every((d) => between(d.rising) && between(d.falling) && d.rising.scale < d.peak.scale && d.falling.scale < d.peak.scale), JSON.stringify(digits.map((d) => [d.rising, d.falling])));
check("'365': nur o'tganda oldingi raqam kichrayib, keyingisi kattalashadi", digits.slice(0, 2).every((d) => d.handoff.every((s) => s.scale > 1.04 && s.scale < 1.12)), JSON.stringify(digits.map((d) => d.handoff)));

// ---- Login: ko'z tugmasi
check("Login: Kirish/Ro'yxat tablar, Kirish faol", (await page.locator('[data-testid="tab-login"][aria-current="page"]').count()) === 1);
const pw = page.locator('input[autocomplete="current-password"]');
await pw.fill("Secret123!");
check("Parol boshida yashirin (type=password)", (await pw.getAttribute("type")) === "password");
await pw.focus();
await page.evaluate(() => { const el = document.querySelector('input[autocomplete="current-password"]'); el.setSelectionRange(3, 3); });
await page.click('[data-testid="pw-eye"]');
await page.waitForTimeout(80);
check("Ko'z bosildi → type=text, qiymat ko'rinadi", (await pw.getAttribute("type")) === "text" && (await pw.inputValue()) === "Secret123!");
check("Ko'z bosilgach fokus va kursor joyi saqlandi", await page.evaluate(() => { const el = document.querySelector('input[autocomplete="current-password"]'); return document.activeElement === el && el.selectionStart === 3; }));
check("Ko'z tugmasi aria-pressed=true, yorlig'i 'yashirish'", (await page.locator('[data-testid="pw-eye"]').getAttribute("aria-pressed")) === "true" && (await page.locator('[data-testid="pw-eye"]').getAttribute("aria-label")) === "Parolni yashirish");
await page.click('[data-testid="pw-eye"]');
check("Qayta bosilgach yana yashirin", (await pw.getAttribute("type")) === "password");
// Caps Lock ogohlantirishi (modifier holati)
await pw.focus();
const capsKey = (on) => page.evaluate((on) => document.querySelector('input[autocomplete="current-password"]').dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true, modifierCapsLock: on })), on);
await capsKey(true);
check("Caps Lock ogohlantirishi", (await page.locator('[data-testid="caps-warning"]').count()) === 1);
await capsKey(false);
check("Caps Lock o'chgach ogohlantirish yo'qoldi", (await page.locator('[data-testid="caps-warning"]').count()) === 0);
// ---- Register: kuch indikatori, mos kelish
await page.goto(`${BASE}/register`);
await page.waitForSelector('[data-testid="register-form"]');
check("Register tab faol", (await page.locator('[data-testid="tab-register"][aria-current="page"]').count()) === 1);
const pws = page.locator('input[autocomplete="new-password"]');
await pws.nth(0).fill("abc");
check("Kuch: 'abc' → 0 (qisqa)", (await page.locator('[data-testid="pw-strength"]').getAttribute("data-level")) === "0");
await pws.nth(0).fill("abcdefgh");
check("Kuch: 8 belgi → 1 (Zaif)", (await page.locator('[data-testid="pw-strength"]').getAttribute("data-level")) === "1" && (await page.locator('[data-testid="pw-strength"]').innerText()).includes("Zaif"));
await pws.nth(0).fill("Abcdefgh1!xy");
check("Kuch: uzun + registr + raqam + belgi → 4 (Kuchli)", (await page.locator('[data-testid="pw-strength"]').getAttribute("data-level")) === "4");
await pws.nth(1).fill("Abcdefgh1!x");
check("Tasdiqlash mos emas → qizil xabar", (await page.locator('[data-testid="pw-mismatch"]').count()) === 1);
await pws.nth(1).fill("Abcdefgh1!xy");
check("Tasdiqlash mos → yashil xabar", (await page.locator('[data-testid="pw-match"]').count()) === 1 && (await page.locator('[data-testid="pw-mismatch"]').count()) === 0);
check("Ikkala parol maydonida ko'z tugmasi", (await page.locator('[data-testid="pw-eye"]').count()) === 2);
await page.locator('[data-testid="pw-eye"]').nth(1).click();
check("Tasdiqlash maydoni ko'z bilan ochildi (mustaqil)", (await pws.nth(1).getAttribute("type")) === "text" && (await pws.nth(0).getAttribute("type")) === "password");

// Ko'rsatilgan parol bilan login ham ishlaydi
await page.goto(`${BASE}/login`);
await page.waitForSelector('[data-testid="login-form"]');
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[autocomplete="current-password"]', "User12345!");
await page.click('[data-testid="pw-eye"]');
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);
check("Ko'rsatilgan parol bilan kirish ishladi", true);

// Profil: parol almashtirishda ham ko'z
await page.goto(`${BASE}/profile`);
await page.waitForSelector("text=Parolni o'zgartirish", { timeout: 10000 });
check("Profil: 3 ta parol maydonida ko'z", (await page.locator('[data-testid="pw-eye"]').count()) === 3);

// prefers-reduced-motion: devor harakatsiz
const rm = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" })).newPage();
await rm.goto(`${BASE}/login`);
await rm.waitForSelector(".cw-track");
const rmPos = () => rm.evaluate(() => [...document.querySelectorAll(".cw-track, .cw-plane")].map((t) => getComputedStyle(t).transform).join("|"));
const pos1 = await rmPos();
await rm.waitForTimeout(800);
check("Reduced motion: devor harakatsiz", pos1 === (await rmPos()) && pos1.length > 0);
check("Reduced motion: '365' raqamlari harakatsiz", await rm.evaluate(() => [...document.querySelectorAll(".auth-digit")].every((d) => d.getAnimations().length === 0)));
// Mobil: devor tepada ko'rinadi, karta to'liq ekranga sig'adi, shior/365 yashirin
const mob = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await mob.goto(`${BASE}/login`);
await mob.waitForSelector('[data-testid="login-form"]');
const m = await mob.evaluate(() => { const r = document.querySelector(".auth-card").getBoundingClientRect(); return { inside: r.left >= 0 && r.right <= innerWidth, sw: document.documentElement.scrollWidth - innerWidth }; });
check("Mobil: devor bor, karta ekranga sig'adi, gorizontal skroll yo'q", (await mob.locator(".cover-wall").count()) === 1 && m.inside && m.sw <= 0, JSON.stringify(m));
check("Mobil: shior va katta '365' yashirin", !(await mob.locator(".auth-hero").isVisible()) && !(await mob.locator(".auth-big").isVisible()));

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await done(browser);
