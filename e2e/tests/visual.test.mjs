// 9.8 — vizual o'tish: barcha sahifalar × (360px, 1280px) × (kunduzgi, tungi): gorizontal scroll yo'q, skrinshotlar e2e/out/visual/
import { launch, BASE, reset } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const BOOK = "11111111-1111-4111-8111-111111111111", ART1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", USER_ID = "u1u1u1u1-u1u1-4u1u-8u1u-u1u1u1u1u1u1";
const OUT = new URL("../out/visual/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");
const browser = await launch();
const PAGES = {
  guest: ["/login", "/register", "/catalog", `/catalog/${BOOK}`],
  user: ["/library", `/books/${BOOK}`, "/profile", "/notifications", `/reader/${ART1}`],
  admin: ["/admin", "/admin/books", `/admin/books/${BOOK}`, "/admin/users", `/admin/users/${USER_ID}`, "/admin/access", "/admin/orders", "/admin/categories", "/admin/audit-logs"],
};
const creds = { user: ["user@articles365.local", "User12345!"], admin: ["admin@articles365.local", "Admin12345!"] };
const problems = [];
for (const [role, paths] of Object.entries(PAGES)) {
  for (const width of [360, 1280]) {
    for (const theme of ["light", "dark"]) {
      const ctx = await browser.newContext({ viewport: { width, height: width === 360 ? 740 : 800 }, colorScheme: theme });
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", (e) => errs.push(e.message));
      if (role !== "guest") {
        await page.goto(`${BASE}/login`);
        await page.fill('input[autocomplete="username"]', creds[role][0]);
        await page.fill('input[type="password"]', creds[role][1]);
        await page.click('button[type="submit"]');
        await page.waitForURL(`${BASE}/library`);
      }
      for (const path of paths) {
        // uzoq to'plamdan keyin dev server sekinlashishi mumkin — kengroq timeout, DOM tayyor bo'lishi kifoya
        await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
        await page.waitForTimeout(path.startsWith("/reader") ? 3000 : 600);
        const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, blank: document.body.innerText.trim().length < 10 }));
        const tag = `${role}${path.replace(/[^a-z0-9]+/gi, "_")}-${width}-${theme}`;
        await page.screenshot({ path: `${OUT}${tag}.png`, fullPage: !path.startsWith("/reader") });
        if (m.sw > m.iw + 1) problems.push(`${tag}: gorizontal scroll (${m.sw} > ${m.iw})`);
        if (m.blank) problems.push(`${tag}: bo'sh sahifa`);
      }
      if (errs.length) problems.push(`${role}-${width}-${theme}: xato ${errs[0].slice(0, 80)}`);
      await ctx.close();
    }
  }
}
const total = Object.values(PAGES).flat().length * 4;
check(`${total} ta sahifa ko'rinishi: gorizontal scroll yo'q, bo'sh sahifa yo'q, xato yo'q`, problems.length === 0, problems.join(" | "));
await browser.close();
console.log(`Skrinshotlar: ${OUT}`);
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
