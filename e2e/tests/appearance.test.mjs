// 44.8 — Global ko'rinish: admin "Ko'rinish" sahifasi — asosiy rang (oldindan ko'rish → saqlash → hammaga), avtomatik
// tugma matni va kontrast ogohlantirishi, yorug' fon rangi, tizim shrifti, xavfsiz bo'lmagan rasm havolasi rad
// etiladi; boshqa foydalanuvchi (login sahifasi ham) yangi ko'rinishni oladi, qayta ochilganda keshdan birinchi
// chizishdanoq; "Standartga qaytarish" — DELETE va eski ko'rinish.
import { launch, BASE, reset, mockGet, ignorablePageError } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const pageErrors = [];
const newPage = async (theme = "light") => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  await ctx.addInitScript((t) => localStorage.setItem("a365.theme", t), theme);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
  return p;
};
const accent = (p) => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().toLowerCase());
const admin = await newPage();
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await admin.screenshot({ path: OUT + "99-appearance-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });

await admin.goto(`${BASE}/login`);
check("Standart: --accent #f2b705", (await accent(admin)) === "#f2b705");
await admin.fill('input[autocomplete="username"]', "admin@articles365.local");
await admin.fill('input[type="password"]', "Admin12345!");
await admin.click('button[type="submit"]');
await admin.waitForURL(`${BASE}/library`, { timeout: 30000 });
await admin.goto(`${BASE}/admin`);
await admin.click('a[href="/admin/appearance"]');
await admin.waitForSelector('[data-testid="appearance-page"] [data-testid="appearance-preset"]', { timeout: 15000 });
check("Menyu: 'Ko'rinish' → /admin/appearance", admin.url().endsWith("/admin/appearance"));

// Oldindan ko'rish (saqlanmaguncha faqat shu brauzerda)
await admin.locator('[data-testid="appearance-preset"][aria-label="#2563eb"]').click();
await admin.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().toLowerCase() === "#2563eb", null, { timeout: 5000 });
check("Oldindan ko'rish: --accent darhol #2563eb, server o'zgarmagan", Object.keys(await mockGet("/__app-settings")).length === 0);
check("Tugma matni avtomatik oq (ko'k fonda)", (await admin.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent-contrast").trim().toLowerCase())) === "#ffffff");

// Past kontrastli rang — ogohlantirish
await admin.fill('[data-testid="appearance-primary"]', "#6366f1");
await admin.waitForSelector('[data-testid="contrast-warn"]', { timeout: 3000 });
check("Past kontrast (#6366f1 → 4.5:1 dan kam): ogohlantirish", true);
await admin.locator('[data-testid="appearance-preset"][aria-label="#2563eb"]').click();

// Yorug' fon — rang; shrift — tizim; xavfsiz bo'lmagan rasm havolasi
await admin.click('[data-testid="bg-dark-image"]');
await admin.fill('[data-testid="bg-dark-url"]', 'https://x.test/a.jpg")}body{');
check("Xavfsiz bo'lmagan havola: ogohlantirish", (await admin.locator("text=https:// bilan boshlanadigan").count()) === 1);
await admin.click('[data-testid="bg-dark-default"]');
await admin.click('[data-testid="bg-light-color"]');
await admin.locator('[data-testid="bg-light"] input.font-mono').fill("#eef2ff");
await admin.click('[data-testid="appearance-font"] button:has-text("Tizim shrifti")');
await admin.screenshot({ path: OUT + "87-admin-appearance.png", fullPage: true });
await admin.click('[data-testid="appearance-save"]');
await admin.waitForSelector("text=Saqlandi", { timeout: 5000 });
const st = (await mockGet("/__app-settings")).appearance;
check("Saqlandi: rang, yorug' fon, standart qorong'i fon, tizim shrifti", st?.primary_color === "#2563eb" && st?.background_light === "#eef2ff" && st?.background_dark === "default" && st?.font === "system", JSON.stringify(st));

// Boshqa foydalanuvchi — login sahifasidan boshlab yangi ko'rinish
const guest = await newPage();
await guest.goto(`${BASE}/login`);
await guest.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().toLowerCase() === "#2563eb", null, { timeout: 10000 });
check("Mehmon (login sahifasi): yangi asosiy rang", true);
check("Tizim shrifti qo'llandi", (await guest.evaluate(() => getComputedStyle(document.body).fontFamily)).includes("system-ui"));
await guest.goto(`${BASE}/catalog`);
await guest.waitForSelector('[data-testid="book-card"]', { timeout: 20000 });
await guest.waitForTimeout(500);
const bg = await guest.evaluate(() => getComputedStyle(document.querySelector(".client-bg"), "::before").backgroundColor);
check("Katalog: yorug' fon rangi (#eef2ff)", bg === "rgb(238, 242, 255)", bg);
// Qorong'i mavzu — rang qorong'i fonga moslashtirilgan
const dark = await newPage("dark");
await dark.goto(`${BASE}/catalog`);
await dark.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().toLowerCase() !== "#f2b705", null, { timeout: 10000 });
const da = await accent(dark);
check("Qorong'i mavzu: aksent ochroq varianti (qorong'i fonda o'qiladi)", da !== "#2563eb" && da.startsWith("#"), da);
// Qayta ochish — keshdan birinchi chizishdanoq (sozlama so'rovi kechiksa ham)
await guest.route("**/api/v1/app-settings", async (r) => { await new Promise((x) => setTimeout(x, 3000)); await r.continue(); });
await guest.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
check("Qayta ochilganda keshdan darhol (server javobini kutmasdan)", (await accent(guest)) === "#2563eb");
await guest.unroute("**/api/v1/app-settings");

// Standartga qaytarish
await admin.click('[data-testid="appearance-reset"]');
await admin.waitForSelector("text=Standart ko'rinish tiklandi", { timeout: 5000 });
check("Qaytarish: server kaliti o'chdi, --accent #f2b705", !("appearance" in (await mockGet("/__app-settings"))) && (await accent(admin)) === "#f2b705");

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
