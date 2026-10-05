// 44.5 — Maqola testi: admin maqola menyusidan "Test savollari" — validatsiya, qo'shish (variantlar, to'g'ri javob,
// izoh), tahrirlash; o'quvchida "Test" tabi (savollar bo'lsa), oxirgi betda taklif; javob → ball, to'g'ri/noto'g'ri,
// izoh, qayta yechish; savolsiz maqolada tab yo'q; tekin kitobda mehmon savollarni ko'radi, natija uchun — kirish.
import { launch, BASE, API, reset, mockGet, ignorablePageError, confirmDialog } from "../lib.mjs";
import { mkdirSync } from "node:fs";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BOOK = "11111111-1111-4111-8111-111111111111";
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ART2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FREE_ART = "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1";
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
await reset("");

const browser = await launch();
const pageErrors = [];
const ctxPage = async (viewport = { width: 1280, height: 860 }) => {
  const p = await (await browser.newContext({ viewport })).newPage();
  p.on("pageerror", (e) => !ignorablePageError(e.message) && pageErrors.push(e.message));
  return p;
};
const login = async (p, email, pass) => {
  await p.goto(`${BASE}/login`);
  await p.fill('input[autocomplete="username"]', email);
  await p.fill('input[type="password"]', pass);
  await p.click('button[type="submit"]');
  await p.waitForURL(`${BASE}/library`, { timeout: 30000 });
};
const admin = await ctxPage();
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await admin.screenshot({ path: OUT + "99-quiz-failure.png" }).catch(() => {}); await browser.close(); process.exit(1); });
await login(admin, "admin@articles365.local", "Admin12345!");

// ---- Admin: savol muharriri
await admin.goto(`${BASE}/admin/books/${BOOK}`);
await admin.click('[data-testid="tab-articles"]');
await admin.locator('[data-testid="article-menu"]').first().click();
await admin.click('[data-testid="article-questions"]');
await admin.waitForSelector('[data-testid="questions-editor"]');
check("Admin: muharrir ochildi, bo'sh holat", (await admin.locator("text=Hali savol yo'q").count()) === 1);
await admin.click('[data-testid="q-new"]');
await admin.fill('[data-testid="q-prompt"]', "Tulki nima qildi?");
await admin.locator('[data-testid="q-option"]').nth(0).fill("Uxladi");
await admin.click('[data-testid="q-save"]');
await admin.waitForSelector("text=barcha variantlarni to'ldiring", { timeout: 5000 });
check("Validatsiya: bo'sh variant bilan saqlanmaydi (serverga so'rov yo'q)", (await mockGet("/__questions")).length === 0);
await admin.locator('[data-testid="q-option"]').nth(1).fill("Itning ustidan sakradi");
await admin.click('[data-testid="q-add-option"]');
await admin.locator('[data-testid="q-option"]').nth(2).fill("Qochib ketdi");
await admin.locator('[data-testid="q-correct"]').nth(1).check();
await admin.fill('[data-testid="q-explanation"]', "Matnda: jumps over the lazy dog.");
await admin.click('[data-testid="q-save"]');
await admin.waitForSelector('[data-testid="q-item"]', { timeout: 5000 });
let qs = await mockGet("/__questions");
check("Savol saqlandi: 3 variant, to'g'ri = 2-variant, izoh", qs.length === 1 && qs[0].options.length === 3 && qs[0].correct_index === 1 && qs[0].explanation?.includes("lazy dog"), JSON.stringify(qs[0]));
// Ikkinchi savol
await admin.click('[data-testid="q-new"]');
await admin.fill('[data-testid="q-prompt"]', "It qanday edi?");
await admin.locator('[data-testid="q-option"]').nth(0).fill("Dangasa");
await admin.locator('[data-testid="q-option"]').nth(1).fill("Tez");
await admin.click('[data-testid="q-save"]');
await admin.waitForFunction(() => document.querySelectorAll('[data-testid="q-item"]').length === 2, null, { timeout: 5000 });
// Tahrirlash
await admin.locator('[data-testid="q-edit"]').nth(1).click();
await admin.fill('[data-testid="q-prompt"]', "Matnda it qanday deyilgan?");
await admin.click('[data-testid="q-save"]');
await admin.waitForSelector("text=Matnda it qanday deyilgan?", { timeout: 5000 });
qs = await mockGet("/__questions");
check("Tahrirlash: savol matni yangilandi, tartib saqlandi", qs.find((q) => q.order_index === 1)?.prompt === "Matnda it qanday deyilgan?");
await admin.screenshot({ path: OUT + "83-admin-questions.png" });

