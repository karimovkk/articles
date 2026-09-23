// 27 — uzun matnlar kichik ekranlarda: API javoblaridagi email/ism/kitob nomi/kategoriya/bildirishnoma matnlari
// bo'shliqsiz uzun satrlarga almashtiriladi va har sahifada gorizontal scroll, ekrandan chiqqan yoki o'z qutisidan
// toshgan matn yo'qligi tekshiriladi. Dev'da 320/390, production'da (`--prod`) 320/360/390/430/768.
import { launch, BASE, API_HOST as API } from "../lib.mjs";
const ONLY = process.argv[2]; // ixtiyoriy: faqat shu yo'l (masalan /profile)
const BOOK = "11111111-1111-4111-8111-111111111111", ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", USER_ID = "u1u1u1u1-u1u1-4u1u-8u1u-u1u1u1u1u1u1";
const LONG = {
  email: "abdurahmonov.abdurahmon.juda.uzun.pochta.manzili2026@cognilabs-misol-domen.uz",
  full_name: "Abdurahmonov Abdurahmon Abdug'aniyevich-Karimovkamoliddinovich",
  title: "Zamonaviy dasturlash asoslari Bo'shliqsizJudaUzunKitobNomiReactNextjsTypeScriptTailwind",
  author: "Abdurahmonov-Karimovkamoliddinov Abdug'aniyevich",
  name: "Ilmiy-ommabop_adabiyot_vaZamonaviyTexnologiyalar",
  body: "Buyurtmangiz tasdiqlandi: https://articles-seven-tawny.vercel.app/books/11111111-1111-4111-8111-111111111111?manba=bildirishnoma",
  device_name: "Chrome_Linux_x86_64_JudaUzunQurilmaNomi_Abdurahmonning_noutbugi",
};
const MAP = { email: "email", user_email: "email", full_name: "full_name", user_full_name: "full_name", title: "title", book_title: "title", author: "author", name: "name", category_name: "name", body: "body", device_name: "device_name", user_agent: "device_name" };
const lengthen = (v) => {
  if (Array.isArray(v)) return v.map(lengthen);
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = typeof x === "string" && MAP[k] ? LONG[MAP[k]] : lengthen(x);
    return o;
  }
  return v;
};
const DEVICES = process.env.E2E_PROD ? [320, 360, 390, 430, 768] : [320, 390];
const PAGES = {
  guest: ["/login", "/register", "/catalog", `/catalog/${BOOK}`],
  user: ["/library", `/books/${BOOK}`, "/profile", "/notifications", `/reader/${ART}`],
  admin: ["/admin", "/admin/books", `/admin/books/${BOOK}`, "/admin/users", `/admin/users/${USER_ID}`, "/admin/access", "/admin/orders", "/admin/categories", "/admin/audit-logs"],
};
const creds = { user: ["user@articles365.local", "User12345!"], admin: ["admin@articles365.local", "Admin12345!"] };
await fetch(`${API}/__reset`).catch(() => {});
await fetch(`${API}/__notify?title=${encodeURIComponent(LONG.title)}&body=${encodeURIComponent(LONG.body)}`).catch(() => {});
const browser = await launch();
const problems = [];
let checked = 0;
for (const w of DEVICES) {
  for (const [role, paths] of Object.entries(PAGES)) {
    const todo = paths.filter((p) => !ONLY || p === ONLY);
    if (!todo.length) continue;
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: true, isMobile: true });
    await ctx.route("**/api/v1/**", async (route) => {
      if (route.request().method() !== "GET" || /\/(content|cover|file|receipt)(\?|$)/.test(route.request().url())) return route.continue();
      const r = await route.fetch();
      const ct = r.headers()["content-type"] ?? "";
      if (!ct.includes("json")) return route.fulfill({ response: r });
      let body = await r.json().catch(() => null);
      return route.fulfill({ response: r, json: lengthen(body) });
    });
    const page = await ctx.newPage();
    if (role !== "guest") {
      await page.goto(`${BASE}/login`);
      await page.fill('input[autocomplete="username"]', creds[role][0]);
      await page.fill('input[type="password"]', creds[role][1]);
      await page.click('button[type="submit"]');
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }).catch(() => {});
    }
    for (const path of todo) {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
      checked++;
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(900);
      const res = await page.evaluate(() => {
        const vw = window.innerWidth;
        const out = { scrollW: document.documentElement.scrollWidth, vw, out: [], spill: [] };
        const seen = new Set();
        const scroller = (el) => {
          for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
            const c = getComputedStyle(n);
            if (c.overflowX === "auto" || c.overflowX === "scroll") return true;
          }
          return false;
        };
        for (const el of document.querySelectorAll("body *")) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          if (el.closest(".textLayer, .pickLayer, [aria-hidden='true'] canvas")) continue;
          const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 3);
          if (!hasText) continue;
          const r = el.getBoundingClientRect();
          if (!r.width) continue;
          if (r.right <= 0) continue; // yopiq yon menyu (ekran chapidan tashqarida) — ko'rinmaydi
          if (/rotate-\[/.test(String(el.className))) continue; // qiya suv belgisi
          const txt = el.textContent.trim().slice(0, 36);
          const key = el.tagName + "." + String(el.className).slice(0, 50);
          // ekrandan chiqqan matn (gorizontal scroll qilinadigan jadval ichidagisi hisobga olinmaydi)
          if ((r.right > vw + 1 || r.left < -1) && !scroller(el) && !seen.has("o" + key)) {
            seen.add("o" + key);
            out.out.push(`${key} right=${Math.round(r.right)} "${txt}"`);
          }
          // o'z qutisidan toshgan matn (ellipsis bo'lmasa)
          if (el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== "ellipsis" && !scroller(el) && cs.display !== "inline" && !seen.has("s" + key)) {
            seen.add("s" + key);
            out.spill.push(`${key} ${el.scrollWidth}>${el.clientWidth} "${txt}"`);
          }
        }
        return out;
      });
      const issues = [];
      if (res.scrollW > res.vw + 1) issues.push(`GORIZONTAL SCROLL ${res.scrollW}>${res.vw}`);
      if (res.out.length) issues.push(...res.out.slice(0, 6).map((x) => "chekkadan chiqqan: " + x));
      if (res.spill.length) issues.push(...res.spill.slice(0, 6).map((x) => "qutidan toshgan: " + x));
      if (issues.length) problems.push({ w, path, issues });
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/long-${w}-${path.replace(/\W+/g, "_").slice(0, 40)}.png`, fullPage: true });
    }
    await ctx.close();
  }
}
await browser.close();
for (const p of problems) console.log(`❌ [${p.w}px] ${p.path}\n   - ${p.issues.join("\n   - ")}`);
console.log(`${problems.length ? "❌" : "✅"} Uzun matnlar: ${checked} ta sahifa×ekran — gorizontal scroll, ekrandan chiqqan va qutidan toshgan matn ${problems.length ? problems.length + " joyda" : "yo'q"}`);
console.log(problems.length ? `\n${problems.length} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(problems.length ? 1 : 0);
