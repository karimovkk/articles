// Reader funksional tekshiruvi (Task 2): highlight, ranglar, nusxalash/chop etish cheklovi, varaqlash rejimi
import { launch, BASE, reset, mockGet } from "../lib.mjs";

const BOOK = "11111111-1111-4111-8111-111111111111";
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OUT = new URL("../out/", import.meta.url).pathname;
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));
const notFound = [];
page.on("response", (r) => r.status() === 404 && notFound.push(r.url()));

await reset("");
process.on("unhandledRejection", async (e) => {
  console.log("❌ XATO:", e.message.split("\n")[0]);
  try {
    await page.screenshot({ path: OUT + "99-failure.png" });
    console.log(await page.evaluate(() => ({ url: location.href, pageInput: document.querySelector('input[aria-label="Sahifa"]')?.value, active: document.activeElement?.tagName + "." + document.activeElement?.className.slice(0, 40), pages: document.querySelectorAll(".reader-page").length, scrollTop: document.querySelector(".reader-page")?.parentElement?.parentElement?.scrollTop })));
  } catch {}
  await browser.close();
  process.exit(1);
});

// ---- Login → kutubxona → reader
await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);
check("Login → /library", page.url().endsWith("/library"));
await page.click(`a[href="/books/${BOOK}"]`);
await page.waitForURL(`${BASE}/books/${BOOK}`);
await page.click(`a[href="/reader/${ART}"]`);
await page.waitForURL(`${BASE}/reader/${ART}`);

const waitRendered = async (n = 1) => {
  await page.waitForFunction(
    (n) => {
      const el = document.querySelector(`[data-page="${n}"]`);
      return el && el.querySelector("canvas")?.width > 0 && el.querySelectorAll(".textLayer span").length > 3;
    },
    n,
    { timeout: 20000 },
  );
};
await waitRendered(1);
const pageCount = await page.locator(".reader-page").count();
check("Scroll rejimi: 6 ta sahifa render konteynerida", pageCount === 6, `count=${pageCount}`);
check("Watermark ko'rinadi", (await page.locator("text=TRACE-42").count()) > 0);
await page.screenshot({ path: OUT + "01-reader.png" });

// ---- Matn tanlash → 8 rang paneli
const selectOnPage = async (n) => {
  await page.evaluate((n) => {
    const spans = [...document.querySelectorAll(`[data-page="${n}"] .textLayer span`)].filter((s) => s.textContent.trim());
    const r = document.createRange();
    r.setStart(spans[1].firstChild, 0);
    r.setEnd(spans[2].firstChild, spans[2].firstChild.length);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    document.querySelector(`[data-page="${n}"]`).dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }, n);
};
await selectOnPage(1);
const swatches = page.locator('button[aria-label$="rang bilan belgilash"]');
await swatches.first().waitFor({ timeout: 5000 });
const swatchCount = await swatches.count();
check("Tanlashda 8 ta rang paneli chiqadi", swatchCount === 8, `count=${swatchCount}`);
await page.screenshot({ path: OUT + "02-selection.png" });

// Yashil rangni tanlash → POST → overlay
await page.locator('button[aria-label="Yashil rang bilan belgilash"]').click();
await page.waitForSelector('[data-page="1"] .highlightLayer > div', { timeout: 5000 });
const overlay1 = await page.$$eval('[data-page="1"] .highlightLayer > div', (ds) => ds.map((d) => ({ l: d.style.left, t: d.style.top, w: d.style.width, h: d.style.height, bg: d.style.background })));
check("Highlight overlay chizildi", overlay1.length >= 1, JSON.stringify(overlay1));
check("Overlay rangi yashil", overlay1[0]?.bg.includes("134, 239, 172") || overlay1[0]?.bg.includes("#86efac"), overlay1[0]?.bg);
const srv = await mockGet("/__annotations");
check("Serverga location_data.rects yuborildi", Array.isArray(srv[0]?.location_data?.rects) && srv[0].location_data.rects.length >= 1, JSON.stringify(srv[0]?.location_data));
check("Rects 0–1 ulushlarda", srv[0].location_data.rects.every((r) => r.every((v) => v >= 0 && v <= 1)));
await page.screenshot({ path: OUT + "03-highlighted.png" });