// ---- O'quvchi
const reader = await ctxPage();
await login(reader, "user@articles365.local", "User12345!");
await reader.goto(`${BASE}/reader/${ART}`);
await reader.waitForFunction(() => document.querySelector('[data-page="1"] canvas')?.width > 0, null, { timeout: 30000 });
await reader.fill('input[aria-label="Sahifa"]', "6");
await reader.press('input[aria-label="Sahifa"]', "Enter");
await reader.waitForSelector('[data-testid="quiz-cta"]', { timeout: 10000 });
check("Oxirgi bet: 'Test: 2 ta savol' taklifi", ((await reader.textContent('[data-testid="quiz-cta"]')) ?? "").includes("2 ta savol"));
await reader.click('[data-testid="quiz-cta"]');
await reader.waitForSelector('[data-testid="quiz-panel"]');
check("Panel 'Test' tabida ochildi, 2 savol, to'g'ri javob ko'rinmaydi", (await reader.locator('[data-testid="quiz-question"]').count()) === 2 && (await reader.locator('.quiz-opt.correct').count()) === 0);
check("Hammasiga javob berilmaguncha 'Tekshirish' o'chiq", await reader.locator('[data-testid="quiz-submit"]').isDisabled());
await reader.locator('[data-testid="quiz-question"]').nth(0).locator("label").nth(1).click(); // to'g'ri
await reader.locator('[data-testid="quiz-question"]').nth(1).locator("label").nth(1).click(); // noto'g'ri (to'g'risi 0)
await reader.click('[data-testid="quiz-submit"]');
await reader.waitForSelector('[data-testid="quiz-score"]', { timeout: 5000 });
const score = ((await reader.textContent('[data-testid="quiz-score"]')) ?? "").replace(/\s+/g, " ");
check("Natija: 1 / 2, 50%", score.includes("1 / 2") && score.includes("50%"), score);
check("Belgilar: 2 ta to'g'ri (yashil), 1 ta noto'g'ri (qizil), izoh ko'rinadi", (await reader.locator(".quiz-opt.correct").count()) === 2 && (await reader.locator(".quiz-opt.wrong").count()) === 1 && (await reader.locator('[data-testid="quiz-explanation"]').count()) === 1);
await reader.screenshot({ path: OUT + "84-reader-quiz-result.png" });
await reader.click('[data-testid="quiz-retry"]');
check("Qayta yechish: javoblar tozalandi", (await reader.locator(".quiz-opt.correct, .quiz-opt.wrong").count()) === 0 && (await reader.locator('[data-testid="quiz-submit"]').isDisabled()));

// Savolsiz maqola — "Test" tabi yo'q
await reader.goto(`${BASE}/reader/${ART2}`);
await reader.waitForFunction(() => document.querySelector('[data-page="1"] canvas')?.width > 0, null, { timeout: 30000 });
await reader.click('button[aria-label="Panel"]');
await reader.waitForSelector('[role="tablist"] [role="tab"]');
check("Savolsiz maqola: 'Test' tabi yo'q", !(await reader.$$eval('[role="tablist"] [role="tab"]', (els) => els.some((e) => e.textContent.trim() === "Test"))));

// ---- Mehmon, tekin kitob
await fetch(`${API}/admin/articles/${FREE_ART}/questions`, { method: "POST", headers: { Authorization: "Bearer access-token-admin", "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "Savol?", options: ["Ha", "Yo'q"], correct_index: 0 }) });
const guest = await ctxPage({ width: 390, height: 844 });
await guest.goto(`${BASE}/reader/${FREE_ART}`);
await guest.waitForFunction(() => document.querySelector('[data-page="1"] canvas')?.width > 0, null, { timeout: 30000 });
await guest.click('button[aria-label="Panel"]');
await guest.click('[role="tab"]:has-text("Test")');
await guest.waitForSelector('[data-testid="quiz-panel"]');
await guest.locator('[data-testid="quiz-question"] label').first().click();
await guest.click('[data-testid="quiz-submit"]');
await guest.waitForSelector('[data-testid="quiz-login"]', { timeout: 5000 });
check("Mehmon: savollarni ko'radi, natija uchun kirish taklifi", (await guest.locator('[data-testid="quiz-login"] a[href^="/login"]').count()) === 1);
const sw = await guest.evaluate(() => document.documentElement.scrollWidth - innerWidth);
check("390px: test paneli sig'adi", sw <= 1, `+${sw}`);

// O'chirish
await admin.locator('[data-testid="q-delete"]').first().click();
await confirmDialog(admin);
await admin.waitForFunction(() => document.querySelectorAll('[data-testid="q-item"]').length === 1, null, { timeout: 5000 });
check("Admin: savol o'chirildi", (await mockGet("/__questions")).filter((q) => q.article_id === ART).length === 1);

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
