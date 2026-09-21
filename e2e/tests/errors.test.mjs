// Task 3 tekshiruvi: xato kodlari xaritasi, DEVICE_LIMIT_REACHED UX, ngrok/X-Device-Id header, upload progress + validatsiya
import { launch, BASE, API, reset, mockGet, IS_CHROMIUM } from "../lib.mjs";
import { mkdirSync, writeFileSync } from "node:fs";

const BOOK = "11111111-1111-4111-8111-111111111111";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};
await reset("");

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => {
  console.log("❌ XATO:", e.message.split("\n")[0]);
  await page.screenshot({ path: OUT + "99-errors-failure.png" }).catch(() => {});
  await browser.close();
  process.exit(1);
});

const login = async (email, pass) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[autocomplete="username"]', email);
  await page.fill('input[type="password"]', pass);
  await page.click('button[type="submit"]');
};

// ---- 3.1 INVALID_CREDENTIALS → o'zbekcha matn (backend "Invalid credentials" emas)
await login("user@articles365.local", "wrong");
await page.waitForSelector("text=Login yoki parol noto'g'ri", { timeout: 5000 });
check("INVALID_CREDENTIALS → xaritadagi matn", true);
check("Backend inglizcha xabari ko'rinmaydi", (await page.locator("text=Invalid credentials").count()) === 0);

// ---- 3.2 DEVICE_LIMIT_REACHED
await login("limit@articles365.local", "x");
await page.waitForSelector("text=Qurilmalar limiti to'ldi (2 ta)", { timeout: 5000 });
check("DEVICE_LIMIT_REACHED → maxsus xabar, details.limit (2 ta)", true);
check("Yo'l-yo'riq (Profil → Sessiyalar) + faol qurilmalar ro'yxati", (await page.locator("text=Sessiyalar").count()) > 0 && (await page.locator("text=Chrome · Windows").count()) === 1);
await page.screenshot({ path: OUT + "10-device-limit.png" });

// ---- 3.3 Header'lar
await login("user@articles365.local", "User12345!");
await page.waitForURL(`${BASE}/library`);
const hdrs = await mockGet("/__headers");
const apiCalls = hdrs.filter((h) => !h.path.startsWith("/__"));
check("Barcha so'rovlarda ngrok-skip-browser-warning: 1", apiCalls.length > 0 && apiCalls.every((h) => h.ngrok === "1"), `${apiCalls.filter((h) => h.ngrok !== "1").map((h) => h.path).join(",") || "ok"}`);
check("Barcha so'rovlarda X-Device-Id", apiCalls.every((h) => typeof h.device === "string" && h.device.length > 8));
const devices = new Set(apiCalls.map((h) => h.device));
check("X-Device-Id barqaror (bitta qiymat)", devices.size === 1, `${devices.size}`);

// ---- 5xx → INTERNAL_ERROR matni (admin audit sahifasi)
await page.click('header [data-testid="user-menu"]');
await page.click('[data-testid="logout"]');
await page.waitForURL((u) => u.pathname === "/login");
check("Logout → /login", true);
await login("admin@articles365.local", "Admin12345!");
await page.waitForURL(`${BASE}/library`);
await fetch(`${API.replace("/api/v1", "")}/__set500?on=1`);
await page.goto(`${BASE}/admin/audit-logs`);
await page.waitForSelector("text=Serverda xatolik yuz berdi", { timeout: 8000 });
check("500 INTERNAL_ERROR → tushunarli matn", true);
await fetch(`${API.replace("/api/v1", "")}/__set500?on=0`);

// ---- 3.4 Upload: validatsiya (PDF emas) — so'rov yuborilmaydi
await page.goto(`${BASE}/admin/books/${BOOK}`);
await page.waitForSelector("text=Maqolalar (3)", { timeout: 8000 });
await page.click('[data-testid="tab-articles"]');
const fake = OUT + "fake.pdf";
writeFileSync(fake, "hello, not a pdf");
const pickPdf = async (file) => {
  const fc = page.waitForEvent("filechooser");
  await page.locator("tr", { hasText: "Birinchi maqola" }).locator('button:has-text("PDF")').click();
  await (await fc).setFiles(file);
};
await pickPdf(fake);
await page.waitForSelector("text=Fayl PDF formatida emas", { timeout: 5000 });
let ups = await mockGet("/__uploads");
check("Yaroqsiz PDF: klient xabari, serverga so'rov yo'q", ups.length === 0);
// muqova: matn fayl
const fakeImg = OUT + "fake.png";
writeFileSync(fakeImg, "not an image");
await page.setInputFiles('input[accept="image/*"]', fakeImg);
await page.waitForSelector("text=JPEG, PNG yoki WebP", { timeout: 5000 });
check("Yaroqsiz muqova: klient xabari", true);

// ---- 3.4 Upload: 3 MB "PDF" (magic bytes + ballast) → progress bar → notice
const BIG = OUT + "big.pdf";
writeFileSync(BIG, Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(3 * 1024 * 1024, 65)]));
// Upload tezligini cheklash (oraliq progress hodisalari ko'rinishi uchun) — faqat Chromium (CDP)
const cdp = IS_CHROMIUM ? await page.context().newCDPSession(page) : null;
if (cdp) {
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: (8 * 1024 * 1024) / 8 });
}
const progressSeen = [];
const poll = setInterval(async () => {
  const v = await page.$eval('[role="progressbar"]', (e) => e.getAttribute("aria-valuenow")).catch(() => null);
  if (v !== null) progressSeen.push(Number(v));
}, 20);
await pickPdf(BIG);
await page.waitForFunction(() => [...document.querySelectorAll("tr")].some((r) => r.innerText.includes("Birinchi maqola") && r.innerText.includes("PROCESSING")), null, { timeout: 30000 });
clearInterval(poll);
if (cdp) await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
ups = await mockGet("/__uploads");
check("PDF maqola endpointiga multipart yuborildi", ups.length === 1 && ups[0].path.endsWith("/file") && ups[0].contentType === "multipart/form-data" && ups[0].size > 3 * 1024 * 1024, JSON.stringify(ups));
const distinct = [...new Set(progressSeen)];
check(IS_CHROMIUM ? "Progress bar oraliq foizlarni ko'rsatdi (≥90% kuzatildi)" : "Progress bar ko'rindi (throttle'siz — Firefox)", IS_CHROMIUM ? distinct.length >= 3 && Math.max(...distinct) >= 90 : distinct.length >= 1, `${distinct.join(",")}`);
check("Yuklashdan keyin PROCESSING holati ko'rinadi", true);
await page.screenshot({ path: OUT + "11-upload-done.png" });

// ---- Muqova: 1x1 PNG
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
writeFileSync(OUT + "cover.png", png);
await page.setInputFiles('input[accept="image/*"]', OUT + "cover.png");
await page.waitForSelector("text=Muqova yuklandi", { timeout: 10000 });
ups = await mockGet("/__uploads");
check("Muqova yuklandi (magic bytes o'tdi)", ups.length === 2 && ups[1].path.endsWith("/cover"));

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
