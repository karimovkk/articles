// 21 — reader himoyasi: nusxalash bloklari (Ctrl+C, Ctrl+A, kontekst menyu, sudrash, execCommand), chop etish,
// va sahifadagi belgilash paneli (rang almashtirish, o'chirish, dublikat yaratilmasligi).
import { launch, BASE, reset, mockGet, IS_CHROMIUM } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...(IS_CHROMIUM ? { permissions: ["clipboard-read", "clipboard-write"] } : {}) });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-reader-protect-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });

await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`, { timeout: 20000 });
await page.goto(`${BASE}/reader/${ART}`);
await page.waitForFunction(() => document.querySelectorAll('[data-page="1"] .textLayer span').length > 0, null, { timeout: 30000 });

const setClipboard = (v) => page.evaluate((t) => navigator.clipboard.writeText(t), v);
const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
const selectSpan = (i) =>
  page.evaluate((k) => {
    const sp = [...document.querySelectorAll('[data-page="1"] .textLayer span')][k];
    const r = document.createRange();
    r.selectNodeContents(sp);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    document.querySelector(".reader-page")?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    return s.toString();
  }, i);

// ---- Nusxalash: tanlangan matn + Ctrl+C
const selected = await selectSpan(1);
check("Matn qatlami tanlanadi (highlight uchun kerak)", selected.includes("page 1"), selected.slice(0, 40));
if (IS_CHROMIUM) {
  await setClipboard("__BOSH__");
  await page.keyboard.press("Control+c");
  await page.waitForTimeout(250);
  const after = await clipboard();
  check("Ctrl+C: kitob matni buferga tushmadi (ogohlantirish matni)", !after.includes("page 1") && after.includes("nusxalab"), after.slice(0, 40));
  // Ctrl+A → Ctrl+C (eng keng tarqalgan yo'l)
  await setClipboard("__BOSH2__");
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Control+c");
  await page.waitForTimeout(250);
  const all = await clipboard();
  check("Ctrl+A → Ctrl+C: sahifa matni buferga tushmadi", !all.includes("page 1") && !all.includes("Birinchi maqola"), all.slice(0, 50));
  // Dastur orqali: execCommand('copy')
  await setClipboard("__BOSH3__");
  await page.evaluate(() => {
    const sp = document.querySelector('[data-page="1"] .textLayer span');
    const r = document.createRange();
    r.selectNodeContents(sp);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    document.execCommand("copy");
  });
  await page.waitForTimeout(250);
  check("execCommand('copy') ham bloklangan", !(await clipboard()).includes("page 1"));
} else {
  const prevented = await page.evaluate(() => {
    const ev = new ClipboardEvent("copy", { bubbles: true, cancelable: true });
    return !document.body.dispatchEvent(ev) || ev.defaultPrevented;
  });
  check("copy hodisasi hujjat darajasida bloklangan", prevented);
}

// ---- Kontekst menyu / sudrab tashlash / cut
const blocked = await page.evaluate(() => {
  const el = document.querySelector('[data-page="1"] .textLayer span');
  const fire = (type, Ctor = Event) => {
    const ev = new Ctor(type, { bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const cut = new ClipboardEvent("cut", { bubbles: true, cancelable: true });
  document.body.dispatchEvent(cut);
  return { menu: fire("contextmenu", MouseEvent), drag: fire("dragstart"), cut: cut.defaultPrevented };
});
check("Kontekst menyu, sudrab tashlash va 'cut' bloklangan", blocked.menu && blocked.drag && blocked.cut, JSON.stringify(blocked));

// ---- Input ichida nusxalash ishlaydi (o'z matni)
const inputCopyAllowed = await page.evaluate(() => {
  const inp = document.querySelector('header input[type="number"], header input');
  if (!inp) return null;
  const ev = new ClipboardEvent("copy", { bubbles: true, cancelable: true });
  inp.dispatchEvent(ev);
  return !ev.defaultPrevented;
});
check("Foydalanuvchi maydonlarida nusxalash to'silmagan", inputCopyAllowed !== false, String(inputCopyAllowed));

// ---- Chop etish: reader yashirin, ogohlantirish ko'rinadi
await page.emulateMedia({ media: "print" });
const printState = await page.evaluate(() => ({
  reader: getComputedStyle(document.querySelector(".print-protected")).display,
  notice: getComputedStyle(document.querySelector(".print-notice")).display,
}));
await page.emulateMedia({ media: "screen" });
check("Chop etishda kontent yashirin, ogohlantirish ko'rinadi", printState.reader === "none" && printState.notice !== "none", JSON.stringify(printState));
// Chop etish rejimida sahifa yashirilgani uchun matn qatlami tozalangan — qayta render bo'lishini kutamiz
await page.waitForFunction(() => document.querySelectorAll('[data-page="1"] .textLayer span').length > 0, null, { timeout: 20000 });

// ---- Belgilash: yaratish → panel → rang → o'chirish; dublikat yaratilmaydi
await selectSpan(1);
await page.click('button[aria-label="Ko\'k rang bilan belgilash"]');
await page.waitForSelector('[data-page="1"] .highlightLayer > div', { timeout: 8000 });
check("Belgilash yaratildi", (await page.locator('[data-page="1"] .highlightLayer > div').count()) === 1);
await selectSpan(1);
await page.waitForTimeout(200);
await page.click('button[aria-label="Sariq rang bilan belgilash"]');
await page.waitForFunction(() => document.body.innerText.includes("Belgilash yangilandi"), null, { timeout: 8000 });
const hl = await mockGet("/__annotations");
check("Bir joyni qayta belgilash: dublikat yo'q, rang yangilandi", (await page.locator('[data-page="1"] .highlightLayer > div').count()) === 1 && hl.filter((a) => a.type === "HIGHLIGHT").length === 1, `server=${hl.filter((a) => a.type === "HIGHLIGHT").length}`);

const box = await page.evaluate(() => {
  const d = document.querySelector('[data-page="1"] .highlightLayer > div').getBoundingClientRect();
  return { x: d.left + d.width / 2, y: d.top + d.height / 2 };
});
await page.mouse.click(box.x, box.y);
await page.waitForSelector('[data-testid="highlight-menu"]', { timeout: 5000 });
check("Belgilangan joy bosilganda panel ochildi", true);
await page.screenshot({ path: OUT + "13-highlight-menu.png" });
await page.click('[data-testid="highlight-delete"]');
await page.waitForFunction(() => !document.querySelector('[data-page="1"] .highlightLayer > div'), null, { timeout: 8000 });
const left = (await mockGet("/__annotations")).filter((a) => a.type === "HIGHLIGHT").length;
check("Paneldan o'chirish: sahifadan ham, serverdan ham ketdi", left === 0, `server=${left}`);

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 200));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
