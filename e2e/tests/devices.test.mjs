// 38 — Akkaunt 2 ta qurilmaga bog'langan (BACKEND_TASKS.md 3-qism): birinchi bog'lashda `device_secret` saqlanadi va
// keyingi login'da `X-Device-Secret` bilan yuboriladi (chiqishda o'chmaydi); profilda "Qurilmalarim" (faqat ko'rish);
// 3-qurilma → DEVICE_NOT_ALLOWED xabari; admin qurilmani sabab bilan olib tashlaydi; refresh → 401 DEVICE_REMOVED
// bo'lsa login sahifasida "qurilma olib tashlangan" va eski sir o'chiriladi; telefon o'lchamida gorizontal scroll yo'q.
import { launch, BASE, API_HOST, reset, mockGet, ignorablePageError } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const USER_ID = "u1u1u1u1-u1u1-4u1u-8u1u-u1u1u1u1u1u1";
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const pageErrors = [];
const newPage = async (viewport = { width: 1280, height: 860 }) => {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
  return p;
};
let page = await newPage();
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-devices-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });
const login = async (p, email = "user@articles365.local", pass = "User12345!") => {
  await p.goto(`${BASE}/login`);
  await p.fill('input[autocomplete="username"]', email);
  await p.fill('input[type="password"]', pass);
  await p.click('button[type="submit"]');
};
const secretOf = (p) => p.evaluate(() => localStorage.getItem("a365.device.secret"));
const loginHeaders = async () => (await mockGet("/__headers")).filter((h) => h.path === "/auth/login");

// ---- 1-qurilma: birinchi bog'lash → sir saqlanadi
await login(page);
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
const secret1 = await secretOf(page);
const bound = await mockGet("/__devices");
check("Birinchi login: device_secret saqlandi (serverdagi bilan bir xil)", !!secret1 && bound.length === 1 && bound[0].secret === secret1);
check("Birinchi login'da X-Device-Secret yuborilmadi (hali yo'q)", (await loginHeaders()).at(-1)?.secret === null);

// Chiqish → qayta kirish: sir o'chmaydi va sarlavhada yuboriladi, yangi qurilma bog'lanmaydi
await page.click('header [data-testid="user-menu"]');
await page.click('[data-testid="logout"]');
await page.waitForURL((u) => u.pathname === "/login");
check("Chiqishda qurilma siri saqlanib qoladi", (await secretOf(page)) === secret1);
await login(page);
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
check("Qayta login: X-Device-Secret yuborildi", (await loginHeaders()).at(-1)?.secret === secret1);
check("Qayta login: yangi qurilma bog'lanmadi (1 ta)", (await mockGet("/__devices")).length === 1);

// ---- Profil: "Qurilmalarim" — faqat ko'rish, "Shu qurilma" belgisi, o'chirish tugmasi yo'q
await page.goto(`${BASE}/profile`);
await page.waitForSelector('[data-testid="my-device"]', { timeout: 15000 });
const myDevText = (await page.textContent('[data-testid="my-devices"]')) ?? "";
check("Profil: Qurilmalarim — 1 ta, 'Shu qurilma', limit 2 ta", (await page.locator('[data-testid="my-device"]').count()) === 1 && myDevText.includes("Shu qurilma") && myDevText.includes("2 ta"));
check("Profil: qurilmani o'chirish tugmasi yo'q (faqat admin)", (await page.locator('[data-testid="my-devices"] button').count()) === 0);
await page.screenshot({ path: OUT + "60-my-devices.png", fullPage: true });

// ---- 2-qurilma bog'lanadi, 3-si — DEVICE_NOT_ALLOWED (limit yoqilgan)
await fetch(`${API_HOST}/__devicelimit?on=1`);
const page2 = await newPage();
await login(page2);
await page2.waitForURL(`${BASE}/library`, { timeout: 30000 });
check("2-qurilma bog'landi", (await mockGet("/__devices")).filter((d) => !d.removed_at).length === 2);
const page3 = await newPage({ width: 360, height: 740 });
await login(page3);
await page3.waitForSelector('[data-testid="device-not-allowed"]', { timeout: 15000 });
const denied = (await page3.textContent('[data-testid="device-not-allowed"]')) ?? "";
check("3-qurilma: 'allaqachon 2 ta qurilmaga bog'langan' + administratorga murojaat", denied.includes("2 ta qurilmaga bog'langan") && denied.includes("administratorga"));
check("3-qurilma: login sahifasida qoldi, sir berilmadi", page3.url().includes("/login") && (await secretOf(page3)) === null);
const sw = await page3.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check("3-qurilma xabari 360px'da: gorizontal scroll yo'q", sw <= 1, `+${sw}px`);
await page3.screenshot({ path: OUT + "61-device-not-allowed-360.png", fullPage: true });

// ---- Admin: foydalanuvchi qurilmalari, sabab bilan olib tashlash
const admin = await newPage();
await login(admin, "admin@articles365.local", "Admin12345!");
await admin.waitForURL(`${BASE}/library`, { timeout: 30000 });
await admin.goto(`${BASE}/admin/users/${USER_ID}`);
await admin.waitForSelector('[data-testid="admin-device"]', { timeout: 15000 });
check("Admin: foydalanuvchida 2 ta bog'langan qurilma", (await admin.locator('[data-testid="admin-device"]').count()) === 2);
await admin.locator('[data-testid="device-remove"]').first().click();
await admin.waitForSelector('[data-testid="device-remove-reason"]');
check("Admin: sababsiz olib tashlab bo'lmaydi (tugma o'chiq)", await admin.locator('[data-testid="device-remove-submit"]').isDisabled());
await admin.fill('[data-testid="device-remove-reason"]', "Telefon almashtirildi");
await admin.click('[data-testid="device-remove-submit"]');
await admin.waitForFunction(() => document.querySelectorAll('[data-testid="device-remove"]').length === 1, null, { timeout: 10000 });
const removed = (await mockGet("/__devices")).filter((d) => d.removed_at);
check("Admin: qurilma olib tashlandi, sabab saqlandi; ro'yxatda tarix sifatida qoladi", removed.length === 1 && removed[0].remove_reason === "Telefon almashtirildi" && (await admin.locator('[data-testid="admin-device"]').count()) === 2);
await admin.screenshot({ path: OUT + "62-admin-devices.png", fullPage: true });

// Bo'shagan joyga 3-qurilma endi kira oladi
await login(page3);
await page3.waitForURL(`${BASE}/library`, { timeout: 30000 });
check("Admin olib tashlagach: yangi qurilma bog'landi", (await mockGet("/__devices")).filter((d) => !d.removed_at).length === 2 && !!(await secretOf(page3)));

// ---- Refresh → 401 DEVICE_REMOVED: login sahifasida "qurilma olib tashlangan", eski sir o'chiriladi
await fetch(`${API_HOST}/__device-removed?on=1`);
await fetch(`${API_HOST}/__expire?token=access-token-1`);
await page.goto(`${BASE}/profile`);
await page.waitForSelector('[data-testid="device-removed"]', { timeout: 20000 });
const q = new URL(page.url()).searchParams;
check("DEVICE_REMOVED: login?reason=device_removed + xabar", q.get("reason") === "device_removed" && ((await page.textContent('[data-testid="device-removed"]')) ?? "").includes("olib tashlangan"));
check("DEVICE_REMOVED: eskirgan qurilma siri o'chirildi", (await secretOf(page)) === null);
await page.screenshot({ path: OUT + "63-device-removed.png", fullPage: true });

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
