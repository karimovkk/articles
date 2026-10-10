// 84: mavzu almashganda (yorug' ↔ qorong'i) hech narsa siljimaydi — sahifa sarlavhasi va katalog hero'si ikkala
// mavzuda bir xil o'lchamda (yorug' mavzudagi oq tasma — joylashuvga ta'sir qilmaydigan ::before qatlami).
// Yuklanish/animatsiya tufayli o'zgaradigan elementlar (bir mavzuda ikki o'lchov farqi) hisobga olinmaydi.
import { launch, BASE, API_HOST, makeCheck } from "../lib.mjs";
const { check, done } = makeCheck();
await fetch(`${API_HOST}/__seed-streak?leaders=25`);
const browser = await launch();
const userPages = ["/daily", "/catalog", "/library", "/leaderboard", "/profile", "/notifications", "/vocabulary", "/cart"];

for (const [W, who] of [[1440, "user"], [390, "user"], [1440, "guest"], [390, "guest"]]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 900 } });
  const page = await ctx.newPage();
  if (who === "user") {
    await page.goto(`${BASE}/login`);
    await page.fill('input[autocomplete="username"]', "user@articles365.local");
    await page.fill('input[type="password"]', "User12345!");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
  }
  for (const path of who === "user" ? userPages : ["/daily", "/catalog", "/login"]) {
    await page.goto(`${BASE}${path}`);
    await page.waitForTimeout(2000);
    const snap = () =>
      page.evaluate(() => {
        const out = {};
        const key = (el) => {
          const p = [];
          while (el && el !== document.body) {
            p.unshift(`${el.tagName}${el.parentElement ? [...el.parentElement.children].indexOf(el) : 0}`);
            el = el.parentElement;
          }
          return p.join(">");
        };
        for (const root of document.querySelectorAll("main, header, aside")) {
          root.querySelectorAll("*").forEach((el) => {
            if (el.closest("svg, .bb-stage, .globe-orbit, .aurora, .rev-chart, .reader-page, .podium-person")) return;
            const r = el.getBoundingClientRect();
            if (r.width && r.height) out[key(el)] = [Math.round(r.top + scrollY), Math.round(r.height), Math.round(r.left), Math.round(r.width)].join();
          });
        }
        return out;
      });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    await page.waitForTimeout(1200);
    const a0 = await snap();
    await page.waitForTimeout(700);
    const a = await snap();
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.waitForTimeout(400);
    const b = await snap();
    const moved = Object.keys(a).filter((k) => a0[k] === a[k] && b[k] && b[k] !== a[k]);
    check(`${who} ${W}px ${path}: yorug' → qorong'i — hech narsa siljimadi`, moved.length === 0, moved.slice(0, 3).map((k) => `${k.split(">").slice(-3).join(">")} ${a[k]} → ${b[k]}`).join(" | "));
  }
  await ctx.close();
}
await done(browser);
