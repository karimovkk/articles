// 44.8 — Global ko'rinish: admin "Ko'rinish" sahifasi — asosiy rang (oldindan ko'rish → saqlash → hammaga), avtomatik
// tugma matni va kontrast ogohlantirishi, yorug' fon rangi, tizim shrifti, xavfsiz bo'lmagan rasm havolasi rad
// etiladi; boshqa foydalanuvchi (login sahifasi ham) yangi ko'rinishni oladi, qayta ochilganda keshdan birinchi
// chizishdanoq; "Standartga qaytarish" — DELETE va eski ko'rinish.
import { launch, BASE, reset, mockGet, mockWait, ignorablePageError } from "../lib.mjs";
import { mkdirSync, readFileSync } from "node:fs";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const pageErrors = [];
// 72: `net` — foydalanuvchi interneti (navigator.connection taqlidi): null — aniqlab bo'lmaydi (iPhone kabi)
const newPage = async (theme = "light", net) => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  await ctx.addInitScript((t) => localStorage.setItem("a365.theme", t), theme);
  if (net !== undefined)
    await ctx.addInitScript((n) => {
      Object.defineProperty(Navigator.prototype, "connection", { configurable: true, get: () => (n ? { ...n, addEventListener() {}, removeEventListener() {} } : undefined) });
    }, net);
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
await admin.locator('[data-testid="appearance-preset"][data-id="blue"]').click();
await admin.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().toLowerCase() === "#2563eb", null, { timeout: 5000 });
check("Oldindan ko'rish: --accent darhol #2563eb, server o'zgarmagan", Object.keys(await mockGet("/__app-settings")).length === 0);
check("Tugma matni avtomatik oq (ko'k fonda)", (await admin.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent-contrast").trim().toLowerCase())) === "#ffffff");

// 49: faqat tayyor ranglar — ixtiyoriy rang tanlagich va rang kodi maydoni yo'q; tanlangan rang nomi
const pickers = await admin.evaluate(() => ({
  color: document.querySelectorAll('[data-testid="appearance-page"] input[type="color"]').length,
  mono: document.querySelectorAll('[data-testid="appearance-page"] input.font-mono').length,
  presets: document.querySelectorAll('[data-testid="appearance-preset"]').length,
}));
check("Asosiy rang: 8 ta tayyor rang, rang tanlagich va kod maydoni yo'q", pickers.color === 0 && pickers.mono === 0 && pickers.presets === 8, JSON.stringify(pickers));
check("Tanlangan rang nomi ko'rinadi ('Ko'k')", ((await admin.textContent('[data-testid="appearance-preset-name"]')) ?? "").trim() === "Ko'k");
// 51: nom/yorliq bosilsa birinchi rang ('Oltin') tanlanib qolmaydi
await admin.click('[data-testid="appearance-preset-name"]');
await admin.click("text=Tugmalar, belgilar va ajratishlar");
await admin.waitForTimeout(300);
check("Rang nomi va izoh bosildi — asosiy rang o'zgarmadi (Ko'k)", (await accent(admin)) === "#2563eb" && (await admin.getAttribute('[data-testid="appearance-preset"][data-id="gold"]', "aria-pressed")) === "false");

// 46: qorong'i fon — rasm (sudrab tashlash); noto'g'ri tur rad etiladi
await admin.click('[data-testid="bg-dark-image"]');
await admin.setInputFiles('[data-testid="bg-dark-file"]', new URL("../mock/book.pdf", import.meta.url).pathname);
await admin.waitForSelector('[data-testid="bg-dark-error"]', { timeout: 3000 });
check("Noto'g'ri tur (PDF): xato, serverga yuborilmadi", ((await admin.textContent('[data-testid="bg-dark-error"]')) ?? "").includes("JPEG, PNG yoki WebP") && !(await mockGet("/__app-images")).background);
const imgB64 = readFileSync(new URL("../../public/bg/article-960.webp", import.meta.url)).toString("base64");
const dropFile = async (sel, name) => {
  const dt = await admin.evaluateHandle(([b64, n]) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const d = new DataTransfer();
    d.items.add(new File([bin], n, { type: "image/webp" }));
    return d;
  }, [imgB64, name]);
  await admin.dispatchEvent(sel, "dragover", { dataTransfer: dt });
  await admin.dispatchEvent(sel, "drop", { dataTransfer: dt });
};
await dropFile('[data-testid="bg-dark-drop"]', "night.webp");
await admin.waitForSelector('[data-testid="bg-dark-thumb"]', { timeout: 15000 });
await admin.waitForFunction(() => !document.querySelector('[data-testid="bg-dark"]')?.textContent?.includes("Yuklanmoqda"), null, { timeout: 20000 });
let imgs = await mockGet("/__app-images");
check("Drag & drop: asl rasm o'zgarmay yuklandi (siqilmadi — hajmi bir xil), kichik ko'rinish chiqdi", imgs.background?.dark?.type === "image/webp" && imgs.background.dark.size === Buffer.from(imgB64, "base64").length, JSON.stringify(imgs.background));
check("Kichik (allaqachon yengil) rasm — nusxa kerak emas, hammaga asl rasm", !imgs.background_md && !imgs.background_sm, JSON.stringify(Object.keys(imgs)));
// 72: katta rasm (3000×2000, ~MB) — asl holida + sekin internet uchun yengil nusxalar
const big = await admin.evaluateHandle(async () => {
  const c = document.createElement("canvas");
  c.width = 3000;
  c.height = 2000;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 3000, 2000);
  g.addColorStop(0, "#203a43");
  g.addColorStop(1, "#c79a2c");
  x.fillStyle = g;
  x.fillRect(0, 0, 3000, 2000);
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = `hsl(${(i * 37) % 360} 60% ${30 + (i % 50)}%)`;
    x.fillRect((i * 7919) % 3000, (i * 104729) % 2000, 3 + (i % 9), 3 + (i % 7));
  }
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.95));
  const d = new DataTransfer();
  d.items.add(new File([blob], "big.jpg", { type: "image/jpeg" }));
  return d;
});
const bigSize = await big.evaluate((d) => d.files[0].size);
await admin.dispatchEvent('[data-testid="bg-dark-drop"]', "dragover", { dataTransfer: big });
await admin.dispatchEvent('[data-testid="bg-dark-drop"]', "drop", { dataTransfer: big });
imgs = await mockWait("/__app-images", (x) => x.background?.dark?.type === "image/jpeg" && !!x.background_md?.dark && !!x.background_sm?.dark, 30000);
check("Katta rasm: asl holida (JPEG, hajmi bir xil)", imgs.background?.dark?.type === "image/jpeg" && imgs.background.dark.size === bigSize, `${imgs.background?.dark?.size} / ${bigSize}`);
check("Katta rasm: yengil nusxalar — md < asl, sm < md", imgs.background_md?.dark?.size > 0 && imgs.background_md.dark.size < bigSize && imgs.background_sm?.dark?.size < imgs.background_md.dark.size, JSON.stringify({ asl: bigSize, md: imgs.background_md?.dark?.size, sm: imgs.background_sm?.dark?.size }));
const v1 = imgs.background.dark.v;
await admin.click('[data-testid="bg-light-color"]');
const lightSw = await admin.locator('[data-testid="bg-light-swatch"]').count();
check("Yorug' fon: 8 ta tayyor rang, kod maydoni yo'q", lightSw === 8 && (await admin.locator('[data-testid="bg-light"] input').count()) === 0, `${lightSw}`);
await admin.click('[data-testid="bg-light-swatch"][data-id="sky"]');
await admin.click('[data-testid="appearance-font"] button:has-text("Tizim shrifti")');
await admin.screenshot({ path: OUT + "87-admin-appearance.png", fullPage: true });
await admin.click('[data-testid="appearance-save"]');
await admin.waitForSelector("text=Saqlandi", { timeout: 5000 });
const st = (await mockGet("/__app-settings")).appearance;
check("Saqlandi: rang, yorug' fon, qorong'i fon — yuklangan rasm, tizim shrifti", st?.primary_color === "#2563eb" && st?.background_light === "#e9f0f8" && st?.background_dark === "upload" && st?.font === "system" && !("images" in st), JSON.stringify(st));

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
check("Katalog: yorug' fon rangi ('Osmon')", bg === "rgb(233, 240, 248)", bg);
// Qorong'i mavzu — rang qorong'i fonga moslashtirilgan
const dark = await newPage("dark", { effectiveType: "4g", downlink: 10 });
await dark.goto(`${BASE}/catalog`);
await dark.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().toLowerCase() !== "#f2b705", null, { timeout: 10000 });
const da = await accent(dark);
check("Qorong'i mavzu: aksent ochroq varianti (qorong'i fonda o'qiladi)", da !== "#2563eb" && da.startsWith("#"), da);
await dark.waitForSelector('[data-testid="book-card"]', { timeout: 20000 });
// Tez internet (4G, 10 Mbit/s) — avval o'rtacha nusxa, so'ng asl rasm fonda yuklanib almashadi
await dark.waitForFunction(() => document.documentElement.dataset.net === "full", null, { timeout: 10000 }).catch(() => {});
const darkBg = await dark.evaluate(() => getComputedStyle(document.querySelector(".client-bg"), "::before").backgroundImage);
check("Qorong'i fon: tez internetda — asl rasm (versiyali URL)", darkBg.includes("/api/v1/app-settings/images/background?theme=dark&v="), darkBg);
// 72: internet turlari — har biriga mos nusxa; boshqalari umuman yuklanmaydi
for (const [label, net, want] of [
  ["Tejash rejimi", { saveData: true, effectiveType: "4g", downlink: 10 }, "background_sm"],
  ["2G", { effectiveType: "2g", downlink: 0.2 }, "background_sm"],
  ["3G", { effectiveType: "3g", downlink: 1.2 }, "background_md"],
  ["Sekin 4G (2 Mbit/s)", { effectiveType: "4g", downlink: 2 }, "background_md"],
  ["Aniqlab bo'lmaydi (iPhone)", null, "background_md"],
]) {
  const p = await newPage("dark", net);
  const reqs = [];
  p.on("request", (r) => r.url().includes("/app-settings/images/") && reqs.push(new URL(r.url()).pathname.split("/").pop()));
  await p.goto(`${BASE}/catalog`);
  await p.waitForSelector('[data-testid="book-card"]', { timeout: 20000 });
  await p.waitForTimeout(1200);
  const bgi = await p.evaluate(() => getComputedStyle(document.querySelector(".client-bg"), "::before").backgroundImage);
  const got = bgi.match(/images\/([a-z_]+)\?/)?.[1];
  check(`${label}: fon — ${want}, boshqa nusxalar yuklanmadi`, got === want && reqs.every((n) => n === want), `${got} · so'rovlar: ${[...new Set(reqs)].join(",")}`);
  await p.context().close();
}
const served = await dark.evaluate(async (u) => { const r = await fetch(u); return { ok: r.ok, type: r.headers.get("content-type") }; }, darkBg.match(/url\("(.+?)"\)/)[1]);
check("Rasm public serve qilinadi (asl format — image/jpeg)", served.ok && served.type === "image/jpeg", JSON.stringify(served));

