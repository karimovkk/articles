// 61 / 62 — Belgilash ustiga belgilash qo'yilmaydi (kesishsa birlashadi, ichidagi qism — faqat rang); internetsiz
// belgilash, xatcho'p, eslatma: darhol ko'rinadi, qurilmadagi navbatda saqlanadi, internet qaytganda orqa fonda
// yuboriladi (yuborilmagan yaratish o'chirilsa — serverga bormaydi; vaqtinchalik id → server id); sahifa yopilsa ham
// navbat saqlanadi va ilova keyingi ochilganda yuboriladi.
import { launch, BASE, reset, mockGet, ignorablePageError } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
let page = await ctx.newPage();
const pageErrors = [];
const watch = (p) => p.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
watch(page);
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-annotations-offline-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });

const hl = async () => (await mockGet("/__annotations")).filter((a) => a.type === "HIGHLIGHT");
const openReader = async (p) => {
  await p.goto(`${BASE}/reader/${ART}`);
  await p.waitForFunction(() => document.querySelectorAll('[data-page="1"] .textLayer span').length > 5 && document.querySelector('[data-page="1"] canvas')?.width > 0, null, { timeout: 30000 });
  await p.waitForTimeout(400);
};
/** So'z(lar)ning ekrandagi o'rni — matn qatlamidagi birinchi satrdan */
const wordBox = (p, w) =>
  p.evaluate((word) => {
    const sp = [...document.querySelectorAll('[data-page="1"] .textLayer span')].find((s) => s.textContent.includes("quick brown fox"));
    const node = sp.firstChild;
    const i = node.data.indexOf(word);
    const r = document.createRange();
    r.setStart(node, i);
    r.setEnd(node, i + word.length);
    const b = r.getBoundingClientRect();
    return { x1: b.left + 1, x2: b.right - 1, y: b.top + b.height / 2 };
  }, w);
const select = async (p, from, to) => {
  const a = await wordBox(p, from), b = await wordBox(p, to);
  await p.mouse.move(a.x1, a.y);
  await p.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await p.mouse.move(a.x1 + ((b.x2 - a.x1) * i) / 8, a.y);
    await p.waitForTimeout(16);
  }
  await p.mouse.up();
  await p.waitForTimeout(150);
};
const paint = (p, color) => p.locator(`button[aria-label="${color} rang bilan belgilash"]`).click();
const layerCount = (p) => p.locator('[data-page="1"] .highlightLayer > div').count();
const settle = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 200)); } return false; };

await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
await openReader(page);

// ---- 61: "quick" → keyin "quick brown" — ustma-ust emas, bitta belgilash
await select(page, "quick", "quick");
await paint(page, "Yashil");
await settle(async () => (await hl()).length === 1);
const first = (await hl())[0];
check("1-belgilash: 'quick' (serverda)", first?.selected_text === "quick", JSON.stringify(first?.selected_text));
await select(page, "quick", "brown");
await paint(page, "Ko'k");
await settle(async () => { const h = await hl(); return h.length === 1 && h[0].id !== first.id; });
let h = await hl();
check("'quick brown' → bitta belgilash (eskisi o'chdi), matn takrorsiz, yangi rang", h.length === 1 && h[0].id !== first.id && h[0].selected_text === "quick brown" && h[0].color === "#93c5fd", JSON.stringify(h.map((x) => [x.selected_text, x.color])));
check("Ekranda bitta qatlam (ustma-ust emas)", (await layerCount(page)) === 1, String(await layerCount(page)));
// Ichidagi qism — yangi qatlam emas, faqat rang
await select(page, "brown", "brown");
await paint(page, "Yashil");
await settle(async () => (await hl())[0]?.color === "#86efac");
h = await hl();
check("Ichidagi 'brown' tanlandi → yangi belgilash yo'q, rangi yangilandi", h.length === 1 && h[0].color === "#86efac" && (await layerCount(page)) === 1, JSON.stringify(h.map((x) => [x.selected_text, x.color])));
// Qisman kesishish: "brown fox" → "quick brown fox"
await select(page, "brown", "fox");
await paint(page, "Yashil");
await settle(async () => (await hl())[0]?.selected_text === "quick brown fox");
h = await hl();
check("'brown fox' qisman kesishdi → 'quick brown fox' (bitta)", h.length === 1 && h[0].selected_text === "quick brown fox", JSON.stringify(h.map((x) => x.selected_text)));
await page.screenshot({ path: OUT + "92-highlight-merge.png", clip: { x: 300, y: 80, width: 900, height: 200 } });

