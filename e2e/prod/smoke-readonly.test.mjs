// Task 7.1 — jonli backend (prod) bilan smoke: faqat o'qish (login/logout sessiyasi bundan mustasno)
import { launch } from "../lib.mjs";
import { mkdirSync } from "node:fs";

const BASE = process.env.E2E_BASE ?? "http://localhost:3200";
const EMAIL = process.env.A365_EMAIL;
const PASS = process.env.A365_PASS;
if (!EMAIL || !PASS) throw new Error("A365_EMAIL / A365_PASS env kerak");
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
const apiFails = [];
page.on("response", (r) => {
  if (r.url().includes("/api/v1/") && r.status() >= 400) apiFails.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
});
process.on("unhandledRejection", async (e) => {
  console.log("❌ XATO:", e.message.split("\n")[0]);
  await page.screenshot({ path: OUT + "99-prod71-failure.png" }).catch(() => {});
  await browser.close();
  process.exit(1);
});
const bodyHas = async (text) => page.evaluate((t) => document.body.innerText.replace(/ /g, " ").includes(t), text);

// ---- Public katalog (prod ma'lumotlari)
await page.goto(`${BASE}/catalog`);
await page.waitForSelector("text=Psychology", { timeout: 15000 });
check("Katalog: prod kitoblari, narx decimal string → '30 000 so'm'", (await bodyHas("30 000 so'm")) && (await bodyHas("Jurnal maqolalari")));
check("Katalog: article_count ko'rsatiladi", await bodyHas("1 ta maqola"));

// ---- Login (identifier + password)
await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', EMAIL);
await page.fill('input[type="password"]', "wrong-password");
await page.click('button[type="submit"]');
await page.waitForSelector("text=Login yoki parol noto'g'ri", { timeout: 15000 });
check("Login: noto'g'ri parol → INVALID_CREDENTIALS matni", true);
await page.fill('input[type="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`, { timeout: 15000 });
await page.waitForSelector("header", { timeout: 10000 });
check("Login OK → /library, header'da Admin", (await page.locator('header a[href="/admin"]').count()) > 0);

// ---- Kutubxona (tekis LibraryItem) — admin'da ruxsat yo'q → bo'sh holat
await page.waitForSelector("text=Kutubxonangiz bo'sh", { timeout: 15000 });
check("Kutubxona: bo'sh holat (ruxsat yo'q)", true);

// ---- Profil: sessiyalar (last_active_at, user_agent, bekor qilinganlar yashirin)
await page.goto(`${BASE}/profile`);
await page.waitForSelector("text=Sessiyalar va qurilmalar", { timeout: 15000 });
await page.waitForSelector("text=joriy", { timeout: 15000 });
const sessionRows = await page.locator("li:has-text('Bekor qilish')").count();
check("Profil: joriy sessiya (Chrome · Linux) ko'rinadi", await bodyHas("Chrome · Linux"));
check("Profil: bekor qilingan sessiyalar ro'yxatda yo'q (faqat faol)", sessionRows >= 1 && sessionRows <= 5, `rows=${sessionRows}`);
check("Profil: Administrator nomi", await bodyHas("Administrator"));
await page.screenshot({ path: OUT + "40-prod-profile.png" });

// ---- Admin dashboard (/admin/stats)
await page.goto(`${BASE}/admin`);
await page.waitForSelector("text=Faol sessiyalar", { timeout: 15000 });
check("Admin: stats plitkalari (Maqolalar, READY)", (await bodyHas("Maqolalar")) && (await bodyHas("READY:")));
check("Admin: fallback ogohlantirishi yo'q", !(await bodyHas("mavjud emas")));

// ---- Admin books (price, status, category)
await page.goto(`${BASE}/admin/books`);
await page.waitForSelector("text=Psychology", { timeout: 15000 });
check("Admin kitoblar: narx va ACTIVE", (await bodyHas("30 000 so'm")) && (await bodyHas("ACTIVE")));
await page.click("text=Psychology");
await page.waitForSelector("text=Maqolalar (1)", { timeout: 15000 });
check("Admin kitob: maqolalar ro'yxati (READY, 2 sahifa, PDF)", (await bodyHas("Why we should all be more selfish")) && (await bodyHas("READY")) && (await bodyHas("PDF ✓")));
check("Admin kitob: narx formada", (await page.inputValue('input[type="number"]')) === "30000");
await page.screenshot({ path: OUT + "41-prod-admin-book.png" });

// ---- Categories (status)
await page.goto(`${BASE}/admin/categories`);
await page.waitForSelector("text=Jurnal maqolalari", { timeout: 15000 });
check("Kategoriyalar: status → 'faol'", await bodyHas("faol"));

// ---- Audit (meta, action enum)
await page.goto(`${BASE}/admin/audit-logs`);
await page.waitForSelector("td:has-text(\"BOOK_\")", { timeout: 15000 });
check("Audit: action enum, meta JSON, IP", (await bodyHas("book_access")) && (await bodyHas("144.124")));
const optCount = await page.locator("select option").count();
check("Audit: action filtri select (19 amal)", optCount >= 19, `${optCount}`);

// ---- Users
await page.goto(`${BASE}/admin/users`);
await page.waitForSelector("text=admin@cognilabs.org", { timeout: 15000 });
check("Foydalanuvchilar ro'yxati (ADMIN, ACTIVE)", await bodyHas("ADMIN"));

// ---- Logout
await page.click("text=Chiqish");
await page.waitForURL((u) => u.pathname === "/login", { timeout: 15000 });
check("Logout → /login", true);

const unexpected = apiFails.filter((f) => !f.startsWith("401 POST /api/v1/auth/login") && !f.includes("/cover"));
check("Kutilmagan API xatolari yo'q", unexpected.length === 0, unexpected.join(" | "));
check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