// Almashtirish — versiya (URL) yangilanadi, fon darhol yangi rasm
await dropFile('[data-testid="bg-dark-drop"]', "night2.webp");
await admin.waitForTimeout(1500);
imgs = await mockGet("/__app-images");
check("Almashtirildi: yangi versiya (?v= o'zgardi)", imgs.background?.dark?.v > v1, `${v1} → ${imgs.background?.dark?.v}`);
imgs = await mockWait("/__app-images", (x) => !x.background_md && !x.background_sm, 15000);
check("Kichik rasmga almashtirildi — eski (katta rasm) nusxalari o'chdi: sekin internetda ham yangi rasm", !imgs.background_md && !imgs.background_sm, JSON.stringify(Object.keys(imgs)));
await admin.click('[data-testid="appearance-save"]');
await admin.waitForSelector("text=Saqlandi", { timeout: 5000 });
await dark.reload();
await dark.waitForSelector('[data-testid="book-card"]', { timeout: 20000 });
await dark.waitForTimeout(800);
const darkBg2 = await dark.evaluate(() => getComputedStyle(document.querySelector(".client-bg"), "::before").backgroundImage);
check("Foydalanuvchida yangi versiya URL'i", darkBg2.includes(`v=${imgs.background.dark.v}`), darkBg2);

