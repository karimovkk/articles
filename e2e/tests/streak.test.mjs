// 44.6 / 59 — Kunlik o'qish seriyasi (streak) va reyting: header'da 🔥 N (bugun o'qilmagan bo'lsa — xira); reader'da sahifa
// almashsa (progress) seriya "bugun" bo'ladi va chip darhol yangilanadi; "Reyting" sahifasi — o'z ko'rsatkichlarim,
// top-20, o'zim topda bo'lmasam alohida qatorda; menyuda "Reyting"; telefonda toshish yo'q.
import { launch, BASE, API_HOST, reset, mockGet, ignorablePageError } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const USER_ID = "u1u1u1u1-u1u1-4u1u-8u1u-u1u1u1u1u1u1";
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-streak-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });
const chip = async () => ({ n: ((await page.textContent('[data-testid="streak-chip"]')) ?? "").trim(), active: await page.getAttribute('[data-testid="streak-chip"]', "data-active") });

// Kechagacha 4 kunlik seriya, bugun hali o'qilmagan
await fetch(`${API_HOST}/__seed-streak?user=${USER_ID}&current=4&longest=9&total=20`);
await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
await page.waitForSelector('[data-testid="streak-chip"]', { timeout: 10000 });
let c = await chip();
check("Header: 🔥 4, bugun o'qilmagan — xira", c.n === "4" && c.active === "0", JSON.stringify(c));
check("Menyuda 'Reyting'", (await page.locator('.client-sidebar a[href="/leaderboard"]').count()) === 1);

// O'qish → seriya bugun (5), chip darhol yangilanadi
await page.goto(`${BASE}/reader/${ART}`);
await page.waitForFunction(() => document.querySelector('[data-page="1"] canvas')?.width > 0, null, { timeout: 30000 });
await page.fill('input[aria-label="Sahifa"]', "3");
await page.press('input[aria-label="Sahifa"]', "Enter");
await page.waitForTimeout(2500); // progress debounce
check("Progress saqlandi → serverda seriya bugun (5)", (await mockGet("/__streaks"))[USER_ID]?.current === 5);
await page.goto(`${BASE}/library`);
await page.waitForSelector('[data-testid="streak-chip"][data-active="1"]', { timeout: 10000 });
c = await chip();
check("Header: 🔥 5, faol (bugun o'qildi)", c.n === "5" && c.active === "1", JSON.stringify(c));

// Reyting: 25 ta boshqa o'quvchi → men topda emasman, alohida qatorda
await fetch(`${API_HOST}/__seed-streak?leaders=25`);
await page.click('[data-testid="streak-chip"]');
await page.waitForURL(`${BASE}/leaderboard`);
await page.waitForSelector('[data-testid="leaderboard"]', { timeout: 10000 });
const my = ((await page.textContent('[data-testid="my-streak"]')) ?? "").replace(/\s+/g, " ");
check("O'z ko'rsatkichlarim: 5 kun, eng uzun 9, jami 21, 'Bugun o'qidingiz'", my.includes("5 kun") && my.includes("9 kun") && my.includes("21 kun") && my.includes("Bugun o'qidingiz"), my);
check("Top-20: 3 tasi podiumda + 17 tasi ro'yxatda (4-o'rindan), o'zim alohida qatorda (26-o'rin)", (await page.locator('[data-testid="podium-place"]').count()) === 3 && (await page.locator('[data-testid="lb-row"]').count()) === 17 && ((await page.textContent('[data-testid="lb-row"] .lb-rank >> nth=0')) ?? "").trim() === "4" && ((await page.textContent('[data-testid="lb-me"]')) ?? "").includes("26"));
// 80: podium — 2 · 1 · 3, 1-o'rinda toj va eng baland poydevor; ketma-ket chiqish 3 → 2 → 1; mushakbozlik
const pod = await page.evaluate(() => {
  const places = [...document.querySelectorAll('[data-testid="podium-place"]')];
  const delay = (el) => parseFloat(getComputedStyle(el.querySelector(".podium-block")).animationDelay);
  const h = (el) => el.querySelector(".podium-block").offsetHeight; // animatsiya (scale) ta'sir qilmaydi
  const by = (r) => places.find((p) => p.dataset.rank === String(r));
  return {
    order: places.map((p) => p.dataset.rank).join(""),
    first: by(1).innerText.replace(/\s+/g, " "),
    crown: !!by(1).querySelector(".podium-crown"),
    tall: h(by(1)) > h(by(2)) && h(by(2)) > h(by(3)),
    seq: delay(by(3)) < delay(by(2)) && delay(by(2)) < delay(by(1)),
  };
});
check("Podium: tartib 2 · 1 · 3, 1-o'rinda toj, poydevorlar 1 > 2 > 3", pod.order === "213" && pod.crown && pod.tall, JSON.stringify(pod));
check("Podium: 1-o'rin — eng uzun joriy seriya (40) olov bilan", pod.first.includes("40"), pod.first);
check("O'rinlar ketma-ket chiqadi: 3 → 2 → 1", pod.seq);
// Mushakbozlik — 1-o'rin chiqqach canvas'da uchqunlar paydo bo'ladi
await page.waitForTimeout(3200);
const lit = await page.evaluate(() => {
  const c = document.querySelector('[data-testid="fireworks"]');
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
  return n;
});
check("1-o'rin ustida mushakbozlik (canvas'da uchqunlar)", lit > 30, `${lit} px`);
await page.screenshot({ path: OUT + "85-leaderboard.png", fullPage: true });

