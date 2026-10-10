// 44.5 → 87: maqola testi (o'quvchi) — IELTS Reading 13 tur: guruhlar va ko'rsatmalar (ketma-ket bir turdagilar),
// ballar bo'yicha raqamlash, TFNG / ko'p javobli tanlov / matching / bo'sh joy (matn va jadval), so'z chegarasi,
// javoblar tab almashsa saqlanadi, bo'sh javob bilan tekshirish (tasdiq), server shakllari (response), natija —
// to'g'ri / qisman / xato, element/bo'sh joy bo'yicha to'g'ri javoblar, izoh, qayta yechish; o'qib tugatilgach taklif;
// savolsiz maqolada tab yo'q; tekin kitobda mehmon savollarni ko'radi, natija uchun — kirish; telefon.
// 88: natijada to'g'ri javoblar yashirin → "Xatolarni tuzatib qayta tekshirish" (javoblar saqlanadi) → "Ko'rsatish";
// urinishlar tarixi va eng yaxshi natija (javob ko'rilgandan keyingilari kirmaydi); "Matnda ko'rsatish" (javob beti;
// telefonda panel yopiladi, qayta ochilganda natija joyida); vaqt bilan yechish — tugasa avtomatik tekshiruv.
import { launch, BASE, API, API_HOST, reset, mockGet, ignorablePageError, confirmDialog, makeCheck } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ART2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FREE_ART = "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1";
const { check, done } = makeCheck();
await reset("");
await fetch(`${API_HOST}/__seed-ielts?article=${ART}`);