// Fon boshqa turga o'tib saqlansa — rasm storage'dan o'chadi
await admin.click('[data-testid="bg-dark-default"]');
await admin.click('[data-testid="appearance-save"]');
await admin.waitForTimeout(1200);
const left = await mockGet("/__app-images");
check("Standart fonga o'tdi → yuklangan rasm va nusxalari o'chirildi (yetim fayl yo'q)", !left.background && !left.background_md && !left.background_sm && (await mockGet("/__app-settings")).appearance?.background_dark === "default", JSON.stringify(Object.keys(left)));

// 49: qorong'i fon — "Rang" tanlanganda to'q rang (avval och krem tanlanib, matn ko'rinmay qolardi)
await admin.click('[data-testid="bg-dark-color"]');
const darkSw = await admin.evaluate(() => [...document.querySelectorAll('[data-testid="bg-dark-swatch"]')].map((b) => ({ id: b.dataset.id, on: b.getAttribute("aria-pressed") === "true" })));
check("Qorong'i fon: 8 ta to'q rang, boshlang'ichi 'Grafit'", darkSw.length === 8 && darkSw.find((x) => x.on)?.id === "graphite", JSON.stringify(darkSw.filter((x) => x.on)));
await admin.click('[data-testid="bg-dark-swatch"][data-id="midnight"]');
await admin.click('[data-testid="appearance-save"]');
await admin.waitForSelector("text=Saqlandi", { timeout: 5000 });
await dark.reload();
await dark.waitForSelector('[data-testid="book-card"]', { timeout: 20000 });
await dark.waitForTimeout(800);
/** Fon (::before) rangi va sahifa sarlavhasi/xira matn rangi orasidagi kontrast */
const textOnBg = (p) => p.evaluate(() => {
  const rgb = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const bgc = getComputedStyle(document.querySelector(".client-bg"), "::before").backgroundColor;
  const after = getComputedStyle(document.querySelector(".client-bg"), "::after").backgroundImage;
  const h1 = document.querySelector("h1");
  const muted = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim();
  const m = muted.startsWith("#") ? [parseInt(muted.slice(1, 3), 16), parseInt(muted.slice(3, 5), 16), parseInt(muted.slice(5, 7), 16)] : rgb(muted);
  return { bg: bgc, after, title: ratio(rgb(getComputedStyle(h1).color), rgb(bgc)), muted: ratio(m, rgb(bgc)) };
});
const dt = await textOnBg(dark);
check("Qorong'i fon 'Tungi ko'k': sarlavha va xira matn o'qiladi (≥ 4.5:1), rasm pardasi o'chdi", dt.bg === "rgb(11, 20, 38)" && dt.title >= 4.5 && dt.muted >= 4.5 && dt.after === "none", JSON.stringify(dt));

