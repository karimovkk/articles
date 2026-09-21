// 11.2 — jonli qidiruv: tugmasiz, yozilayotganda (debounce), fokus saqlanadi, eskirgan javob yangisini bosmaydi,
// URL sinxron (katalog), Enter darhol, admin ro'yxatlar va reader qidiruvi
import { launch, BASE, reset, mockGet, makeCheck } from "../lib.mjs";
const API_HOST = process.env.E2E_API ?? "http://localhost:8001";
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const { check, done } = makeCheck();
await reset("");
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => {
  console.log("❌ XATO:", e.message.split("\n")[0]);
  await browser.close();
  process.exit(1);
});
const bodyHas = async (text) => page.evaluate((t) => document.body.innerText.includes(t), text);
const countCalls = async (line) => (await mockGet("/__log")).filter((l) => l === line).length;

// ---- Katalog (mehmon): tugma yo'q, yozilayotganda so'raladi, URL ?q=, fokus saqlanadi
await page.goto(`${BASE}/catalog`);
await page.waitForSelector("text=Test kitob");
check("Katalog: 'Qidirish' tugmasi yo'q", (await page.locator('form[role="search"] button[type="submit"]').count()) === 0);
const input = page.locator('[data-testid="catalog-search"]');
const before = await countCalls("GET /catalog");
await input.click();
await input.pressSequentially("Kitob 1", { delay: 40 }); // ~280 ms — debounce ichida bitta so'rov
await page.waitForURL((u) => u.searchParams.get("q") === "Kitob 1", { timeout: 5000 });
await page.waitForFunction(() => !document.body.innerText.includes("Kitob 2\n") && document.body.innerText.includes("Kitob 1"), null, { timeout: 8000 });
check("Katalog: yozilgach URL ?q= (replace) va natijalar filtrlandi", true);
check("Katalog: fokus input'da qoldi", await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "catalog-search"));
const calls1 = (await countCalls("GET /catalog")) - before;
check("Katalog: debounce — har harfga emas (7 harf), 1–2 so'rov", calls1 >= 1 && calls1 <= 2, `${calls1}`);
check("Katalog: tarix ifloslanmadi (replace)", (await page.evaluate(() => history.length)) <= 3, `${await page.evaluate(() => history.length)}`);

// tozalash → q yo'qoladi
await input.fill("");
await page.waitForURL((u) => !u.searchParams.get("q"), { timeout: 5000 });
await page.waitForSelector("text=Kitob 2", { timeout: 8000 });
check("Katalog: bo'shatilganda ?q= olib tashlanadi, hamma kitoblar", true);

// ---- Poyga: "Kitob 1" javobi 1.5 s kechikadi, "Kitob 12" tez keladi → ekranda "Kitob 12" qolishi kerak
await fetch(`${API_HOST}/__delay?search=${encodeURIComponent("Kitob 1")}&ms=1500`);
await input.pressSequentially("Kitob 1", { delay: 20 });
await page.waitForTimeout(400); // debounce → "Kitob 1" so'rovi ketdi (kechikadi)
await input.pressSequentially("2", { delay: 20 });
await page.waitForURL((u) => u.searchParams.get("q") === "Kitob 12", { timeout: 5000 });
await page.waitForFunction(() => document.body.innerText.includes("Kitob 12") && !document.body.innerText.includes("Kitob 11"), null, { timeout: 8000 });
await page.waitForTimeout(1800); // kechikkan javob keldi
check("Poyga: eskirgan ('Kitob 1') javob yangi ('Kitob 12') natijani bosmadi", (await bodyHas("Kitob 12")) && !(await bodyHas("Kitob 11")) && !(await bodyHas("Kitob 10")));
check("Poyga: input qiymati saqlandi", (await input.inputValue()) === "Kitob 12");
await fetch(`${API_HOST}/__delay?off=1`);

// ---- Enter → kutmasdan (debounce'dan oldin)
await input.fill("");
await page.waitForURL((u) => !u.searchParams.get("q"), { timeout: 5000 });
await input.pressSequentially("Kitob 3", { delay: 10 });
await input.press("Enter");
await page.waitForURL((u) => u.searchParams.get("q") === "Kitob 3", { timeout: 1000 }).then(() => check("Enter: darhol qidirdi (flush)", true)).catch(() => check("Enter: darhol qidirdi (flush)", false));

