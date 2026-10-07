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
// To'g'ri javob oldindan belgilanmagan — belgilanmaguncha saqlanmaydi
check("Yangi savol: hech bir variant 'to'g'ri' deb oldindan belgilanmagan, eslatma ko'rinadi", (await admin.locator('[data-testid="q-correct"]:checked').count()) === 0 && ((await admin.textContent('[data-testid="q-correct-hint"]')) ?? "").includes("To'g'ri javobni belgilang"));
await admin.click('[data-testid="q-save"]');
await admin.waitForSelector('[data-testid="questions-editor"] .alert', { timeout: 5000 });
check("To'g'ri javobsiz saqlanmaydi (serverga so'rov yo'q)", (await mockGet("/__questions")).length === 0 && ((await admin.textContent('[data-testid="questions-editor"] .alert')) ?? "").includes("To'g'ri javobni belgilang"));
await admin.locator('[data-testid="q-correct"]').nth(1).check();
check("Belgilangan variant yonida 'To'g'ri javob' yozuvi", (await admin.locator('[data-testid="q-correct-label"]').count()) === 1 && (await admin.locator('[data-testid="questions-editor"] .alert').count()) === 0);
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
await admin.locator('[data-testid="q-correct"]').nth(0).check();
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
// 63: muharrir yopilgach — maqola qatorida savollar soni, tepada kitob bo'yicha jami
await admin.keyboard.press("Escape");
await admin.waitForSelector('[data-testid="questions-editor"]', { state: "detached", timeout: 5000 });
await admin.waitForFunction(() => document.querySelector('[data-testid="article-qcount"]')?.dataset.count === "2", null, { timeout: 8000 });
const rows = await admin.locator('[data-testid="article-qcount"]').count();
check("Maqola qatorida '2 ta savol'; boshqalarida 'Qo'shish'", ((await admin.textContent('[data-testid="article-qcount"] >> nth=0')) ?? "").includes("2 ta savol") && (rows === 1 || ((await admin.textContent('[data-testid="article-qcount"] >> nth=1')) ?? "").includes("Qo'shish")), String(rows));
check("Kitob bo'yicha jami: 'Testlar: 2 ta savol · 1/N maqolada'", ((await admin.textContent('[data-testid="questions-summary"]')) ?? "").includes(`Testlar: 2 ta savol · 1/${rows} maqolada`), (await admin.textContent('[data-testid="questions-summary"]')) ?? "");
await admin.locator(".table-wrap").first().screenshot({ path: OUT + "83b-admin-question-counts.png" });
// Son bosilsa — shu maqola savol muharriri ochiladi
await admin.click('[data-testid="article-qcount"] >> nth=0');
await admin.waitForSelector('[data-testid="questions-editor"] [data-testid="q-item"]', { timeout: 5000 });
check("'2 ta savol' bosildi → savol muharriri (2 savol)", (await admin.locator('[data-testid="q-item"]').count()) === 2);