// Serverda eski xavfli qiymat (qorong'i fon uchun och rang) — standart fon ko'rsatiladi, matn yashirinmaydi
await mockGet(`/__app-settings?set=${encodeURIComponent(JSON.stringify({ appearance: { ...(await mockGet("/__app-settings")).appearance, background_dark: "#f4f2ec" } }))}`);
await dark.reload();
await dark.waitForSelector('[data-testid="book-card"]', { timeout: 20000 });
await dark.waitForTimeout(800);
const unsafe = await textOnBg(dark);
check("Eski xavfli qiymat (#f4f2ec qorong'ida) → standart qorong'i fon, matn o'qiladi", !unsafe.bg.includes("244, 242, 236") && (await dark.evaluate(() => document.getElementById("a365-appearance")?.textContent ?? "")).includes("html.dark") === false && unsafe.title >= 4.5, JSON.stringify(unsafe));
await dark.screenshot({ path: OUT + "89-dark-unsafe-fallback.png" });
// Qayta ochish — keshdan birinchi chizishdanoq (sozlama so'rovi kechiksa ham)
await guest.route("**/api/v1/app-settings", async (r) => { await new Promise((x) => setTimeout(x, 3000)); await r.continue(); });
await guest.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
check("Qayta ochilganda keshdan darhol (server javobini kutmasdan)", (await accent(guest)) === "#2563eb");
await guest.unroute("**/api/v1/app-settings");

// 51: yuklash zonasini HAQIQIY bosish (matni ustidan) → fayl tanlash oynasi → yuklash; tur "Rasm"da qoladi
// (avval Field <label> edi — bosish label'ning birinchi tugmasi "Standart"ni bosib, zona yo'qolardi)
await admin.click('[data-testid="bg-dark-image"]');
const pressed = (k) => admin.getAttribute(`[data-testid="bg-dark-${k}"]`, "aria-pressed");
await admin.click('.field:has(> [data-testid="bg-dark"]) > .label');
check("Fon yorlig'i bosildi — tur o'zgarmadi ('Rasm')", (await pressed("image")) === "true" && (await pressed("default")) === "false");
const [chooser] = await Promise.all([admin.waitForEvent("filechooser", { timeout: 5000 }), admin.click('[data-testid="bg-dark-drop"] >> text=JPEG, PNG yoki WebP')]);
check("Zona bosildi: fayl tanlash oynasi ochildi, tur 'Rasm'da qoldi", (await pressed("image")) === "true" && (await admin.locator('[data-testid="bg-dark-drop"]').count()) === 1);
await chooser.setFiles(new URL("../../public/bg/article-960.webp", import.meta.url).pathname);
await admin.waitForSelector('[data-testid="bg-dark-thumb"]', { timeout: 15000 });
check("Tanlangan fayl yuklandi, tur 'Rasm' (Standart'ga qaytmadi)", (await pressed("image")) === "true" && !!(await mockGet("/__app-images")).background?.dark);
await admin.click('[data-testid="appearance-save"]');
await admin.waitForSelector("text=Saqlandi", { timeout: 5000 });
await admin.locator('[data-testid="bg-dark"]').screenshot({ path: OUT + "88-admin-bg-drop.png" });
await admin.click('[data-testid="appearance-reset"]');
await admin.waitForSelector("text=Standart ko'rinish tiklandi", { timeout: 5000 });
check("Qaytarish: server kaliti, yuklangan rasm va nusxalari o'chdi, --accent #f2b705", !("appearance" in (await mockGet("/__app-settings"))) && Object.keys(await mockGet("/__app-images")).length === 0 && (await accent(admin)) === "#f2b705");

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