const browser = await launch();
const pageErrors = [];
const ctxPage = async (viewport = { width: 1440, height: 900 }) => {
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
const reader = await ctxPage();
await login(reader, "user@articles365.local", "User12345!");
await reader.goto(`${BASE}/reader/${ART}`);
await reader.waitForFunction(() => document.querySelector('[data-page="1"] canvas')?.width > 0, null, { timeout: 30000 });

// 53: o'qib tugatildi → "Test yechib ko'rasizmi?" modali
const wheelToEnd = async (p) => {
  await p.mouse.move(900, 450);
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
check("O'qib tugatilgach test taklifi (modal)", ((await reader.textContent('[data-testid="quiz-prompt"]')) ?? "").includes("Maqolani o'qib tugatdingiz"));
await reader.click('[data-testid="quiz-prompt-start"]');
await reader.waitForSelector('[data-testid="quiz-panel"]', { timeout: 8000 });

// ---- Guruhlar, raqamlash, ko'rsatmalar
const groups = await reader.evaluate(() => [...document.querySelectorAll('[data-testid="quiz-group"]')].map((g) => ({ type: g.dataset.type, range: g.querySelector(".quiz-group-range").textContent, instr: g.querySelector(".quiz-group-instr").textContent.slice(0, 40), n: g.querySelectorAll('[data-testid="quiz-question"]').length })));
check(
  "Guruhlar: TFNG (1–2), tanlov (3–4), sarlavhalar (5–7), gaplar (8–9), jadval (10–11)",
  JSON.stringify(groups.map((g) => [g.type, g.range, g.n])) ===
    JSON.stringify([
      ["TRUE_FALSE_NOT_GIVEN", "Savollar 1–2", 2],
      ["MULTIPLE_CHOICE", "Savollar 3–4", 2],
      ["MATCHING_HEADINGS", "Savollar 5–7", 1],
      ["SENTENCE_COMPLETION", "Savollar 8–9", 1],
      ["TABLE_COMPLETION", "Savollar 10–11", 1],
    ]),
  JSON.stringify(groups),
);
check("Har guruhda IELTS ko'rsatmasi (TFNG — TRUE/FALSE/NOT GIVEN izohi)", groups[0].instr.includes("da'volar matndagi") && groups.every((g) => g.instr.length > 10));
check("To'g'ri javoblar o'quvchiga yuborilmaydi (GET savollarda answer yo'q)", !JSON.stringify(await (await fetch(`${API}/reader/articles/${ART}/questions`, { headers: { Authorization: "Bearer access-token-1" } })).json()).includes('"answer"'));
const q = (i) => reader.locator('[data-testid="quiz-question"]').nth(i);
check("Ko'p javobli tanlov: '2 ta javobni tanlang' va belgilash kataklari", ((await q(3).textContent()) ?? "").includes("2 ta javobni tanlang") && (await q(3).locator('input[type="checkbox"]').count()) === 4 && (await q(2).locator('input[type="radio"]').count()) === 4);
check("Sarlavhalar ro'yxati (i–iv) va 3 ta tanlov (5, 6, 7)", (await q(4).locator(".qv-match-list li").count()) === 4 && (await q(4).locator('[data-testid="qv-match-select"]').count()) === 3 && ((await q(4).locator(".qv-num").allTextContents()).join(",")).includes("5,6,7"));
check("Bo'sh joylar: gapda 2 ta (8, 9) + '1 so'zdan oshmasin'; jadvalda 2 ta (10, 11)", (await q(5).locator('[data-testid="qv-blank"]').count()) === 2 && (await q(5).locator('[data-testid="qv-blank"]').first().getAttribute("placeholder")) === "8" && ((await q(5).textContent()) ?? "").includes("1 so'zdan oshmasin") && (await q(6).locator(".qv-table [data-testid='qv-blank']").count()) === 2);
check("Hech narsa belgilanmaguncha 'Tekshirish' o'chiq (0/11)", (await reader.locator('[data-testid="quiz-submit"]').isDisabled()) && ((await reader.textContent('[data-testid="quiz-submit"]')) ?? "").includes("0/11"));
// Panel kengligi (test tabida kengroq) va kontent panel ichida (gorizontal toshish yo'q)
const pw = await reader.evaluate(() => {
  const p = document.querySelector('[data-testid="quiz-panel"]');
  const scroller = p.closest(".overflow-auto");
  return { w: Math.round(p.closest("aside").getBoundingClientRect().width), over: scroller.scrollWidth - scroller.clientWidth };
});
check("1440px: test tabida panel kengroq (≥ 440 px) va kontent sig'adi", pw.w >= 440 && pw.over <= 1, JSON.stringify(pw));
await reader.screenshot({ path: OUT + "84-reader-ielts-1440.png" });

// ---- Javoblar
await q(0).locator('[data-testid="qv-enum"]', { hasText: "FALSE" }).click(); // to'g'ri
await q(1).locator('[data-testid="qv-enum"]', { hasText: /^TRUE$/ }).click(); // xato (NOT GIVEN)
await q(2).locator('[data-testid="qv-option"]').nth(1).click(); // B — to'g'ri
await q(3).locator('[data-testid="qv-option"]').nth(0).click();
await q(3).locator('[data-testid="qv-option"]').nth(1).click();
await q(3).locator('[data-testid="qv-option"]').nth(2).click(); // 3-tanlov → eng eskisi (A) chiqadi: B, C? — tekshiramiz
const multi = await q(3).evaluate((el) => [...el.querySelectorAll('input[type="checkbox"]')].map((i) => i.checked));
check("Ko'p javobli: 2 tadan ortiq tanlanmaydi (oxirgi ikkitasi qoladi)", JSON.stringify(multi) === JSON.stringify([false, true, true, false]), JSON.stringify(multi));
await q(3).locator('[data-testid="qv-option"]').nth(1).click(); // B ni olib tashlash
await q(3).locator('[data-testid="qv-option"]').nth(0).click(); // A — endi A + C (to'g'ri)
await q(4).locator('[data-testid="qv-match-select"]').nth(0).selectOption("i"); // to'g'ri
check("Sarlavha bir marta: 'i' tanlangach boshqa elementlarda o'chiq", await q(4).locator('[data-testid="qv-match-select"]').nth(1).evaluate((sel) => sel.querySelector('option[value="i"]').disabled));
await q(4).locator('[data-testid="qv-match-select"]').nth(1).selectOption("iii"); // xato (ii)
await q(4).locator('[data-testid="qv-match-select"]').nth(2).selectOption("ii"); // xato (iii)
await q(5).locator('[data-testid="qv-blank"]').nth(0).fill("66");
await q(5).locator('[data-testid="qv-blank"]').nth(1).fill("Sabr!"); // normalizatsiya: "sabr"
// Tab almashsa ham javoblar saqlanadi
await reader.click('[role="tab"]:has-text("Mundarija")').catch(async () => reader.locator('[role="tab"]').first().click());
await reader.waitForTimeout(300);
await reader.click('[role="tab"]:has-text("Test")');
await reader.waitForSelector('[data-testid="quiz-panel"]');
check("Tab almashsa ham javoblar saqlanadi (sessionStorage)", (await q(5).locator('[data-testid="qv-blank"]').nth(0).inputValue()) === "66" && (await q(4).locator('[data-testid="qv-match-select"]').nth(0).inputValue()) === "i");
// Bo'sh joyga uzun javob — so'z chegarasi ogohlantirishi
await q(6).locator('[data-testid="qv-blank"]').nth(0).fill("kichik qadam");
check("Jadval: 2 so'z (chegara 2) — ogohlantirish yo'q", (await q(6).locator(".qv-blank.over").count()) === 0);
check("Tekshirish tugmasi: 10/11 to'ldirilgan", ((await reader.textContent('[data-testid="quiz-submit"]')) ?? "").includes("10/11"));
await reader.click('[data-testid="quiz-submit"]');
await reader.waitForSelector('[role="dialog"]:has-text("bo\'sh")', { timeout: 5000 });
check("1 ta bo'sh javob — tasdiq so'raladi (IELTS'da bo'sh = 0 ball)", ((await reader.textContent('[role="dialog"]')) ?? "").includes("1 ta javob to'ldirilmagan"));
await confirmDialog(reader);
await reader.waitForSelector('[data-testid="quiz-score"]', { timeout: 8000 });

const body = await mockGet("/__last-quiz-body");
const resp = body.answers.map((a) => a.response);
check(
  "Serverga javob shakllari: enum {value}, tanlov {selected}, matching {map}, matn {blanks} (bo'sh — '')",
  resp[0].value === "FALSE" && JSON.stringify(resp[3].selected) === "[0,2]" && JSON.stringify(resp[4].map) === JSON.stringify({ 0: "i", 1: "iii", 2: "ii" }) && JSON.stringify(resp[5].blanks) === JSON.stringify(["66", "Sabr!"]) && JSON.stringify(resp[6].blanks) === JSON.stringify(["kichik qadam", ""]),
  JSON.stringify(resp),
);
const score = ((await reader.textContent('[data-testid="quiz-score"]')) ?? "").replace(/\s+/g, " ");
check("Natija: 7 / 11 ball, 64%", score.includes("7 / 11") && score.includes("64%"), score);
const verdicts = await reader.evaluate(() => [...document.querySelectorAll('[data-testid="quiz-question"]')].map((el) => el.dataset.result));
check("Savollar: to'g'ri, xato, to'g'ri, to'g'ri, qisman, to'g'ri (normalizatsiya), qisman", JSON.stringify(verdicts) === JSON.stringify(["correct", "wrong", "correct", "correct", "partial", "correct", "partial"]), JSON.stringify(verdicts));
const sum = ((await reader.textContent('[data-testid="quiz-summary"]')) ?? "").replace(/\s+/g, " ");
check("Xulosa: to'g'ri / qisman / xato soni", sum.includes("4 to'g'ri") && sum.includes("2 qisman") && sum.includes("1 xato"), sum);
// 88: to'g'ri javoblar avval yashirin
check("Yashirin rejim: eslatma, to'g'ri javoblar va izohlar ko'rinmaydi", (await reader.locator('[data-testid="quiz-hidden-note"]').count()) === 1 && (await reader.locator('[data-testid="qv-fix"]').count()) === 0 && (await reader.locator('[data-testid="quiz-explanation"]').count()) === 0);
check("Yashirin: TFNG — tanlangan TRUE qizil, NOT GIVEN belgilanmagan", (await q(1).locator(".qv-enum-btn.wrong", { hasText: "TRUE" }).count()) === 1 && (await q(1).locator(".qv-enum-btn.correct").count()) === 0);
check("Qisman savolda: 'Qisman: 1 / 3', elementlar ✓/✗, kalitlar yo'q", ((await q(4).locator('[data-testid="quiz-verdict"]').textContent()) ?? "").includes("Qisman: 1 / 3") && (await q(4).locator(".qv-match-row.wrong").count()) === 2);
check("'Matnda ko'rsatish': faqat xato/qisman savolda (sarlavhalar — 2-bet); to'g'ri TFNG'da (3-bet) — yo'q", (await reader.locator('[data-testid="qv-show-page"]').count()) === 1 && ((await q(4).locator('[data-testid="qv-show-page"]').textContent()) ?? "").includes("2-bet"));
check("Natija: 1-urinish", ((await reader.textContent('[data-testid="quiz-attempt"]')) ?? "").includes("1-urinish"));
await q(4).locator('[data-testid="qv-show-page"]').click();
await reader.waitForFunction(() => document.querySelector('input[aria-label="Sahifa"]')?.value === "2", null, { timeout: 8000 });
check("'Matnda ko'rsatish' → PDF 2-betga o'tdi, panel (kompyuterda) ochiq", (await reader.locator('[data-testid="quiz-score"]').count()) === 1);
// Xatolarni tuzatib qayta tekshirish — javoblar saqlanadi
await reader.click('[data-testid="quiz-amend"]');
check("Tuzatish: natija yopildi, javoblar joyida", (await reader.locator('[data-testid="quiz-score"]').count()) === 0 && (await q(5).locator('[data-testid="qv-blank"]').nth(0).inputValue()) === "66" && (await q(4).locator('[data-testid="qv-match-select"]').nth(0).inputValue()) === "i");
await q(4).locator('[data-testid="qv-match-select"]').nth(2).selectOption("");
await q(4).locator('[data-testid="qv-match-select"]').nth(1).selectOption("ii");
await q(4).locator('[data-testid="qv-match-select"]').nth(2).selectOption("iii");
await reader.click('[data-testid="quiz-submit"]');
await confirmDialog(reader);
await reader.waitForSelector('[data-testid="quiz-score"]', { timeout: 8000 });
const score2 = ((await reader.textContent('[data-testid="quiz-score"]')) ?? "").replace(/\s+/g, " ");
check("2-urinish: 9 / 11, eng yaxshi 9 / 11 (82%)", score2.includes("9 / 11") && score2.includes("2-urinish") && score2.includes("eng yaxshi: 9 / 11 (82%)"), score2);
await reader.click('[data-testid="quiz-history"] summary');
await reader.locator('[data-testid="quiz-score"]').scrollIntoViewIfNeeded();
await reader.screenshot({ path: OUT + "84d-reader-ielts-attempt.png" });
check("Urinishlar tarixi: 2 ta", (await reader.locator('[data-testid="quiz-history"] li').count()) === 2);
// Ko'rsatish
await reader.click('[data-testid="quiz-reveal"]');
check("Ko'rsatildi: TFNG — NOT GIVEN yashil, jadvalda 'har kuni', izohlar (sahifa belgisisiz)", (await q(1).locator(".qv-enum-btn.correct", { hasText: "NOT GIVEN" }).count()) === 1 && ((await q(6).locator('[data-testid="qv-fix"]').textContent()) ?? "").includes("har kuni") && (await reader.locator('[data-testid="quiz-explanation"]').count()) === 2 && !((await reader.locator('[data-testid="quiz-explanation"]').first().textContent()) ?? "").includes("[p."));
check("Ko'rsatilgach: TFNG'da ham 'Matnda ko'rsatish · 3-bet'; tugma — 'Qayta yechish'", ((await q(0).locator('[data-testid="qv-show-page"]').textContent()) ?? "").includes("3-bet") && (await reader.locator('[data-testid="quiz-retry"]').count()) === 1 && (await reader.locator('[data-testid="quiz-hidden-note"]').count()) === 0);
await reader.screenshot({ path: OUT + "84-reader-ielts-result.png", fullPage: true });
await q(4).scrollIntoViewIfNeeded();
await reader.screenshot({ path: OUT + "84b-reader-ielts-matching.png" });
await q(6).scrollIntoViewIfNeeded();
await reader.screenshot({ path: OUT + "84b-reader-ielts-table.png" });
await reader.click('[data-testid="quiz-retry"]');
check("Qayta yechish: javoblar tozalandi; 'Oldingi urinishlar: 2 · eng yaxshi: 9 / 11'", (await reader.locator('[data-testid="quiz-score"]').count()) === 0 && ((await reader.textContent('[data-testid="quiz-submit"]')) ?? "").includes("0/11") && ((await reader.textContent('[data-testid="quiz-prev"]')) ?? "").includes("Oldingi urinishlar: 2"));

// ---- Vaqt bilan yechish: 11 ball × 1,5 = 17 daqiqa; tab almashsa davom etadi; tugasa — avtomatik
check("Vaqt tugmasi: '17 daqiqa'", ((await reader.textContent('[data-testid="quiz-timer-start"]')) ?? "").includes("17 daqiqa"));
await reader.click('[data-testid="quiz-timer-start"]');
await reader.waitForTimeout(1200);
check("Taymer: 16:5x", /^16:5\d$/.test((await reader.textContent('[data-testid="quiz-timer-left"]')) ?? ""), (await reader.textContent('[data-testid="quiz-timer-left"]')) ?? "");
await q(0).locator('[data-testid="qv-enum"]', { hasText: "FALSE" }).click();
await reader.screenshot({ path: OUT + "84e-reader-ielts-timer.png" });
// Muddatni 2 soniyaga qisqartirib, tabni almashtiramiz (qayta o'rnatilganda saqlangan muddat o'qiladi)
await reader.evaluate((id) => {
  const k = `a365.quiz.timer.${id}`;
  const t0 = JSON.parse(sessionStorage.getItem(k));
  sessionStorage.setItem(k, JSON.stringify({ ...t0, deadline: Date.now() + 2500 }));
}, ART);
await reader.click('[role="tab"]:has-text("Mundarija")').catch(async () => reader.locator('[role="tab"]').first().click());
await reader.click('[role="tab"]:has-text("Test")');
await reader.waitForSelector('[data-testid="quiz-timer"]');
check("Tab almashgach taymer davom etadi (0:0x)", /^0:0\d$/.test((await reader.textContent('[data-testid="quiz-timer-left"]')) ?? ""));
await reader.waitForSelector('[data-testid="quiz-score"]', { timeout: 8000 });
const score3 = ((await reader.textContent('[data-testid="quiz-score"]')) ?? "").replace(/\s+/g, " ");
check("Vaqt tugadi: so'rovsiz avtomatik tekshirildi (1 / 11), xabar, 3-urinish, eng yaxshi — 9 / 11", (await reader.locator('[role="dialog"]').count()) === 0 && score3.includes("1 / 11") && score3.includes("3-urinish") && score3.includes("vaqt: ") && score3.includes("eng yaxshi: 9 / 11") && ((await reader.textContent('[data-testid="quiz-panel"]')) ?? "").includes("Vaqt tugadi"), score3);
check("Tarixda 3-urinish — 'javoblar ko'rilgandan keyin'", ((await reader.locator('[data-testid="quiz-history"] li').first().textContent()) ?? "").includes("javoblar ko'rilgandan keyin"));
await reader.click('[data-testid="quiz-amend"]');

// Savolsiz maqola — "Test" tabi yo'q
await reader.goto(`${BASE}/reader/${ART2}`);
await reader.waitForFunction(() => document.querySelector('[data-page="1"] canvas')?.width > 0, null, { timeout: 30000 });
await reader.click('button[aria-label="Panel"]');
await reader.waitForSelector('[role="tablist"] [role="tab"]');
check("Savolsiz maqola: 'Test' tabi yo'q", !(await reader.$$eval('[role="tablist"] [role="tab"]', (els) => els.some((e) => e.textContent.trim() === "Test"))));

// ---- Mehmon, tekin kitob (telefon)
await fetch(`${API}/admin/articles/${FREE_ART}/questions`, { method: "POST", headers: { Authorization: "Bearer access-token-admin", "Content-Type": "application/json" }, body: JSON.stringify({ type: "YES_NO_NOT_GIVEN", prompt: "Muallif kitob o'qishni foydali deb hisoblaydi.", data: {}, answer: { value: "YES" } }) });
const guest = await ctxPage({ width: 390, height: 844 });
await guest.goto(`${BASE}/reader/${FREE_ART}`);
await guest.waitForFunction(() => document.querySelector('[data-page="1"] canvas')?.width > 0, null, { timeout: 30000 });
await guest.click('button[aria-label="Panel"]');
await guest.click('[role="tab"]:has-text("Test")');
await guest.waitForSelector('[data-testid="quiz-panel"]');
check("Mehmon: YES / NO / NOT GIVEN tugmalari", (await guest.locator('[data-testid="qv-enum"]').allTextContents()).join("|") === "YES|NO|NOT GIVEN");
await guest.locator('[data-testid="qv-enum"]').first().click();
await guest.click('[data-testid="quiz-submit"]');
await guest.waitForSelector('[data-testid="quiz-login"]', { timeout: 5000 });
check("Mehmon: natija uchun kirish taklifi", (await guest.locator('[data-testid="quiz-login"] a[href^="/login"]').count()) === 1);
const sw = await guest.evaluate(() => document.documentElement.scrollWidth - innerWidth);
check("390px: test paneli sig'adi", sw <= 1, `+${sw}`);

// Telefonda — to'liq test (o'quvchi)
const phone = await ctxPage({ width: 390, height: 844 });
await login(phone, "user@articles365.local", "User12345!");
await phone.goto(`${BASE}/reader/${ART}`);
await phone.waitForFunction(() => [...document.querySelectorAll("[data-page] canvas")].some((c) => c.width > 0), null, { timeout: 30000 });
await phone.click('button[aria-label="Panel"]');
await phone.click('[role="tab"]:has-text("Test")');
await phone.waitForSelector('[data-testid="quiz-panel"]');
const fit = await phone.evaluate(() => {
  const panel = document.querySelector('[data-testid="quiz-panel"]').getBoundingClientRect();
  const over = [...document.querySelectorAll('[data-testid="quiz-panel"] .qv-match-row, [data-testid="quiz-panel"] .qv-opt, [data-testid="quiz-panel"] .qv-enum')].filter((el) => el.getBoundingClientRect().right > panel.right + 1).length;
  return { over, sw: document.documentElement.scrollWidth - innerWidth };
});
check("390px: savollar panel ichida (toshish yo'q)", fit.over === 0 && fit.sw <= 1, JSON.stringify(fit));
await phone.locator('[data-testid="quiz-panel"]').screenshot({ path: OUT + "84c-reader-ielts-390.png" });
const pq = (i) => phone.locator('[data-testid="quiz-question"]').nth(i);
await pq(4).locator('[data-testid="qv-match-select"]').nth(0).selectOption("iv");
await phone.click('[data-testid="quiz-submit"]');
await confirmDialog(phone);
await phone.waitForSelector('[data-testid="quiz-score"]', { timeout: 8000 });
await pq(4).locator('[data-testid="qv-show-page"]').click();
await phone.waitForFunction(() => !document.querySelector('[data-testid="quiz-panel"]'), null, { timeout: 5000 });
check("Telefon: 'Matnda ko'rsatish' → panel yopildi, 2-bet", (await phone.inputValue('input[aria-label="Sahifa"]')) === "2");
await phone.click('button[aria-label="Panel"]');
await phone.waitForSelector('[data-testid="quiz-score"]', { timeout: 5000 });
const inView = await pq(4).evaluate((el) => {
  const r = el.getBoundingClientRect();
  return r.top < innerHeight && r.bottom > 0;
});
check("Panel qayta ochildi: natija joyida, o'sha savol ko'rinadi", inView && (await pq(4).getAttribute("data-result")) === "wrong");

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await done(browser);