// ---- O'quvchi
const reader = await ctxPage();
await login(reader, "user@articles365.local", "User12345!");
await reader.goto(`${BASE}/reader/${ART}`);
await reader.waitForFunction(() => document.querySelector('[data-page="1"] canvas')?.width > 0, null, { timeout: 30000 });
check("Kitob scroll rejimida ochildi (default)", ((await reader.textContent("button[aria-label=\"O'qish rejimi\"]")) ?? "").includes("Scroll"));
// 53: o'qib tugatildi (o'quvchi o'zi oxirgi betga o'tdi) → "Test yechib ko'rasizmi?" modali
/** O'quvchidek — g'ildirak bilan hujjat oxirigacha (modal chiqsa to'xtaydi) */
const wheelToEnd = async (p) => {
  await p.mouse.move(800, 450);
  for (let i = 0; i < 40 && !(await p.locator('[data-testid="quiz-prompt"]').count()); i++) {
    await p.mouse.wheel(0, 1200);
    await p.waitForTimeout(100);
  }
};
await reader.fill('input[aria-label="Sahifa"]', "6");
await reader.press('input[aria-label="Sahifa"]', "Enter");
await reader.waitForTimeout(400);
await wheelToEnd(reader);
await reader.waitForSelector('[data-testid="quiz-prompt"]', { timeout: 10000 });
const invite = ((await reader.textContent('[data-testid="quiz-prompt"]')) ?? "").replace(/\s+/g, " ");
check("O'qib tugatilgach modal: sarlavha, taklif, savollar soni, 2 tugma", invite.includes("Maqolani o'qib tugatdingiz") && invite.includes("sinab ko'rishni xohlaysizmi") && invite.includes("2 ta qisqa savol") && (await reader.locator('[data-testid="quiz-prompt-start"]').count()) === 1 && (await reader.locator('[data-testid="quiz-prompt-later"]').count()) === 1, invite.slice(0, 160));
await reader.screenshot({ path: OUT + "85-reader-quiz-invite.png" });
await reader.click('[data-testid="quiz-prompt-later"]');
await reader.waitForSelector('[data-testid="quiz-prompt"]', { state: "detached", timeout: 5000 });
// Yuqoriga va yana oxiriga — shu sessiyada qayta chiqmaydi
await reader.fill('input[aria-label="Sahifa"]', "1");
await reader.press('input[aria-label="Sahifa"]', "Enter");
await reader.waitForTimeout(600);
await wheelToEnd(reader);
await reader.waitForTimeout(800);
check("'Keyinroq' → yopildi; shu sessiyada qayta chiqmaydi", (await reader.locator('[data-testid="quiz-prompt"]').count()) === 0);
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
// 53: savol darajasida — to'g'risi yashil, xatosi qizil; xato savolda to'g'ri javob alohida
await reader.waitForTimeout(400); // fon rangi o'tishi (200ms) tugasin
const verdicts = await reader.evaluate(() => [...document.querySelectorAll('[data-testid="quiz-question"]')].map((li) => ({
  r: li.dataset.result,
  bg: getComputedStyle(li).backgroundColor,
  verdict: li.querySelector('[data-testid="quiz-verdict"]')?.textContent?.trim(),
  answer: li.querySelector('[data-testid="quiz-correct-answer"]')?.textContent?.replace(/\s+/g, " ").trim() ?? null,
  tags: [...li.querySelectorAll(".quiz-opt-tag")].map((x) => x.textContent),
})));
const greenish = (c) => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).map(Number); return g > r && g >= b; };
const reddish = (c) => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).map(Number); return r > g && r > b; };
check("1-savol (to'g'ri): yashil, 'To'g'ri', to'g'ri javob qatori yo'q", verdicts[0].r === "correct" && greenish(verdicts[0].bg) && verdicts[0].verdict === "To'g'ri" && verdicts[0].answer === null, JSON.stringify(verdicts[0]));
check("2-savol (xato): qizil, 'Xato', 'To'g'ri javob: Dangasa', 'Sizning javobingiz' yorlig'i", verdicts[1].r === "wrong" && reddish(verdicts[1].bg) && verdicts[1].verdict === "Xato" && verdicts[1].answer === "To'g'ri javob: Dangasa" && verdicts[1].tags.includes("Sizning javobingiz") && verdicts[1].tags.includes("To'g'ri javob"), JSON.stringify(verdicts[1]));
check("Natija xulosasi: '1 ta to'g'ri · 1 ta xato'", ((await reader.textContent('[data-testid="quiz-summary"]')) ?? "").replace(/\s+/g, " ").includes("1 ta to'g'ri") && ((await reader.textContent('[data-testid="quiz-summary"]')) ?? "").includes("1 ta xato"));
check("Belgilar: 2 ta to'g'ri (yashil), 1 ta noto'g'ri (qizil), izoh ko'rinadi", (await reader.locator(".quiz-opt.correct").count()) === 2 && (await reader.locator(".quiz-opt.wrong").count()) === 1 && (await reader.locator('[data-testid="quiz-explanation"]').count()) === 1);
await reader.screenshot({ path: OUT + "84-reader-quiz-result.png" });
await reader.click('[data-testid="quiz-retry"]');
check("Qayta yechish: javoblar tozalandi", (await reader.locator(".quiz-opt.correct, .quiz-opt.wrong").count()) === 0 && (await reader.locator('[data-testid="quiz-submit"]').isDisabled()));

// 53: yangi sessiya — modal "Testni boshlash" → panel "Test" tabida
const reader2 = await ctxPage();
await login(reader2, "user@articles365.local", "User12345!");
await reader2.goto(`${BASE}/reader/${ART}`);
await reader2.waitForFunction(() => [...document.querySelectorAll("[data-page] canvas")].some((c) => c.width > 0), null, { timeout: 30000 });
// Saqlangan joydan (oxirgi bet) ochildi — o'quvchi harakatisiz modal chiqmaydi
await reader2.waitForTimeout(1500);
check("Oxirgi betdan ochilganda (harakatsiz) modal chiqmadi", (await reader2.locator('[data-testid="quiz-prompt"]').count()) === 0);
await reader2.fill('input[aria-label="Sahifa"]', "1");
await reader2.press('input[aria-label="Sahifa"]', "Enter");
await reader2.waitForTimeout(500);
await wheelToEnd(reader2);
await reader2.waitForSelector('[data-testid="quiz-prompt"]', { timeout: 5000 });
check("Scroll bilan oxiriga yetdi → modal chiqdi", true);
await reader2.click('[data-testid="quiz-prompt-start"]');
await reader2.waitForSelector('[data-testid="quiz-panel"]', { timeout: 5000 });
check("'Testni boshlash' → panel 'Test' tabida, savollar ko'rinadi", (await reader2.locator('[data-testid="quiz-question"]').count()) === 2 && (await reader2.locator('[data-testid="quiz-prompt"]').count()) === 0);
await reader2.context().close();

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