// ---- Server javobi kechiksa: yangi belgilash bosilib menyu ochilgan bo'lsa ham id almashganda yopilmaydi, o'chirish ishlaydi
await page.route("**/api/v1/articles/*/annotations", async (r) => { if (r.request().method() === "POST") await new Promise((x) => setTimeout(x, 1500)); await r.continue(); });
await select(page, "over", "the");
await paint(page, "Yashil");
// Aynan yangi belgilash ("over") ustidan — server javobi hali kelmagan (vaqtinchalik id)
const ob = await wordBox(page, "over");
await page.mouse.click((ob.x1 + ob.x2) / 2, ob.y);
await page.waitForSelector('[data-testid="highlight-menu"]', { timeout: 5000 });
await settle(async () => (await hl()).some((a) => a.selected_text === "over the"), 6000); // id endi server id
await page.waitForTimeout(300);
check("Server javobidan keyin ham menyu ochiq (id almashdi)", (await page.locator('[data-testid="highlight-delete"]').count()) === 1);
const others = (await hl()).filter((a) => a.selected_text !== "over the").length;
await page.click('[data-testid="highlight-delete"]');
await settle(async () => !(await hl()).some((a) => a.selected_text === "over the"));
check("Menyu orqali o'chirildi → serverda yo'q, boshqa belgilashlar joyida", !(await hl()).some((a) => a.selected_text === "over the") && (await hl()).length === others);
await page.unroute("**/api/v1/articles/*/annotations");

// ---- 62: internetsiz — belgilash, xatcho'p, eslatma
await ctx.setOffline(true);
const before = (await mockGet("/__annotations")).length;
await select(page, "lazy", "dog.");
await paint(page, "Yashil");
check("Internetsiz: belgilash darhol ko'rindi (2 qatlam)", (await layerCount(page)) === 2);
await page.click('button[aria-label="Panel"]');
await page.click('[role="tab"]:has-text("Xatcho\'plar")');
await page.click("text=xatcho'p qo'shish");
await page.waitForSelector("text=xatcho'p qo'shish", { timeout: 3000 });
await page.click('[role="tab"]:has-text("Eslatmalar")');
await page.fill('textarea[placeholder$="eslatma…"]', "Internetsiz eslatma");
await page.click('button:has-text("Eslatma qo\'shish")');
await page.waitForSelector("text=Internetsiz eslatma", { timeout: 3000 });
await page.waitForSelector('[data-testid="sync-pill"]', { timeout: 3000 });
check("Holat belgisi: 'Internet yo'q', 3 ta o'zgarish qurilmada", ((await page.textContent('[data-testid="sync-pill"]')) ?? "").includes("Internet yo'q") && (await page.getAttribute('[data-testid="sync-pill"]', "data-pending")) === "3");
check("Server o'zgarmadi (hali yuborilmagan)", (await mockGet("/__annotations")).length === before);
await page.screenshot({ path: OUT + "93-offline-annotations.png" });
// Yuborilmagan xatcho'pni o'chirish — serverga umuman bormaydi
await page.click('[role="tab"]:has-text("Xatcho\'plar")');
await page.locator('[role="tabpanel"], .reader-sidebar, aside').locator('button[aria-label="O\'chirish"], button:has-text("O\'chirish")').first().click().catch(async () => {
  await page.locator("button", { hasText: "O'chirish" }).first().click();
});
await settle(async () => (await page.getAttribute('[data-testid="sync-pill"]', "data-pending")) === "2", 3000);
check("Yuborilmagan xatcho'p o'chirildi → navbatda 2 ta", (await page.getAttribute('[data-testid="sync-pill"]', "data-pending")) === "2");

// Internet qaytdi → orqa fonda yuboriladi
await ctx.setOffline(false);
const synced = await settle(async () => {
  const all = await mockGet("/__annotations");
  return all.some((a) => a.type === "NOTE" && a.note_text === "Internetsiz eslatma") && all.filter((a) => a.type === "HIGHLIGHT").length === 2;
}, 15000);
const all = await mockGet("/__annotations");
check("Internet qaytdi → belgilash va eslatma serverga yuborildi; o'chirilgan xatcho'p yuborilmadi", synced && !all.some((a) => a.type === "BOOKMARK"), JSON.stringify(all.map((a) => a.type)));
await page.waitForSelector('[data-testid="sync-pill"]', { state: "detached", timeout: 8000 });
check("Holat belgisi yo'qoldi (navbat bo'sh)", true);
// Server id bilan o'chirish (vaqtinchalik id almashgan)
const note = all.find((a) => a.type === "NOTE");
await page.click('[role="tab"]:has-text("Eslatmalar")');
await page.locator("li", { hasText: "Internetsiz eslatma" }).locator("button", { hasText: "O'chirish" }).click();
await settle(async () => !(await mockGet("/__annotations")).some((a) => a.id === note.id));
check("Sinxronlangan eslatma o'chirildi → DELETE server id bilan", !(await mockGet("/__annotations")).some((a) => a.id === note.id) && (await mockGet("/__log")).includes(`DELETE /articles/${ART}/annotations/${note.id}`));

// ---- Sahifa yopilsa ham navbat saqlanadi → ilova keyingi ochilganda yuboriladi
await ctx.setOffline(true);
await select(page, "jumps", "over");
await paint(page, "Yashil");
await page.waitForSelector('[data-testid="sync-pill"]', { timeout: 3000 });
const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("a365.ann.outbox.")).map((k) => JSON.parse(localStorage.getItem(k)).length));
check("Navbat qurilmada (localStorage) saqlandi", stored[0] === 1, JSON.stringify(stored));
await page.close();
await ctx.setOffline(false);
page = await ctx.newPage();
watch(page);
await page.goto(`${BASE}/library`);
const later = await settle(async () => (await hl()).some((a) => a.selected_text === "jumps over"), 15000);
check("Sahifa yopilgan edi → ilova qayta ochilganda (kutubxona) yuborildi", later);

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