// ---- Zoom: overlay % o'zgarmaydi, sahifa kengligi o'zgaradi
const w0 = await page.$eval('[data-page="1"]', (e) => e.getBoundingClientRect().width);
await page.keyboard.press("+");
await page.keyboard.press("+");
await page.waitForTimeout(500);
const w1 = await page.$eval('[data-page="1"]', (e) => e.getBoundingClientRect().width);
const overlayZ = await page.$$eval('[data-page="1"] .highlightLayer > div', (ds) => ds.map((d) => d.style.left + d.style.top + d.style.width + d.style.height));
check("Zoom'da sahifa kattalashdi", w1 > w0, `${w0}→${w1}`);
check("Zoom'da overlay ulushlari o'zgarmadi", overlayZ[0] === overlay1[0].l + overlay1[0].t + overlay1[0].w + overlay1[0].h);
await page.keyboard.press("-");
await page.keyboard.press("-");

// ---- Qayta ochilganda tiklanadi
await page.reload();
await waitRendered(1);
await page.waitForSelector('[data-page="1"] .highlightLayer > div', { timeout: 8000 });
const overlayR = await page.$$eval('[data-page="1"] .highlightLayer > div', (ds) => ds.map((d) => d.style.left + d.style.top + d.style.width + d.style.height));
check("Reload'dan keyin highlight tiklandi (bir xil joyda)", overlayR[0] === overlay1[0].l + overlay1[0].t + overlay1[0].w + overlay1[0].h, overlayR[0]);

// ---- Sidebar: rang nuqtasi → palitra → rang o'zgartirish (PATCH)
await page.click('button[title="Panel"]');
await page.click("text=Belgilar");
await page.locator('button[aria-label="Rangni o\'zgartirish"]').first().click();
await page.locator('aside button[aria-label="Pushti"]').click();
await page.waitForFunction(() => document.querySelector('[data-page="1"] .highlightLayer > div')?.style.background.includes("249, 168, 212"), null, { timeout: 5000 });
const srv2 = await mockGet("/__annotations");
check("Sidebar'dan rang o'zgartirildi (PATCH color)", srv2[0]?.color === "#f9a8d4", srv2[0]?.color);
await page.screenshot({ path: OUT + "04-sidebar-color.png" });
await page.click('aside button[aria-label="Yopish"]').catch(() => {});

// ---- Nusxalash cheklovi
await selectOnPage(1);
const copyBlocked = await page.evaluate(() => {
  const el = document.querySelector('[data-page="1"] .textLayer span');
  const ev = new ClipboardEvent("copy", { bubbles: true, cancelable: true });
  return !el.dispatchEvent(ev); // preventDefault → false qaytadi
});
check("copy hodisasi bloklangan", copyBlocked);
const ctxBlocked = await page.evaluate(() => {
  const el = document.querySelector('[data-page="1"]');
  return !el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
});
check("contextmenu bloklangan", ctxBlocked);
await page.locator('button[aria-label="Yopish"]').last().click().catch(() => {});

// ---- Ctrl+P / Ctrl+S
await page.keyboard.press("Control+p");
await page.waitForSelector("text=chop etib bo'lmaydi", { timeout: 3000 }).then(() => check("Ctrl+P bloklangan (toast)", true)).catch(() => check("Ctrl+P bloklangan (toast)", false));
await page.keyboard.press("Control+s");
await page.waitForSelector("text=saqlab bo'lmaydi", { timeout: 3000 }).then(() => check("Ctrl+S bloklangan (toast)", true)).catch(() => check("Ctrl+S bloklangan (toast)", false));

// ---- @media print
await page.emulateMedia({ media: "print" });
const printState = await page.evaluate(() => ({
  protectedDisplay: getComputedStyle(document.querySelector(".print-protected")).display,
  noticeDisplay: getComputedStyle(document.querySelector(".print-notice")).display,
}));
check("@media print: reader yashirin, xabar ko'rinadi", printState.protectedDisplay === "none" && printState.noticeDisplay === "block", JSON.stringify(printState));
await page.emulateMedia({ media: "screen" });
await page.waitForTimeout(300);