// ---- Orqaga (tarix) → input URL'dan yangilanadi
await page.goto(`${BASE}/catalog?q=Kitob%205`);
await page.waitForSelector("text=Kitob 5", { timeout: 8000 });
check("URL'dan ochilganda input to'ldirilgan", (await input.inputValue()) === "Kitob 5");
await page.goto(`${BASE}/catalog?q=Kitob%207`);
await page.waitForFunction(() => document.querySelector('[data-testid="catalog-search"]')?.value === "Kitob 7", null, { timeout: 5000 });
check("Tashqi URL o'zgarishi → input yangilandi", true);

// ---- Kutubxona (foydalanuvchi)
await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);
await page.waitForSelector("text=Test kitob");
check("Kutubxona: 'Qidirish' tugmasi yo'q", (await page.locator('form[role="search"] button[type="submit"]').count()) === 0);
const lib = page.locator('[data-testid="library-search"]');
await lib.pressSequentially("yo'q kitob", { delay: 20 });
await page.waitForSelector("text=Kutubxonangiz bo'sh", { timeout: 8000 });
check("Kutubxona: yozilgach natija (bo'sh holat)", true);
check("Kutubxona: fokus saqlandi", await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "library-search"));
await lib.fill("Test");
await page.waitForSelector("text=Test kitob", { timeout: 8000 });
check("Kutubxona: qayta yozilgach natija qaytdi", true);

// ---- Reader: sidebar qidiruvi jonli (≥2 belgi), tugmasiz
await page.goto(`${BASE}/reader/${ART}`);
await page.waitForFunction(() => document.querySelector(".reader-page canvas")?.width > 0, null, { timeout: 20000 });
await page.click('button[title="Panel"]');
await page.click("text=Qidiruv");
check("Reader: qidiruv tugmasi yo'q", (await page.locator('aside form[role="search"] button').count()) === 0);
await page.fill('aside input[placeholder="Kitob ichida qidirish…"]', "t");
await page.waitForTimeout(600);
const s0 = (await mockGet("/__log")).filter((l) => l.includes("/search")).length;
check("Reader: 1 belgida so'rov ketmadi", s0 === 0, `${s0}`);
await page.fill('aside input[placeholder="Kitob ichida qidirish…"]', "test");
await page.waitForSelector("text=2-bet", { timeout: 8000 });
check("Reader: yozilgach natija (2-bet)", true);

// ---- Admin: kitoblar ro'yxati jonli
await page.goto(`${BASE}/library`);
await page.click('header [data-testid="user-menu"]');
await page.click('[data-testid="logout"]');
await page.waitForURL((u) => u.pathname === "/login");
await page.fill('input[autocomplete="username"]', "admin@articles365.local");
await page.fill('input[type="password"]', "Admin12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);
await page.goto(`${BASE}/admin/books`);
await page.waitForSelector("text=Jami: 31", { timeout: 10000 });
check("Admin kitoblar: tugma yo'q", (await page.locator('form[role="search"] button[type="submit"]').count()) === 0);
await page.locator('form[role="search"] input[type="search"]').pressSequentially("Kitob 2", { delay: 20 });
await page.waitForFunction(() => /Jami: (1|11)\b/.test(document.body.innerText) && !document.body.innerText.includes("Jami: 31"), null, { timeout: 8000 });
check("Admin kitoblar: yozilgach filtrlandi", true);
await page.goto(`${BASE}/admin/audit-logs`);
await page.waitForSelector("text=BOOK_ACCESS_GRANTED", { timeout: 10000 });
check("Audit: 'Filtrlash' tugmasi yo'q", (await page.locator('form[role="search"] button[type="submit"]').count()) === 0);
await page.locator('form[role="search"] input:not([type="search"])').first().pressSequentially("user", { delay: 20 });
await page.waitForFunction(() => document.body.innerText.includes("SUSPICIOUS_ACTIVITY") && !document.body.innerText.includes("BOOK_ACCESS_GRANTED"), null, { timeout: 8000 });
check("Audit: entity jonli filtrlandi", true);

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await done(browser);
