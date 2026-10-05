// 44.1 — Ro'yxatdan faqat telefon bilan: email maydoni yo'q, raqam E.164 ga keltiriladi ("90 123 45 67" → +998901234567),
// noto'g'ri raqam — tushunarli xato (serverga so'rov yo'q), band raqam — 409 xabari; keyin shu raqam bilan (istalgan
// ko'rinishda yozilsa ham) kirish ishlaydi; telefonda forma sig'adi.
import { launch, BASE, reset, mockGet, ignorablePageError } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-register-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });
const registers = async () => (await mockGet("/__log")).filter((l) => l === "POST /auth/register").length;
const fill = async (phone, pw = "Parol12345") => {
  await page.fill('[data-testid="register-phone"]', phone);
  const pws = page.locator('input[autocomplete="new-password"]');
  await pws.nth(0).fill(pw);
  await pws.nth(1).fill(pw);
};

await page.goto(`${BASE}/register`);
await page.waitForSelector('[data-testid="register-form"]');
check("Formada email maydoni yo'q, telefon maydoni bor (type=tel)", (await page.locator('[data-testid="register-form"] input[type="email"], [data-testid="register-form"] input[autocomplete="username"]').count()) === 0 && (await page.getAttribute('[data-testid="register-phone"]', "type")) === "tel");

// Noto'g'ri raqam — serverga yuborilmaydi
await fill("12345");
await page.click('button[type="submit"]');
await page.waitForSelector("text=+998 90 123 45 67 ko'rinishida", { timeout: 5000 });
check("Noto'g'ri raqam: tushunarli xato, so'rov yo'q", (await registers()) === 0);

// Mahalliy ko'rinish → E.164
await page.fill('input[autocomplete="name"]', "Ali Valiyev");
await fill("90 123 45 67");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
const u = (await mockGet("/__users")).at(-1);
check("Ro'yxatdan o'tdi: phone +998901234567, email yo'q, ism saqlandi", u?.phone === "+998901234567" && u?.email === null && u?.full_name === "Ali Valiyev", JSON.stringify({ phone: u?.phone, email: u?.email }));
check("Darhol kirildi (/library)", page.url().endsWith("/library"));

// Chiqish → boshqa ko'rinishda yozilgan shu raqam bilan kirish
await page.evaluate(() => { localStorage.removeItem("a365.access"); localStorage.removeItem("a365.refresh"); document.cookie = "a365_auth=; path=/; max-age=0"; });
await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "+998 (90) 123-45-67");
await page.fill('input[type="password"]', "Parol12345");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`, { timeout: 30000 });
check("Login: '+998 (90) 123-45-67' → shu akkauntga kirildi", true);

// Band raqam — 409
await page.evaluate(() => { localStorage.removeItem("a365.access"); localStorage.removeItem("a365.refresh"); document.cookie = "a365_auth=; path=/; max-age=0"; });
await page.goto(`${BASE}/register`);
await page.waitForSelector('[data-testid="register-form"]');
await fill("998901234567");
await page.click('button[type="submit"]');
await page.waitForSelector('[data-testid="register-form"] .alert', { timeout: 5000 });
check("Band raqam: xato xabari (409), sahifada qoldi", page.url().endsWith("/register"));
const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
check("390px: forma sig'adi", sw <= 1, `+${sw}`);
await page.screenshot({ path: OUT + "80-register-phone-390.png", fullPage: true });

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