// ---- Varaqlash rejimi
await page.keyboard.press("ArrowRight"); // 2-sahifa (scroll)
await page.keyboard.press("ArrowRight"); // 3-sahifa
await page.waitForFunction(() => document.querySelector('input[aria-label="Sahifa"]').value === "3", null, { timeout: 5000 });
await page.click('button[aria-label="O\'qish rejimi"]');
// FlipStage: qo'shni sahifalar yashirin oldindan render qilinadi — faqat bitta varaq ko'rinadi
await page.waitForFunction(() => document.querySelector('[data-testid="flip-stage"]') && [...document.querySelectorAll(".flip-leaf")].filter((l) => getComputedStyle(l).visibility === "visible").length === 1, null, { timeout: 5000 });
const visibleLeaf = () => page.evaluate(() => [...document.querySelectorAll(".flip-leaf")].find((l) => getComputedStyle(l).visibility === "visible")?.dataset.leaf);
const pageModeNo = await visibleLeaf();
check("Varaqlash rejimi: bitta ko'rinadigan varaq, joriy (3) saqlandi; qo'shnilar oldindan render", pageModeNo === "3" && (await page.locator(".flip-leaf").count()) === 3, `page=${pageModeNo}`);
const fits = await page.evaluate(() => {
  const r = [...document.querySelectorAll(".flip-leaf")].find((l) => getComputedStyle(l).visibility === "visible").getBoundingClientRect();
  return r.height <= window.innerHeight && r.width <= window.innerWidth;
});
check("Varaqlash: sahifa ekranga sig'adi", fits);
await waitRendered(3);
check("Prev/Next tugmalari bor", (await page.locator('button[aria-label="Keyingi sahifa"]').count()) === 1);
await page.click('button[aria-label="Keyingi sahifa"]');
await page.waitForFunction(() => !!document.querySelector(".flip-leaf.is-flipping"), null, { timeout: 2000 }).then(() => check("Next: varaq animatsiyasi boshlandi (3D rotateY)", true)).catch(() => check("Next: varaq animatsiyasi boshlandi (3D rotateY)", false));
await page.waitForFunction(() => !document.querySelector('[data-testid="flip-stage"]').dataset.flipping && [...document.querySelectorAll(".flip-leaf")].find((l) => getComputedStyle(l).visibility === "visible")?.dataset.leaf === "4", null, { timeout: 5000 });
await page.keyboard.press("ArrowLeft");
await page.waitForFunction(() => !document.querySelector('[data-testid="flip-stage"]').dataset.flipping && [...document.querySelectorAll(".flip-leaf")].find((l) => getComputedStyle(l).visibility === "visible")?.dataset.leaf === "3", null, { timeout: 5000 });
check("Next tugma / ArrowLeft navigatsiyasi ishlaydi (animatsiya bilan)", true);
// Sichqoncha bilan sudrab varaqlash: o'ng chekkadan chapga tortish → 4-sahifa; qisqa tortish → qaytadi
const pr = await page.locator(".flip-leaf[data-leaf='3'] .reader-page").boundingBox();
await page.mouse.move(pr.x + pr.width * 0.95, pr.y + pr.height / 2);
await page.mouse.down();
for (let i = 1; i <= 10; i++) { await page.mouse.move(pr.x + pr.width * 0.95 - (pr.width * 0.6 * i) / 10, pr.y + pr.height / 2); await page.waitForTimeout(16); }
const dragAngle = await page.evaluate(() => document.querySelector(".flip-leaf.is-flipping")?.style.transform ?? "");
await page.mouse.up();
await page.waitForFunction(() => !document.querySelector('[data-testid="flip-stage"]').dataset.flipping, null, { timeout: 4000 });
check("Sudrash: varaq kursorga ergashdi va yarmidan o'tgach varaqlandi (3→4)", /rotateY\(-\d/.test(dragAngle) && (await visibleLeaf()) === "4", `${dragAngle} → ${await visibleLeaf()}`);
const pr2 = await page.locator(".flip-leaf[data-leaf='4'] .reader-page").boundingBox();
await page.mouse.move(pr2.x + pr2.width * 0.95, pr2.y + pr2.height / 2);
await page.mouse.down();
await page.mouse.move(pr2.x + pr2.width * 0.95 - 30, pr2.y + pr2.height / 2); await page.waitForTimeout(40);
await page.mouse.move(pr2.x + pr2.width * 0.95 - 50, pr2.y + pr2.height / 2); await page.waitForTimeout(300);
await page.mouse.up();
await page.waitForFunction(() => !document.querySelector('[data-testid="flip-stage"]').dataset.flipping, null, { timeout: 4000 });
check("Qisqa sudrash → varaq joyiga qaytdi (4)", (await visibleLeaf()) === "4");
// Fonning chap yarmini bosish → oldingi sahifa (3)
const st = await page.locator('[data-testid="flip-stage"]').boundingBox();
await page.mouse.click(st.x + 24, st.y + st.height / 2);
await page.waitForFunction(() => !document.querySelector('[data-testid="flip-stage"]').dataset.flipping && [...document.querySelectorAll(".flip-leaf")].find((l) => getComputedStyle(l).visibility === "visible")?.dataset.leaf === "3", null, { timeout: 4000 });
check("Fon chap yarmi bosildi → oldingi sahifa (3)", true);
await page.screenshot({ path: OUT + "05-page-mode.png" });

// Varaqlash rejimida highlight (sahifa 3)
await waitRendered(3);
await selectOnPage(3);
await page.locator('button[aria-label="Ko\'k rang bilan belgilash"]').click();
await page.waitForSelector('[data-page="3"] .highlightLayer > div', { timeout: 5000 });
check("Varaqlash rejimida highlight ishlaydi", true);

// Reload → rejim eslab qolinadi
await page.reload();
await page.waitForFunction(() => document.querySelector('[data-testid="flip-stage"]') && ([...document.querySelectorAll(".flip-leaf")].find((l) => getComputedStyle(l).visibility === "visible"))?.querySelector("canvas")?.width > 0, null, { timeout: 20000 });
check("Reload'dan keyin varaqlash rejimi saqlandi", (await page.$eval("button[aria-label=\"O'qish rejimi\"]", (b) => b.textContent)).includes("Varaq"));

// Scroll'ga qaytish → 6 sahifa, joriy sahifa saqlanadi
const before = await page.$eval('input[aria-label="Sahifa"]', (i) => i.value);
await page.click('button[aria-label="O\'qish rejimi"]');
await page.waitForFunction(() => document.querySelectorAll(".reader-page").length === 6, null, { timeout: 5000 });
await page.waitForTimeout(300);
const after = await page.$eval('input[aria-label="Sahifa"]', (i) => i.value);
check("Scroll'ga qaytganda joriy sahifa saqlandi", before === after, `${before}→${after}`);
await page.screenshot({ path: OUT + "06-back-to-scroll.png" });

const gotoViaInput = async (n) => {
  await page.fill('input[aria-label="Sahifa"]', String(n));
  await page.press('input[aria-label="Sahifa"]', "Enter");
  await page.waitForFunction((n) => document.querySelector('input[aria-label="Sahifa"]').value === String(n), n, { timeout: 5000 });
  check(`Enter'dan keyin fokus input'dan chiqdi (${n})`, await page.evaluate(() => document.activeElement?.tagName !== "INPUT"));
};

// ---- Progress: debounce (1.5 s) dan keyin saqlanadi
await gotoViaInput(2);
await page.waitForTimeout(2000);
const progAll = await mockGet("/__progress");
const prog = Object.values(progAll).find((p) => p.article_id === ART) ?? {};
check("Progress debounce'dan keyin saqlandi (2)", prog.current_page === 2, JSON.stringify(prog));

// ---- Zoom'da joriy sahifa saqlanadi (scroll rejimi)
await gotoViaInput(4);
await page.keyboard.press("+");
await page.keyboard.press("+");
await page.waitForTimeout(400);
const afterZoom = await page.$eval('input[aria-label="Sahifa"]', (i) => i.value);
const topVisible = await page.evaluate(() => {
  const r = document.querySelector('[data-page="4"]').getBoundingClientRect();
  return r.top >= 40 && r.top < 120; // sahifa boshi toolbar ostida ko'rinadi
});
check("Zoom'da joriy sahifa (4) saqlanadi va boshidan ko'rinadi", afterZoom === "4" && topVisible, `page=${afterZoom} topVisible=${topVisible}`);
await page.keyboard.press("-");
await page.keyboard.press("-");
await page.waitForTimeout(300);

// ---- Progress: pagehide flush (keepalive) — o'zgarishdan darhol keyin reload
await gotoViaInput(5);
await page.reload();
await waitRendered(1).catch(() => {});
await page.waitForTimeout(500);
const prog2 = Object.values(await mockGet("/__progress")).find((p) => p.article_id === ART) ?? {};
check("pagehide flush (keepalive) progress'ni saqladi (5)", prog2.current_page === 5, JSON.stringify(prog2));
const resumed = await page.$eval('input[aria-label="Sahifa"]', (i) => i.value);
check("Qayta ochilganda oxirgi sahifadan davom etadi", resumed === "5", `page=${resumed}`);

console.log("404 URL'lar:", JSON.stringify(notFound));
const real404 = notFound.filter((u) => !u.includes("favicon"));
// "Failed to load resource" konsol xabari URL'siz keladi — 404 ro'yxati faqat favicon bo'lsa, o'sha
const realErrors = consoleErrors.filter((e) => !(e.startsWith("Failed to load resource") && real404.length === 0));
check("Konsolda xato / kutilmagan 404 yo'q", realErrors.length === 0 && real404.length === 0, [...realErrors, ...real404].join(" | ").slice(0, 400));

await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
