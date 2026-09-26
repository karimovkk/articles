// 9.3 — access token muddati tugashi: 401 → refresh (single-flight) → qayta so'rov; reader Range o'rtasida; refresh xatosi → login
import { launch, BASE, API, reset, mockGet, ignorablePageError } from "../lib.mjs";
const ART1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MOCK = API.replace("/api/v1", "");
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await browser.close(); process.exit(1); });
const logSince = async (from) => (await mockGet("/__log")).slice(from);

await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);
await page.waitForSelector("text=Test kitob", { timeout: 10000 });

// ---- 1) Token eskirdi → profil (parallel: /sessions, /orders, /auth/me) → bitta refresh, hammasi qayta
await fetch(`${MOCK}/__expire?token=access-token-1`);
let n = (await mockGet("/__log")).length;
await page.goto(`${BASE}/profile`);
await page.waitForSelector('[data-testid="my-devices"]', { timeout: 10000 });
await page.waitForSelector("text=joriy", { timeout: 10000 });
let log = await logSince(n);
const refreshes = log.filter((l) => l === "POST /auth/refresh").length;
check("401 → refresh → qayta so'rov: profil ma'lumotlari ochildi", true);
check("Parallel so'rovlarda faqat 1 ta refresh (single-flight)", refreshes === 1, `refresh=${refreshes}; ${log.filter((l) => l.includes("sessions") || l.includes("refresh")).join(",")}`);
check("Login sahifasiga yo'naltirilmadi", page.url().includes("/profile"));

// ---- 2) Reader: o'qish paytida token eskiradi → keyingi Range bo'laklari refresh bilan davom etadi
await page.goto(`${BASE}/reader/${ART1}`);
await page.waitForFunction(() => [...document.querySelectorAll(".reader-page canvas")].some((c) => c.width > 0), null, { timeout: 20000 });
await fetch(`${MOCK}/__expire?token=access-token-1b`); // rotatsiyadan keyingi token
n = (await mockGet("/__log")).length;
// 6-sahifaga o'tish → yangi Range so'rovlari (mock 512KB chunk, kichik PDF — bo'lak allaqachon bor, shuning uchun progress/annotations so'rovlarida sinaladi)
await page.fill('input[aria-label="Sahifa"]', "6");
await page.press('input[aria-label="Sahifa"]', "Enter");
await page.waitForFunction(() => document.querySelector('button[aria-pressed="true"]') !== null, null, { timeout: 10000 }); // avtomatik mark-read (POST → 401 → refresh → 200)
log = await logSince(n);
check("Reader ichida: eskirgan token bilan so'rov → refresh → muvaffaqiyat (mark-read/progress)", log.includes("POST /auth/refresh") && log.some((l) => l.includes("mark-read")), log.filter((l) => l.includes("refresh") || l.includes("mark-read")).join(","));
check("Reader xato ekraniga tushmadi", (await page.locator(".reader-page").count()) === 6);
const prog = Object.values(await mockGet("/__progress")).find((p) => p.article_id === ART1);
check("Progress saqlandi (yangi token bilan)", prog?.is_read === true);

// ---- 3) Eski refresh tokenni qayta ishlatish → INVALID_TOKEN (rotatsiya)
const reuse = await (await fetch(`${API}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: "refresh-1" }) })).json();
check("Ishlatilgan refresh token → INVALID_TOKEN", reuse?.error?.code === "INVALID_TOKEN");

// ---- 4) Sessiya butunlay bekor: refresh ham ishlamaydi → tokenlar tozalanadi → /login?reason=expired
await fetch(`${MOCK}/__expire?token=access-token-1c&all=1`);
await page.goto(`${BASE}/library`);
await page.waitForURL((u) => u.pathname === "/login" && u.searchParams.get("reason") === "expired", { timeout: 15000 });
await page.waitForSelector("text=Sessiya muddati tugadi", { timeout: 5000 });
check("Refresh xatosi → /login?reason=expired + xabar", true);
check("Tokenlar tozalandi (localStorage)", await page.evaluate(() => !localStorage.getItem("a365.access") && !localStorage.getItem("a365.refresh")));
check("Cookie bayrog'i o'chirildi (proxy guard)", !(await page.evaluate(() => document.cookie.includes("a365_auth=1"))));

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
