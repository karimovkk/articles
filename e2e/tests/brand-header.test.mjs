// 77: navbar logotipi — "Articles" (sarlavha shrifti) + oltin "365" (yaltiraydi), kun nishoni (tirik nuqta, yil
// progressi). Har kenglikda (320–1920, mehmon va kirgan foydalanuvchi) logo, kun nishoni va tugmalar ustma-ust
// tushmaydi, sahifa toshmaydi.
import { launch, BASE, API_HOST, makeCheck } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
const { check, done } = makeCheck();
const browser = await launch();
await fetch(`${API_HOST}/__seed-streak?user=11111111-1111-4111-8111-111111111111&current=123&longest=123&total=130`).catch(() => {});
const widths = [320, 360, 390, 420, 439, 440, 520, 600, 601, 640, 641, 720, 767, 768, 768, 900, 1024, 1100, 1101, 1179, 1180, 1200, 1280, 1366, 1440, 1600, 1920];
for (const who of ["guest", "user"]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  if (who === "user") {
    await page.goto(`${BASE}/login`);
    await page.fill('input[autocomplete="username"]', "user@articles365.local");
    await page.fill('input[type="password"]', "User12345!");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
  }
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto(`${BASE}/daily`);
    await page.waitForSelector('[data-testid="book-card"]', { timeout: 20000 });
    await page.waitForTimeout(600);
    const g = await page.evaluate(() => {
      const vis = (el) => el && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden" && el.getBoundingClientRect().width > 0;
      const wrap = document.querySelector(".client-brand-wrap");
      const kids = [...wrap.querySelectorAll(".year-ring, .brand-word, .year-chip")].filter(vis).map((e) => e.getBoundingClientRect());
      const right = Math.max(...kids.map((r) => r.right));
      const left = Math.min(...kids.map((r) => r.left));
      const acts = [...document.querySelector(".client-actions").children].filter(vis).map((e) => e.getBoundingClientRect());
      const burger = document.querySelector(".client-burger");
      const bl = vis(burger) ? burger.getBoundingClientRect().right : 0;
      const word = document.querySelector(".brand-word");
      return { gapR: Math.round(Math.min(...acts.map((r) => r.left)) - right), gapL: Math.round(left - bl), word: vis(word), chip: vis(document.querySelector(".year-chip")), sw: document.documentElement.scrollWidth - innerWidth };
    });
    check(`${who === "guest" ? "Mehmon" : "Foydalanuvchi"} ${w}px: logo/kun nishoni tugmalarga tegmaydi, toshish yo'q`, g.gapR >= 6 && g.gapL >= 4 && g.sw <= 1, JSON.stringify(g));
    if (w === 1440 && who === "guest") {
      const st = await page.evaluate(() => {
        const main = document.querySelector(".brand-word .bw-main");
        const num = document.querySelector(".brand-word .bw-num");
        const cs = getComputedStyle(num);
        const chip = document.querySelector('[data-testid="year-day"]');
        const bar = chip.querySelector(".yc-bar").getBoundingClientRect().width / chip.getBoundingClientRect().width;
        return { font: getComputedStyle(main).fontFamily, italic: getComputedStyle(main).fontStyle, text: `${main.textContent}${num.textContent}`, clip: cs.backgroundClip || cs.webkitBackgroundClip, shine: document.getAnimations().some((a) => a.animationName === "brand-shine"), dot: !!chip.querySelector(".yc-dot"), bar, year: Number(getComputedStyle(chip).getPropertyValue("--year")) };
      });
      check("Logo: 'Articles' — sarlavha shrifti (kursiv), '365' — oltin gradient + yaltirash animatsiyasi", /playfair/i.test(st.font) && st.italic === "italic" && st.text === "Articles365" && st.clip === "text" && st.shine, JSON.stringify(st));
      check("Kun nishoni: tirik nuqta va yil progressi (chiziq = kun / jami)", st.dot && Math.abs(st.bar - st.year) < 0.03, `${st.bar.toFixed(3)} ~ ${st.year}`);
      await page.screenshot({ path: OUT + "99-brand-1440.png", clip: { x: 0, y: 0, width: 1440, height: 80 } });
      // 84: hover — logo kattalashmaydi/aylanmaydi (joyida), halqa nuri kuchayadi, yoy bir marta aylanadi, ostida chiziq
      const before = await page.evaluate(() => { const r = document.querySelector('[data-testid="header-brand"] .year-ring').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width)]; });
      await page.hover('[data-testid="header-brand"]');
      await page.waitForTimeout(450);
      const hv = await page.evaluate(() => {
        const ring = document.querySelector('[data-testid="header-brand"] .year-ring');
        const r = ring.getBoundingClientRect();
        const line = getComputedStyle(document.querySelector(".brand-word"), "::after").transform;
        return {
          box: [Math.round(r.left), Math.round(r.top), Math.round(r.width)],
          transform: getComputedStyle(ring).transform,
          glow: getComputedStyle(ring).boxShadow,
          sweep: document.querySelector(".ring-bulge").getAnimations().some((x) => x.animationName === "ring-bulge-hover"),
          line,
        };
      });
      check("Logo hover: kattalashish/aylanish yo'q, logo joyida", hv.transform === "none" && hv.box.join() === before.join(), JSON.stringify({ before, ...hv }));
      check("Logo hover: halqa nuri kuchaydi, oltin yoy aylanadi, nom ostida chiziq chiqdi", /rgb/.test(hv.glow) && hv.sweep && (hv.line === "none" || /matrix\(1, 0, 0, 1/.test(hv.line)), JSON.stringify(hv));
      await page.screenshot({ path: OUT + "99-brand-hover-1440.png", clip: { x: 520, y: 0, width: 420, height: 80 } });
      await page.mouse.move(5, 500);
    }
    if (w === 390) await page.screenshot({ path: OUT + `99-brand-390-${who}.png`, clip: { x: 0, y: 0, width: 390, height: 70 } });
  }
  await ctx.close();
}
await done(browser);
