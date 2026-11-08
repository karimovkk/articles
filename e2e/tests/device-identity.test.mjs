// Qurilma kaliti (backend DEVICE_IDENTITY_MODE=cookie): server bergan HttpOnly cookie qurilmani tanitadi.
//  - auth so'rovlari doim same-origin (`/api/v1/auth/*` → Next rewrite) — aks holda cookie saqlanmaydi;
//  - cookie'siz yangi qurilma → 428 + probe → frontend so'rovni bir marta takrorlaydi (foydalanuvchi sezmaydi);
//  - cookie JS'ga ko'rinmaydi; chiqish, localStorage yo'qolishi va User-Agent (browser update) qurilmani o'zgartirmaydi;
//  - refresh → 401 DEVICE_MISMATCH: login sahifasida mos xabar; admin "Qurilmalar tekshiruvi" sahifasida qaror qiladi.
import { launch, BASE, API_HOST, reset, mockGet, ignorablePageError } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");
await fetch(`${API_HOST}/__devicemode?cookie=1`);

const browser = await launch();
const pageErrors = [];
const authRequests = [];
const open = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...opts });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
  p.on("request", (r) => /\/api\/v1\/auth\//.test(r.url()) && authRequests.push(r.url()));
  return { ctx, page: p };
};
const login = async (p, email = "user@articles365.local", pass = "User12345!") => {
  await p.goto(`${BASE}/login`);
  await p.fill('input[autocomplete="username"]', email);
  await p.fill('input[type="password"]', pass);
  await p.click('button[type="submit"]');
};
const logout = async (p) => {
  await p.click('header [data-testid="user-menu"]');
  await p.click('[data-testid="logout"]');
  await p.waitForURL((u) => u.pathname === "/login");
};
const active = async () => (await mockGet("/__devices")).filter((d) => !d.removed_at);
const deviceCookie = async (ctx) => (await ctx.cookies()).find((c) => c.name === "a365_dev_mock");
const loginStatuses = async () => (await mockGet("/__log")).filter((l) => l.startsWith("POST /auth/login"));

// ---- Birinchi kirish: 428 → bir marta takror → kirildi
let { ctx, page } = await open({ userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Safari/537.36" });
await login(page);
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
check("Birinchi kirish: 428 dan keyin so'rov bir marta takrorlandi va kirildi", (await loginStatuses()).length === 2 && (await active()).length === 1);
const c1 = await deviceCookie(ctx);
check("Qurilma cookie'si: HttpOnly, Path=/api/v1/auth, Lax", !!c1 && c1.httpOnly && c1.path === "/api/v1/auth" && c1.sameSite === "Lax");
check("Qurilma cookie'si JavaScript'ga ko'rinmaydi", !(await page.evaluate(() => document.cookie)).includes("a365_dev_mock"));
check("Auth so'rovlari same-origin (frontend domeni orqali)", authRequests.length > 0 && authRequests.every((u) => u.startsWith(BASE)), authRequests.filter((u) => !u.startsWith(BASE)).join(", "));
const deviceId = (await active())[0].id;

// ---- Chiqish → qayta kirish: o'sha qurilma, o'sha kalit
await logout(page);
await login(page);
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
check("Chiqib-kirish: yangi qurilma yaratilmadi, kalit o'zgarmadi", (await active()).length === 1 && (await active())[0].id === deviceId && (await deviceCookie(ctx))?.value === c1.value);

// ---- localStorage'dagi eski UUID yo'qoldi → cookie orqali tanildi
await logout(page);
await page.evaluate(() => localStorage.clear());
await login(page);
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
check("localStorage tozalandi: qurilma cookie orqali tanildi", (await active()).length === 1 && (await active())[0].id === deviceId);

// ---- Browser update: User-Agent butunlay boshqa, profil (cookie) o'sha
const state = await ctx.storageState();
await ctx.close();
({ ctx, page } = await open({ storageState: state, userAgent: "Mozilla/5.0 (Windows NT 11.0) Chrome/156.0.0.0 Safari/537.36" }));
await page.goto(`${BASE}/profile`);
await page.waitForSelector('[data-testid="my-device"]', { timeout: 20000 });
await logout(page);
await login(page);
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
check("Browser update (boshqa User-Agent): o'sha qurilma, uchinchi slot band qilinmadi", (await active()).length === 1 && (await active())[0].id === deviceId);
await page.goto(`${BASE}/profile`);
await page.waitForSelector('[data-testid="my-device"]', { timeout: 20000 });
check("Profil: 'Shu qurilma' belgisi cookie bo'yicha", ((await page.textContent('[data-testid="my-devices"]')) ?? "").includes("Shu qurilma"));

// ---- Yangi profil — yangi qurilma; limit to'lganda 3-chi bloklanadi
await fetch(`${API_HOST}/__devicelimit?on=1`);
const second = await open();
await login(second.page);
await second.page.waitForURL(`${BASE}/library`, { timeout: 30000 });
const third = await open();
await login(third.page);
await third.page.waitForSelector('[data-testid="device-not-allowed"]', { timeout: 15000 });
check("Boshqa profil = yangi qurilma (2/2), 3-chi bloklandi", (await active()).length === 2 && third.page.url().includes("/login"));

// ---- Refresh → 401 DEVICE_MISMATCH: login sahifasida xabar
await fetch(`${API_HOST}/__device-mismatch?on=1`);
await fetch(`${API_HOST}/__expire?token=access-token-1`);
await page.goto(`${BASE}/profile`);
await page.waitForSelector('[data-testid="device-mismatch"]', { timeout: 20000 });
check("DEVICE_MISMATCH: login?reason=device_mismatch + xabar", new URL(page.url()).searchParams.get("reason") === "device_mismatch");
await page.screenshot({ path: OUT + "64-device-mismatch.png", fullPage: true });
await fetch(`${API_HOST}/__device-mismatch?on=0`);

// ---- Admin: qurilmalar tekshiruvi (migratsiya taxmin qilmagan qurilma)
await fetch(`${API_HOST}/__device-review?reason=ua_identity`);
const admin = await open();
await login(admin.page, "admin@articles365.local", "Admin12345!");
await admin.page.waitForURL(`${BASE}/library`, { timeout: 30000 });
await admin.page.goto(`${BASE}/admin/device-reviews`);
await admin.page.waitForSelector('[data-testid="device-review-row"]', { timeout: 20000 });
const rowText = (await admin.page.textContent('[data-testid="device-review-row"]')) ?? "";
check("Tekshiruv sahifasi: qurilma va sababi ko'rinadi", rowText.includes("User-Agent") && (await admin.page.locator('[data-testid="device-review-row"]').count()) === 1);
await admin.page.screenshot({ path: OUT + "65-device-reviews.png", fullPage: true });
await admin.page.click('[data-testid="device-review-keep"]');
await admin.page.waitForSelector('[data-testid="device-review-reason"]');
check("Tekshiruv: sababsiz tasdiqlab bo'lmaydi", await admin.page.locator('[data-testid="device-review-submit"]').isDisabled());
await admin.page.fill('[data-testid="device-review-reason"]', "Mijoz bilan tekshirildi");
await admin.page.click('[data-testid="device-review-submit"]');
await admin.page.waitForSelector('[data-testid="device-reviews-empty"]', { timeout: 10000 });
const resolved = (await mockGet("/__devices")).find((d) => d.review_resolution);
check("Tekshiruv hal qilindi: keep, qurilma bog'langan qoldi", resolved?.review_resolution === "keep" && !resolved.removed_at);
const sw = await admin.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check("Tekshiruv sahifasi: gorizontal scroll yo'q", sw <= 1, `+${sw}px`);

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
