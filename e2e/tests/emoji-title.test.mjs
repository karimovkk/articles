// 101: admin — nom maydonidagi emoji tanlagich (Telegram uslubida): o'ng chetdagi tugma, guruhlar, qidiruv (en/ru),
// kursor joyiga qo'yish, yaqinda ishlatilganlar; yaratish va tahrirlash formalarida; emoji nom bilan saqlanadi.
import { launch, BASE, reset, mockGet, ignorablePageError, makeCheck } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
const BOOK = "11111111-1111-4111-8111-111111111111";
const { check, done } = makeCheck();
await reset("");
const browser = await launch();
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
await page.goto(`${BASE}/login`);
await page.waitForSelector('input[autocomplete="username"]:not([readonly])', { timeout: 60000 });
await page.fill('input[autocomplete="username"]', "admin@articles365.local");
await page.fill('input[type="password"]', "Admin12345!");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });

// ---- Yaratish formasi
await page.goto(`${BASE}/admin/books`);
await page.click('[data-testid="new-book"]', { timeout: 30000 });
await page.waitForSelector('[data-testid="title-emoji-btn"]');
const input = page.locator('.emoji-input input');
const btnBox = await page.locator('[data-testid="title-emoji-btn"]').boundingBox();
const inBox = await input.boundingBox();
check("Nom maydonining o'ng chetida emoji tugmasi", btnBox && inBox && btnBox.x + btnBox.width <= inBox.x + inBox.width && btnBox.x > inBox.x + inBox.width - 48, JSON.stringify({ btnBox, inBox }));
await input.fill("Brain Health");
await input.evaluate((el) => el.setSelectionRange(5, 5)); // "Brain| Health"
await page.click('[data-testid="title-emoji-btn"]');
await page.waitForSelector('[data-testid="title-emoji-item"]', { timeout: 15000 });
const total = await page.locator('[data-testid="title-emoji-item"]').count();
const tabs = await page.locator('[data-testid="title-emoji-tab"]').count();
check("Tanlagich: barcha emojilar (1800+), 9 ta guruh, qidiruv maydoni fokusda", total > 1800 && tabs === 9 && (await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))) === "title-emoji-search", `${total} emoji, ${tabs} guruh`);
await page.screenshot({ path: OUT + "101-emoji-picker.png" });
// Guruhga o'tish
await page.locator('[data-testid="title-emoji-tab"]').nth(8).click();
await page.waitForTimeout(300);
const flagsVisible = await page.evaluate(() => { const g = document.querySelector('[data-testid="title-emoji-grid"]'); const s = g.querySelector('[data-group="flags"]'); return Math.abs(s.offsetTop - g.offsetTop - g.scrollTop) < 12; });
check("Guruh tugmasi — o'sha guruhga aylantiradi (Bayroqlar)", flagsVisible);
// Qidiruv: inglizcha va ruscha
await page.fill('[data-testid="title-emoji-search"]', "brain");
await page.waitForTimeout(150);
const brain = await page.locator('[data-testid="title-emoji-item"]').allTextContents();
check("Qidiruv 'brain' → 🧠", brain.includes("🧠") && brain.length < 10, brain.join(""));
await page.fill('[data-testid="title-emoji-search"]', "мозг");
await page.waitForTimeout(150);
check("Qidiruv ruscha 'мозг' → 🧠", (await page.locator('[data-testid="title-emoji-item"]').allTextContents()).includes("🧠"));
await page.fill('[data-testid="title-emoji-search"]', "qwxzqwxz");
check("Topilmasa — 'Hech narsa topilmadi'", ((await page.textContent(".emoji-panel")) ?? "").includes("Hech narsa topilmadi"));
await page.fill('[data-testid="title-emoji-search"]', "brain");
await page.locator('[data-testid="title-emoji-item"]', { hasText: "🧠" }).first().click();
check("Emoji kursor joyiga qo'yildi, tanlagich ochiq qoldi", (await input.inputValue()) === "Brain🧠 Health" && (await page.locator(".emoji-panel").count()) === 1, await input.inputValue());
// Esc — faqat tanlagich yopiladi (modal emas)
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
check("Esc — tanlagich yopildi, forma (modal) ochiq", (await page.locator(".emoji-panel").count()) === 0 && (await page.locator('[data-testid="title-emoji-btn"]').count()) === 1);
// Yaqinda ishlatilganlar
await page.click('[data-testid="title-emoji-btn"]');
await page.waitForSelector('[data-group="recent"]', { timeout: 5000 });
check("Yaqinda ishlatilganlar: 🧠 birinchi", ((await page.locator('[data-group="recent"] [data-testid="title-emoji-item"]').first().textContent()) ?? "") === "🧠");
await page.mouse.click(20, 20); // tashqariga
await page.waitForTimeout(200);
check("Tashqariga bosilsa — yopiladi", (await page.locator(".emoji-panel").count()) === 0);

// ---- Tahrirlash formasi: emoji nom bilan saqlanadi
await page.goto(`${BASE}/admin/books/${BOOK}`);
await page.waitForSelector('[data-testid="title-emoji-btn"]', { timeout: 30000 });
const ein = page.locator('.emoji-input input');
await ein.click();
await ein.press("End");
await page.click('[data-testid="title-emoji-btn"]');
await page.fill('[data-testid="title-emoji-search"]', "rocket");
await page.locator('[data-testid="title-emoji-item"][title="🚀"]').first().click();
await page.keyboard.press("Escape");
const want = await ein.inputValue();
await page.locator('form:has(.emoji-input) button[type="submit"]').first().click();
await page.waitForTimeout(800);
const saved = (await mockGet("/__books")).find((b) => b.id === BOOK)?.title;
check("Tahrirlash: oxiriga 🚀 qo'shildi va saqlandi", want === "Test kitob🚀" && saved === want, `${want} / ${saved}`);
await page.screenshot({ path: OUT + "101b-emoji-edit.png" });

check("Sahifa xatolari yo'q", errors.length === 0, errors.join(" | ").slice(0, 300));
await done(browser);
