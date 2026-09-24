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

// ---- Chap panel: yer shari + orbitadagi kitoblar
await page.goto(`${BASE}/login`);
await page.waitForSelector('[data-testid="login-form"]');
await page.waitForFunction(() => { const b = [...document.querySelectorAll(".orbit-book")]; return b.length === 5 && b.every((x) => x.complete && x.naturalWidth > 0 && x.style.visibility === "visible"); }, null, { timeout: 15000 });
check("Globus: 5 ta kitob rasmi yuklandi va joylashtirildi", true);
// Canvas quruqlik maskasi yuklangach chiziladi — kutamiz (aks holda test beqaror)
const globeDrawn = await page
  .waitForFunction(() => {
    const c = document.querySelector(".globe-canvas");
    if (!c || !c.width) return false;
    const d = c.getContext("2d").getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    return d[3] > 200;
  }, null, { timeout: 15000 })
  .then(() => true)
  .catch(() => false);
check("Globus: canvas chizilgan (markazda shaffof emas)", globeDrawn);
// Orbita yo'nalishi: kitob globus oldiga o'tishi (z 1→3) — yuqori-o'ngda, orqaga kirishi (3→1) — pastki-chapda
const samples = await page.evaluate(async () => {
  const wrap = document.querySelector(".globe-orbit").getBoundingClientRect();
  const cx = wrap.left + wrap.width / 2, cy = wrap.top + wrap.height / 2;
  const books = [...document.querySelectorAll(".orbit-book")];
  const prev = books.map((b) => b.style.zIndex);
  const events = [];
  const t0 = performance.now();
  while (performance.now() - t0 < 7000) {
    await new Promise((r) => requestAnimationFrame(r));
    books.forEach((b, i) => {
      const z = b.style.zIndex;
      if (z !== prev[i]) {
        const r = b.getBoundingClientRect();
        events.push({ kind: z === "3" ? "enter" : "exit", dx: Math.round(r.left + r.width / 2 - cx), dy: Math.round(r.top + r.height / 2 - cy) });
        prev[i] = z;
      }
    });
  }
  return events;
});
const enters = samples.filter((e) => e.kind === "enter"), exits = samples.filter((e) => e.kind === "exit");
check("Orbita: kitoblar yuqori-o'ngdan (globus orqasidan) chiqadi", enters.length > 0 && enters.every((e) => e.dx > 0 && e.dy < 0), JSON.stringify(enters));
check("Orbita: pastki-chapda globus orqasiga kiradi", exits.length > 0 && exits.every((e) => e.dx < 0 && e.dy > 0), JSON.stringify(exits));

// ---- Login: ko'z tugmasi
check("Login: Kirish/Ro'yxat tablar, Kirish faol", (await page.locator('[data-testid="tab-login"][aria-current="page"]').count()) === 1);
check("Login: karusel (3 slayd, 1 ta faol)", (await page.locator(".auth-slide").count()) === 3 && (await page.locator(".auth-slide.active").count()) === 1);
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

// Karusel nuqtasi bosilsa slayd almashadi
await page.locator(".auth-dots button").nth(2).click();
check("Karusel: 3-nuqta → 3-slayd faol", await page.evaluate(() => document.querySelectorAll(".auth-slide")[2].classList.contains("active")));

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

// prefers-reduced-motion: statik kadr (kitoblar joyida turadi)
const rm = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" })).newPage();
await rm.goto(`${BASE}/login`);
await rm.waitForFunction(() => [...document.querySelectorAll(".orbit-book")].every((x) => x.style.visibility === "visible"), null, { timeout: 15000 });
await rm.waitForTimeout(600); // statik kadr joylashib bo'lsin
const pos1 = await rm.evaluate(() => [...document.querySelectorAll(".orbit-book")].map((b) => b.style.transform).join("|"));
await rm.waitForTimeout(800);
const pos2 = await rm.evaluate(() => [...document.querySelectorAll(".orbit-book")].map((b) => b.style.transform).join("|"));
check("Reduced motion: kitoblar harakatsiz (statik kadr)", pos1 === pos2 && pos1.length > 0);
// Mobil: chap panel yashirin — globus ko'rinmaydi
const mob = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await mob.goto(`${BASE}/login`);
await mob.waitForSelector('[data-testid="login-form"]');
check("Mobil: globus paneli yashirin, forma ko'rinadi", !(await mob.locator(".globe-orbit").isVisible()));

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await done(browser);