// Barcha o'lchamlar (yorug' va qorong'i): podium sig'adi, ismlar qisqartiriladi, toshish yo'q
for (const theme of ["light", "dark"]) {
  await page.evaluate((t) => localStorage.setItem("a365.theme", t), theme);
  for (const [w, h] of [[320, 700], [360, 760], [390, 844], [768, 1024], [1280, 800], [1440, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.reload();
    await page.waitForSelector('[data-testid="podium"]', { timeout: 10000 });
    await page.waitForTimeout(2400);
    const g = await page.evaluate(() => {
      const pod = document.querySelector('[data-testid="podium"]').getBoundingClientRect();
      const places = [...document.querySelectorAll('[data-testid="podium-place"]')].map((p) => p.getBoundingClientRect());
      const names = [...document.querySelectorAll(".podium-name")].every((n) => n.scrollWidth <= n.parentElement.getBoundingClientRect().width + 1);
      const overlap = places.some((a, i) => places.some((b, j) => i < j && a.right > b.left + 1 && b.right > a.left + 1));
      return { inside: places.every((r) => r.left >= pod.left - 0.5 && r.right <= pod.right + 0.5), names, overlap, sw: document.documentElement.scrollWidth - innerWidth };
    });
    check(`${theme} ${w}px: podium sig'adi, o'rinlar ustma-ust emas, toshish yo'q`, g.inside && g.names && !g.overlap && g.sw <= 1, JSON.stringify(g));
    if ([360, 1440].includes(w)) await page.screenshot({ path: OUT + `86-leaderboard-${theme}-${w}.png`, fullPage: w === 360 });
  }
}
await page.evaluate(() => localStorage.setItem("a365.theme", "light"));
// Harakatni kamaytirish — darhol va harakatsiz, mushakbozliksiz
{
  const rm = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce", storageState: await page.context().storageState() });
  const p2 = await rm.newPage();
  await p2.goto(`${BASE}/leaderboard`);
  await p2.waitForSelector('[data-testid="podium"]', { timeout: 10000 });
  await p2.waitForTimeout(2500);
  const r = await p2.evaluate(() => {
    const c = document.querySelector('[data-testid="fireworks"]');
    const d = c.getContext("2d").getImageData(0, 0, Math.max(1, c.width), Math.max(1, c.height)).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return { anims: document.querySelector('[data-testid="podium"]').getAnimations({ subtree: true }).length, lit: n };
  });
  check("prefers-reduced-motion: podium darhol, harakatsiz, mushakbozliksiz", r.anims === 0 && r.lit === 0, JSON.stringify(r));
  await rm.close();
}
await page.setViewportSize({ width: 360, height: 760 });

// 59: telefonda olovcha header'da ko'rinadi (avval ≤ 700 px da yashirilgan edi); eng og'ir holat — 3 xonali seriya
await fetch(`${API_HOST}/__seed-streak?user=${USER_ID}&current=123&longest=123&total=130`);
for (const w of [320, 360, 390, 430]) {
  await page.setViewportSize({ width: w, height: 760 });
  await page.goto(`${BASE}/catalog`);
  await page.waitForFunction(() => document.querySelector('[data-testid="streak-chip"]')?.textContent?.includes("123"), null, { timeout: 10000 });
  const g = await page.evaluate(() => {
    const vis = (el) => el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
    const chipEl = document.querySelector('[data-testid="streak-chip"]');
    const c = chipEl.getBoundingClientRect();
    const brand = document.querySelector('[data-testid="header-brand"]').getBoundingClientRect();
    const actions = [...document.querySelector(".client-actions").children].filter(vis).map((e) => e.getBoundingClientRect());
    return { chipVisible: vis(chipEl) && c.left >= 0 && c.right <= innerWidth, gap: Math.round(Math.min(...actions.map((r) => r.left)) - brand.right), sw: document.documentElement.scrollWidth - innerWidth };
  });
  // gap — logo va birinchi tugma orasi (header grid oralig'i 6 px — kamida shuncha)
  check(`${w}px: header'da olovcha (123) ko'rinadi, logo bilan ustma-ust emas, toshish yo'q`, g.chipVisible && g.gap >= 6 && g.sw <= 1, JSON.stringify(g));
}
await page.screenshot({ path: OUT + "87-streak-header-320.png", clip: { x: 0, y: 0, width: 430, height: 70 } });

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
