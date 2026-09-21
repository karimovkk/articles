// Task 7.8 — PROD smoke (admin akkaunt): vaqtinchalik ruxsat → kutubxona → kitob → reader (Range, watermark,
// highlight, progress, mark-read) → admin sahifalar → TOZALASH (annotatsiya o'chiriladi, ruxsat bekor qilinadi)
import { launch } from "../lib.mjs";
import { mkdirSync } from "node:fs";

const BASE = process.env.E2E_BASE ?? "http://localhost:3200";
const API = "https://articles.api.cognilabs.org/api/v1";
const EMAIL = process.env.A365_EMAIL, PASS = process.env.A365_PASS;
if (!EMAIL || !PASS) throw new Error("A365_EMAIL / A365_PASS env kerak");
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };

// ---- API yordamchisi (tozalash uchun)
const login = await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: EMAIL, password: PASS, device_name: "smoke-cleanup" }) })).json();
const H = { Authorization: `Bearer ${login.access_token}`, "Content-Type": "application/json" };
const me = login.user.id;
// Eskirgan sessiyalarni tozalash (device limit 2) — o'z sessiyamizdan tashqari
for (const sess of await (await fetch(`${API}/sessions`, { headers: H })).json()) if (!sess.is_current && !sess.revoked_at) await fetch(`${API}/sessions/${sess.id}`, { method: "DELETE", headers: H });
// dev server'ni isitish (Turbopack birinchi kompilyatsiya)
for (const pth of ["/login", "/library", "/catalog"]) await fetch(`${BASE}${pth}`).catch(() => undefined);
const books = (await (await fetch(`${API}/admin/books?page_size=1`, { headers: H })).json()).items;
const BOOK = books[0].id;
const grant = await (await fetch(`${API}/admin/book-access`, { method: "POST", headers: H, body: JSON.stringify({ user_id: me, book_id: BOOK }) })).json();
console.log(`(prod) vaqtinchalik ruxsat: ${grant.id} → ${books[0].title}`);

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pageErrors = [], apiFails = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("response", (r) => { if (r.url().includes("/api/v1/") && r.status() >= 400) apiFails.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
let articleId = null;
async function cleanup() {
  try {
    if (articleId) {
      const anns = await (await fetch(`${API}/articles/${articleId}/annotations`, { headers: H })).json();
      for (const a of Array.isArray(anns) ? anns : []) await fetch(`${API}/articles/${articleId}/annotations/${a.id}`, { method: "DELETE", headers: H });
      await fetch(`${API}/articles/${articleId}/mark-read?is_read=false`, { method: "POST", headers: H });
      console.log(`(prod) tozalandi: ${Array.isArray(anns) ? anns.length : 0} ta annotatsiya, mark-read=false`);
    }
    const r = await fetch(`${API}/admin/book-access/${grant.id}/revoke`, { method: "POST", headers: H });
    console.log(`(prod) ruxsat bekor qilindi: ${r.status}`);
    await fetch(`${API}/auth/logout`, { method: "POST", headers: H, body: JSON.stringify({ refresh_token: login.refresh_token }) });
  } catch (e) { console.log("(prod) tozalashda xato:", e.message); }
}
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-prod78-failure.png" }).catch(() => {}); await cleanup(); await browser.close(); process.exit(1); });
const bodyHas = async (text) => page.evaluate((t) => document.body.innerText.replace(/ /g, " ").includes(t), text);

try {
  await page.goto(`${BASE}/login`);
  await page.fill('input[autocomplete="username"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/library`, { timeout: 45000 });

  // ---- Kutubxona → kitob
  await page.waitForSelector(`a[href="/books/${BOOK}"]`, { timeout: 45000 });
  check("Kutubxona: ruxsat berilgan kitob (0/1 maqola)", await bodyHas("0/1 maqola"));
  await page.click(`a[href="/books/${BOOK}"]`);
  await page.waitForSelector("text=Maqolalar (1)", { timeout: 45000 });
  check("Kitob sahifasi: sarlavha, maqola READY, 2 bet", (await bodyHas(books[0].title)) && (await bodyHas("2 bet")));
  const contBtn = page.locator('a.inline-flex[href^="/reader/"]').first();
  const contHref = await contBtn.getAttribute("href");
  articleId = contHref?.split("/reader/")[1] ?? null;
  check("Davom ettirish / O'qishni boshlash → maqola id", !!articleId, contHref);

  // ---- Reader (prod: Content-Range yo'q → 416 size workaround)
  await contBtn.click();
  await page.waitForURL(`${BASE}/reader/${articleId}`);
  await page.waitForFunction(() => document.querySelector('[data-page="1"] canvas')?.width > 0 && document.querySelectorAll('[data-page="1"] .textLayer span').length > 3, null, { timeout: 60000 });
  check("Reader: PDF Range bilan ochildi (prod, Content-Range'siz)", (await page.locator(".reader-page").count()) === 2);
  check("Watermark: backend watermark_text (user_ref + masked email)", await bodyHas("@cognilabs.org"));
  await page.screenshot({ path: OUT + "110-prod-reader.png" });

  // highlight → prod annotatsiya
  await page.evaluate(() => { const spans = [...document.querySelectorAll('[data-page="1"] .textLayer span')].filter((s) => s.textContent.trim().length > 3); const r = document.createRange(); r.setStart(spans[2].firstChild, 0); r.setEnd(spans[2].firstChild, spans[2].firstChild.length); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); document.querySelector('[data-page="1"]').dispatchEvent(new MouseEvent("mouseup", { bubbles: true })); });
  await page.locator('button[aria-label="Yashil rang bilan belgilash"]').click();
  await page.waitForSelector('[data-page="1"] .highlightLayer > div', { timeout: 10000 });
  const anns = await (await fetch(`${API}/articles/${articleId}/annotations`, { headers: H })).json();
  check("Highlight prod'da saqlandi (location_data.rects, selected_text, color)", anns.length === 1 && anns[0].location_data?.rects?.length >= 1 && anns[0].color === "#86efac" && !!anns[0].selected_text, JSON.stringify(anns[0]?.location_data));
  await page.reload();
  await page.waitForSelector('[data-page="1"] .highlightLayer > div', { timeout: 60000 });
  check("Reload: highlight prod'dan tiklandi", true);

  // qidiruv + mark-read + progress
  await page.click('button[title="Panel"]');
  await page.click("text=Qidiruv");
  await page.fill('input[placeholder="Kitob ichida qidirish…"]', "the");
  await page.press('input[placeholder="Kitob ichida qidirish…"]', "Enter");
  await page.waitForSelector("text=-bet", { timeout: 10000 });
  check("Qidiruv (prod tsvector): natijalar", (await page.locator("aside button.block").count()) >= 1);
  await page.click('button[aria-label="O\'qib bo\'lindi deb belgilash"]');
  await page.waitForSelector("text=Maqola o'qilgan deb belgilandi", { timeout: 10000 });
  const prog = await (await fetch(`${API}/articles/${articleId}/progress`, { headers: H })).json();
  check("Mark-read prod'da (is_read=true)", prog.is_read === true);
  await page.fill('input[aria-label="Sahifa"]', "2");
  await page.press('input[aria-label="Sahifa"]', "Enter");
  await page.waitForTimeout(2200);
  const prog2 = await (await fetch(`${API}/articles/${articleId}/progress`, { headers: H })).json();
  check("Progress prod'da (current_page=2, percentage=100)", prog2.current_page === 2 && Number(prog2.percentage) === 100, JSON.stringify({ p: prog2.current_page, pct: prog2.percentage }));

  // ---- Katalog: ruxsatsiz kitob → 'Buyurtma berish' (bosilmaydi — prod)
  const other = (await (await fetch(`${API}/catalog?page_size=2`)).json()).items.find((b) => b.book_id !== BOOK);
  await page.goto(`${BASE}/catalog/${other.book_id}`);
  await page.waitForSelector('button:has-text("Buyurtma berish")', { timeout: 45000 });
  check("Katalog: ruxsatsiz kitobda buyurtma tugmasi (bosilmadi)", true);

  // ---- Admin: buyurtmalar (bo'sh), kitob sahifasi maqolalar paneli, bildirishnomalar
  await page.goto(`${BASE}/admin/orders`);
  await page.waitForSelector("text=Buyurtmalar", { timeout: 45000 });
  await page.waitForFunction(() => document.body.innerText.includes("Ma'lumot yo'q") || document.body.innerText.includes("Jami"), null, { timeout: 45000 });
  check("Admin buyurtmalar sahifasi (prod)", true);
  await page.goto(`${BASE}/admin/books/${BOOK}`);
  await page.waitForSelector("text=Maqolalar (1)", { timeout: 45000 });
  check("Admin kitob: maqolalar paneli (PDF ✓, READY, TOC/tahrir tugmalari)", (await bodyHas("PDF ✓")) && (await page.locator('button:has-text("Mundarija")').count()) === 1);
  await page.goto(`${BASE}/notifications`);
  await page.waitForSelector("text=Bildirishnomalar", { timeout: 45000 });
  check("Bildirishnomalar sahifasi (prod)", true);
  await page.screenshot({ path: OUT + "111-prod-admin-book.png" });

  await page.click("text=Chiqish");
  await page.waitForURL((u) => u.pathname === "/login", { timeout: 45000 });
} finally {
  await cleanup();
}

const unexpected = apiFails.filter((f) => !f.includes("/cover") && !/^403 GET \/api\/v1\/reader\/books\/.*\/articles$/.test(f));
check("Kutilmagan API xatolari yo'q (416 size probe bundan mustasno)", unexpected.filter((f) => !f.startsWith("416")).length === 0, unexpected.join(" | "));
check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
