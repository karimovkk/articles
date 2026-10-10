// 85: admin — ko'p kitob chegirma pog'onalari: jadval (nechta kitobdan — har biri — faol), qo'shish/o'chirish,
// tekshiruv (takroriy son, son < 1, narx ≤ 0), saqlash — PUT butun jadval; mijozga ko'rinishi va misol hisob;
// public `/pricing` va katalogdagi aksiya zinapoyasi yangilanadi; telefonda sig'adi.
import { launch, BASE, API_HOST, reset, mockGet, mockWait, ignorablePageError, makeCheck } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
const { check, done } = makeCheck();
await reset("");
const browser = await launch();
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
page.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "admin@articles365.local");
await page.fill('input[type="password"]', "Admin12345!");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
await page.goto(`${BASE}/admin`);
await page.waitForSelector('a[href="/admin/pricing"]', { timeout: 15000 });
check("Admin menyusida 'Chegirmalar'", ((await page.textContent('a[href="/admin/pricing"]')) ?? "").includes("Chegirmalar"));
await page.click('a[href="/admin/pricing"]');
await page.waitForSelector('[data-testid="tier-row"]', { timeout: 15000 });

const rows = () => page.evaluate(() => [...document.querySelectorAll('[data-testid="tier-row"]')].map((r) => [r.querySelector('[data-testid="tier-min"]').value, r.querySelector('[data-testid="tier-price"]').value, r.querySelector('[data-testid="tier-active"]').getAttribute("aria-checked")]));
check("Serverdagi pog'onalar: 2 ta → 39 000, 3 ta → 30 000 (faol)", JSON.stringify(await rows()) === JSON.stringify([["2", "39000", "true"], ["3", "30000", "true"]]), JSON.stringify(await rows()));
const preview = () => page.evaluate(() => document.querySelector('[data-testid="tier-preview"] .tier-ladder').innerText.replace(/\s+/g, " ").trim());
check("Mijozga ko'rinishi: 1 ta — o'z narxi, 2 ta — 39 000, 3+ ta — 30 000", /1 ta o'z narxi/i.test(await preview()) && (await preview()).includes("39 000") && /3\+ ta/i.test(await preview()), await preview());
check("Saqlash — o'zgarish yo'q bo'lsa o'chiq", await page.isDisabled('[data-testid="tier-save"]'));

// Qo'shish: avtomatik 4 ta → 25 000; takroriy son — xato, saqlab bo'lmaydi
await page.click('[data-testid="tier-add"]');
check("Qo'shish: keyingi son (4) va arzonroq narx (25 000) taklif qilinadi", JSON.stringify((await rows())[2]) === JSON.stringify(["4", "25000", "true"]), JSON.stringify(await rows()));
const newRow = page.locator('[data-testid="tier-row"]').nth(2);
await newRow.locator('[data-testid="tier-min"]').fill("2");
check("Takroriy son — xato va saqlash o'chiq", ((await page.locator('[data-testid="tier-error"]').first().textContent()) ?? "").includes("allaqachon bor") && (await page.isDisabled('[data-testid="tier-save"]')));
await newRow.locator('[data-testid="tier-min"]').fill("0");
check("Son 0 — xato", ((await newRow.locator('[data-testid="tier-error"]').textContent()) ?? "").includes("1 yoki undan katta"));
await newRow.locator('[data-testid="tier-min"]').fill("1");
await newRow.locator('[data-testid="tier-price"]').fill("");
check("Narx bo'sh — xato", ((await newRow.locator('[data-testid="tier-error"]').textContent()) ?? "").includes("Narxni kiriting"));
await newRow.locator('[data-testid="tier-price"]').fill("60000");
// 3 ta → 32 000, 2 ta — nofaol
const row3 = page.locator('[data-testid="tier-row"]').nth(1);
await row3.locator('[data-testid="tier-price"]').fill("32000");
await page.locator('[data-testid="tier-row"]').nth(0).locator('[data-testid="tier-active"]').click();
check("Nofaol pog'ona mijoz ko'rinishidan chiqadi", !(await preview()).includes("39 000") && (await preview()).includes("60 000") && (await preview()).includes("32 000"), await preview());
// Misol hisob: kitob 45 000 → 1 ta: 45 000 (60 000 dan arzon — o'z narxi), 3 ta: 32 000 × 3 = 96 000, tejash 39 000
const ex = await page.evaluate(() => [...document.querySelectorAll('[data-testid="tier-examples"] tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.replace(/\s+/g, " ").trim())));
check("Misol hisob: 1 ta — o'z narxi (45 000), 3 ta — 96 000, tejash 39 000", ex[0][1].startsWith("45 000") && ex[0][3] === "—" && ex[2][2].startsWith("96 000") && ex[2][3].includes("39 000"), JSON.stringify(ex));
await page.screenshot({ path: OUT + "99-admin-pricing-1366.png", fullPage: true });

await page.click('[data-testid="tier-save"]');
await page.waitForSelector("text=Saqlandi — mijozlarga darhol ko'rinadi", { timeout: 8000 });
const body = await mockGet("/__last-tiers-body");
check("PUT — butun jadval, son bo'yicha tartibda, faollik bilan", JSON.stringify(body.tiers) === JSON.stringify([{ min_quantity: 1, unit_price: 60000, is_active: true }, { min_quantity: 2, unit_price: 39000, is_active: false }, { min_quantity: 3, unit_price: 32000, is_active: true }]), JSON.stringify(body));
const pub = await (await fetch(`${API_HOST}/api/v1/pricing`)).json();
check("Public /pricing — faqat faol pog'onalar (1 va 3)", JSON.stringify(pub.tiers.map((x) => [x.min_quantity, Number(x.unit_price)])) === JSON.stringify([[1, 60000], [3, 32000]]), JSON.stringify(pub));
check("Saqlangach — o'zgarish yo'q (saqlash o'chiq)", await page.isDisabled('[data-testid="tier-save"]'));

// Mijoz: katalogdagi aksiya zinapoyasi yangi narxlarni ko'rsatadi
const guest = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
await guest.goto(`${BASE}/catalog`);
await guest.waitForSelector('[data-testid="pricing-promo"]', { timeout: 20000 });
const promo = ((await guest.textContent('[data-testid="pricing-promo"]')) ?? "").replace(/\s+/g, " ");
check("Katalog aksiyasi: yangi pog'onalar (60 000, 32 000), nofaol 39 000 yo'q", promo.includes("60 000") && promo.includes("32 000") && !promo.includes("39 000"), promo.slice(0, 200));
check("Katalog aksiyasi: 1 ta uchun pog'ona bor — 'o'z narxi' qatori yo'q (1 ta ikki marta chiqmaydi)", !promo.includes("o'z narxi") && (await guest.locator('[data-testid="tier-ladder"] .tier-step').count()) === 2);

// O'chirish → saqlash
await page.locator('[data-testid="tier-row"]').nth(1).locator('[data-testid="tier-delete"]').click();
await page.click('[data-testid="tier-save"]');
await mockWait("/__last-tiers-body", (b) => b.tiers?.length === 2);
check("O'chirish: PUT'da 2 ta qoldi (2-pog'ona yo'q)", JSON.stringify((await mockGet("/__last-tiers-body")).tiers.map((x) => x.min_quantity)) === "[1,3]");

// Telefon
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const fits = await page.evaluate(() => [...document.querySelectorAll('[data-testid="tier-row"]')].every((r) => r.getBoundingClientRect().right <= innerWidth));
check("390px: jadval sig'adi, toshish yo'q", sw <= 1 && fits, `+${sw}`);
await page.screenshot({ path: OUT + "99-admin-pricing-390.png", fullPage: true });

check("Sahifa xatolari yo'q", errors.length === 0, errors.join(" | ").slice(0, 300));
await done(browser);
