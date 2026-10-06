// 58 — ko'p satrli belgilash: tanlangan matnda satrlar orasida bo'sh joy (pdf.js matn qatlamida satr oxiri `<br>`,
// `Range.toString()` uni tashlab, so'zlarni yopishtirardi: "tertoabrokenheart"); qo'shni satrlar ramkalari ustma-ust
// tushmaydi (yarim shaffof ikki qatlam quyuq chiziq bermasin).
import { launch, BASE, reset, mockGet, ignorablePageError } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-highlight-lines-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });

await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
await page.goto(`${BASE}/reader/${ART}`);
await page.waitForFunction(() => document.querySelectorAll('[data-page="1"] .textLayer span').length > 5 && document.querySelector('[data-page="1"] canvas')?.width > 0, null, { timeout: 30000 });
await page.waitForTimeout(500);

// "Line 1 …" satrining o'rtasidan "Line 2 …" satrining o'rtasigacha sudrab belgilash
const box = await page.evaluate(() => {
  const sp = [...document.querySelectorAll('[data-page="1"] .textLayer span')];
  const l1 = sp.find((s) => s.textContent.startsWith("Line 1 of page 1")).getBoundingClientRect();
  const l2 = sp.find((s) => s.textContent.startsWith("Line 2 of page 1")).getBoundingClientRect();
  return { x1: l1.left + l1.width * 0.55, y1: l1.top + l1.height / 2, x2: l2.left + l2.width * 0.3, y2: l2.top + l2.height / 2 };
});
await page.mouse.move(box.x1, box.y1);
await page.mouse.down();
for (let i = 1; i <= 8; i++) {
  await page.mouse.move(box.x1 + ((box.x2 - box.x1) * i) / 8, box.y1 + ((box.y2 - box.y1) * i) / 8);
  await page.waitForTimeout(16);
}
await page.mouse.up();
await page.locator('button[aria-label="Yashil rang bilan belgilash"]').click();
await page.waitForSelector('[data-page="1"] .highlightLayer > div', { timeout: 5000 });
const ann = (await mockGet("/__annotations")).at(-1);
const txt = ann?.selected_text ?? "";
check("Ikki satrli matn: satrlar orasida bo'sh joy ('text. Line 2')", /text\. Line 2/.test(txt) && !/text\.Line/.test(txt), JSON.stringify(txt));
const rs = ann?.location_data?.rects ?? [];
const sorted = [...rs].sort((a, b) => a[1] - b[1]);
const overlap = sorted.some((r, i) => i > 0 && sorted[i - 1][1] + sorted[i - 1][3] > r[1] + 0.0001);
check("Ramkalar: 2 satr, ustma-ust emas", rs.length === 2 && !overlap, JSON.stringify(rs));

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
