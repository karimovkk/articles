// 44.3 — Suv belgisi tanlov bo'yicha: admin maqola ro'yxatida "Suv belgisi" kalitini o'chiradi → reader'da overlay ham,
// `/watermark` so'rovi ham yo'q; qayta yoqsa — ko'rinadi; tekin kitobda kalit o'chiq va bosilmaydi.
import { launch, BASE, reset, mockGet, ignorablePageError } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BOOK = "11111111-1111-4111-8111-111111111111";
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FREE_BOOK = "22222222-2222-4222-8222-000000000000";
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const pageErrors = [];
const login = async (email, pass) => {
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  p.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
  await p.goto(`${BASE}/login`);
  await p.fill('input[autocomplete="username"]', email);
  await p.fill('input[type="password"]', pass);
  await p.click('button[type="submit"]');
  await p.waitForURL(`${BASE}/library`, { timeout: 30000 });
  return p;
};
const admin = await login("admin@articles365.local", "Admin12345!");
const reader = await login("user@articles365.local", "User12345!");
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await admin.screenshot({ path: OUT + "99-watermark-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });

const openReader = async () => {
  const n = (await mockGet("/__log")).length;
  await reader.goto(`${BASE}/reader/${ART}`);
  await reader.waitForFunction(() => document.querySelector('[data-page="1"] canvas')?.width > 0, null, { timeout: 30000 });
  await reader.waitForTimeout(800);
  const log = (await mockGet("/__log")).slice(n);
  return { overlay: (await reader.locator("text=TRACE-42").count()) > 0, fetched: log.some((l) => l === `GET /reader/articles/${ART}/watermark`) };
};

let r = await openReader();
check("Standart: suv belgisi ko'rinadi (so'raldi)", r.overlay && r.fetched);

// Admin: kalitni o'chiradi
await admin.goto(`${BASE}/admin/books/${BOOK}`);
await admin.click('[data-testid="tab-articles"]').catch(() => undefined);
await admin.waitForSelector('[data-testid="article-watermark"]', { timeout: 15000 });
const sw = admin.locator('[data-testid="article-watermark"]').first();
check("Admin: maqolada 'Suv belgisi' kaliti yoqiq", (await sw.getAttribute("aria-checked")) === "true");
await sw.click();
await admin.waitForFunction(() => document.querySelector('[data-testid="article-watermark"]')?.getAttribute("aria-checked") === "false", null, { timeout: 8000 });
check("Admin: o'chirildi → server watermark_enabled=false", (await mockGet("/__articles")).find((a) => a.id === ART)?.watermark_enabled === false);
await admin.screenshot({ path: OUT + "81-admin-watermark-toggle.png" });

r = await openReader();
check("Reader: o'chirilgach overlay yo'q va /watermark so'ralmadi", !r.overlay && !r.fetched, JSON.stringify(r));

await admin.locator('[data-testid="article-watermark"]').first().click();
await admin.waitForFunction(() => document.querySelector('[data-testid="article-watermark"]')?.getAttribute("aria-checked") === "true", null, { timeout: 8000 });
r = await openReader();
check("Qayta yoqildi → suv belgisi yana ko'rinadi", r.overlay && r.fetched);

// Tekin kitob: kalit o'chiq va bosilmaydi
await admin.goto(`${BASE}/admin/books/${FREE_BOOK}`);
await admin.click('[data-testid="tab-articles"]').catch(() => undefined);
await admin.waitForSelector('[data-testid="article-watermark"]', { timeout: 15000 });
const fsw = admin.locator('[data-testid="article-watermark"]').first();
check("Tekin kitob: kalit o'chiq va bloklangan", (await fsw.getAttribute("aria-checked")) === "false" && (await fsw.isDisabled()));

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
