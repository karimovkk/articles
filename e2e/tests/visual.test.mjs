// 9.8 — vizual o'tish: barcha sahifalar × (360px, 1280px) × (kunduzgi, tungi): gorizontal scroll yo'q, skrinshotlar e2e/out/visual/
import { launch, BASE, reset, ignorablePageError } from "../lib.mjs";
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
  user: ["/library", `/books/${BOOK}`, "/profile", "/notifications", "/vocabulary", `/reader/${ART1}`],
  admin: ["/admin", "/admin/books", `/admin/books/${BOOK}`, "/admin/users", `/admin/users/${USER_ID}`, "/admin/access", "/admin/orders", "/admin/categories", "/admin/audit-logs"],
};
const creds = { user: ["user@articles365.local", "User12345!"], admin: ["admin@articles365.local", "Admin12345!"] };
const problems = [];
// Dev rejimida har marshrut birinchi murojaatda kompilyatsiya qilinadi — oldindan isitamiz
// (aks holda ko'p o'lchamli yurishda birinchi sahifa timeout'ga uchraydi)
for (const p of [...new Set(Object.values(PAGES).flat())]) await fetch(`${BASE}${p}`).catch(() => undefined);
for (const [role, paths] of Object.entries(PAGES)) {
  // 23.7: qurilmalar — telefon (320/360), planshet (768), kompyuter (1280), televizor (2560).
  // Dev rejimida har marshrut qayta kompilyatsiya qilinadi va bu juda sekin — to'liq ro'yxat `--prod` da.
  const WIDTHS = process.env.E2E_PROD ? [320, 360, 768, 1280, 2560] : [360, 1280];
  for (const width of WIDTHS) {
    // Har o'lchamda ikkala mavzu uzoq davom etadi: asosiylari (360/1280) ikkalasida, qolganlari yorug'da
    for (const theme of width === 360 || width === 1280 ? ["light", "dark"] : ["light"]) {
      const height = width <= 360 ? 640 : width === 768 ? 1024 : width === 2560 ? 1440 : 800;
      const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme, ...(width < 900 ? { hasTouch: true, isMobile: true } : {}) });
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", (e) => !ignorablePageError(e.message) && errs.push(e.message));
      if (role !== "guest") {
        await page.goto(`${BASE}/login`);
        await page.fill('input[autocomplete="username"]', creds[role][0]);
        await page.fill('input[type="password"]', creds[role][1]);
        await page.click('button[type="submit"]');
        await page.waitForURL(`${BASE}/library`);
      }
      for (const path of paths) {
        // uzoq to'plamdan keyin dev server sekinlashishi mumkin — kengroq timeout, DOM tayyor bo'lishi kifoya
        await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
        await page.waitForTimeout(path.startsWith("/reader") ? 3000 : 600);
        const m = await page.evaluate(() => {
          const vw = window.innerWidth;
          // Chekkadan chiqqan element (kesilmagan holda) — responsivlik buzilgani belgisi
          const clipped = (el) => {
            for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
              const c = getComputedStyle(n);
              if (["auto", "scroll", "hidden"].includes(c.overflowX) || ["auto", "hidden"].includes(c.overflow)) return true;
            }
            return false;
          };
          let over = null;
          for (const el of document.querySelectorAll("body *")) {
            const c = getComputedStyle(el);
            if (c.display === "none" || c.visibility === "hidden" || c.position === "fixed") continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || r.width > vw * 3) continue;
            if (r.right > vw + 2 && !clipped(el)) {
              over = `${el.tagName}.${(el.className?.toString?.() ?? "").slice(0, 30)} (${Math.round(r.right)}px)`;
              break;
            }
          }
          return { sw: document.documentElement.scrollWidth, iw: vw, blank: document.body.innerText.trim().length < 10, over };
        });
        const tag = `${role}${path.replace(/[^a-z0-9]+/gi, "_")}-${width}-${theme}`;
        await page.screenshot({ path: `${OUT}${tag}.png`, fullPage: !path.startsWith("/reader") });
        if (m.sw > m.iw + 1) problems.push(`${tag}: gorizontal scroll (${m.sw} > ${m.iw})`);
        if (m.blank) problems.push(`${tag}: bo'sh sahifa`);
        if (m.over) problems.push(`${tag}: chekkadan chiqdi — ${m.over}`);
      }
      if (errs.length) problems.push(`${role}-${width}-${theme}: xato ${errs[0].slice(0, 80)}`);
      await ctx.close();
    }
  }
}
const total = Object.values(PAGES).flat().length * (process.env.E2E_PROD ? 7 : 4);
check(`${total} ta sahifa ko'rinishi (telefon/planshet/kompyuter/televizor): scroll, bo'shlik, chekka va xato yo'q`, problems.length === 0, problems.join(" | ").slice(0, 400));
await browser.close();
console.log(`Skrinshotlar: ${OUT}`);
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
