// 87: admin — maqolaning IELTS savollari (modal o'rniga sahifa): maqolalar jadvalidan o'tish, breadcrumbs, tur tanlash
// (mexanika guruhlari), har mexanika formasi va tekshiruvi (serverga so'rovsiz), o'quvchi ko'rinishi (jonli, to'g'ri
// javob bilan), saqlangan shakllar (data/answer), ro'yxat (ballar bo'yicha raqamlar, xulosa), tartib, nusxa, tahrir,
// o'chirish, server 422 xabari, data.choose saqlanmasa ogohlantirish, kitob sahifasiga qaytish; telefon.
// 88: savol matnidagi son ("Choose THREE") to'g'ri javoblar soniga mos bo'lmasa — xato; javob sahifasi (izohda `[p. N]`).
// 90: `choose` doim yuboriladi; diagramma — rasm yuklash (fayl turi tekshiruvi), bo'sh joylarni rasmda joylash
// (`data.labels`), saqlangach yuklash (`data.image_url`), tahrirda rasm/yorliqlar yo'qolmaydi; o'quvchida — token bilan
// yuklangan rasm, savol raqamli nuqtalar (natijada yashil), kattalashtirish.
// 91: saqlanmagan o'zgarishlar (havola / "Bekor" / tabni yopish — tasdiq), rasm yuklanish foizi, telefonda diagramma
// (admin: nuqta qo'yish; o'quvchi: rasm panelga sig'adi, nuqtalar rasm ustida, kattalashtirish).
import { launch, BASE, API_HOST, reset, mockGet, mockWait, ignorablePageError, confirmDialog, makeCheck } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
const BOOK = "11111111-1111-4111-8111-111111111111";
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const { check, done } = makeCheck();
await reset("");
const browser = await launch();
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "admin@articles365.local");
await page.fill('input[type="password"]', "Admin12345!");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });

const WEBP = new URL("../../public/auth/mag-1.webp", import.meta.url).pathname; // diagramma rasmi
const qs = async () => (await mockGet("/__questions")).filter((q) => q.article_id === ART).sort((a, b) => a.order_index - b.order_index);
const last = () => mockGet("/__last-question-body");

// ---- Kitob → Maqolalar → "Qo'shish" — alohida sahifa
await page.goto(`${BASE}/admin/books/${BOOK}`);
await page.click('[data-testid="tab-articles"]');
await page.waitForSelector('[data-testid="article-qcount"]', { timeout: 15000 });
await page.locator('[data-testid="article-qcount"]').first().click();
await page.waitForURL(`**/admin/books/${BOOK}/articles/${ART}/questions`, { timeout: 15000 });
await page.waitForSelector('[data-testid="questions-page"]');
await page.waitForFunction(() => !document.querySelector('[data-testid="questions-page"] nav.crumbs')?.textContent.includes("…"), null, { timeout: 10000 });
await page.waitForSelector("text=Hali savol yo'q", { timeout: 10000 });
const crumbs = ((await page.textContent('[data-testid="questions-page"] nav.crumbs')) ?? "").replace(/\s+/g, " ");
check("Modal emas — alohida sahifa; breadcrumbs: Kitoblar › kitob › maqola", crumbs.includes("Kitoblar") && crumbs.includes("Test kitob") && (await page.locator('[role="dialog"]').count()) === 0, crumbs);
check("Bo'sh holat", ((await page.textContent('[data-testid="q-list-card"]')) ?? "").includes("Hali savol yo'q"));

// ---- 1) Ko'p javobli tanlov
await page.click('[data-testid="q-new"]');
await page.waitForSelector('[data-testid="question-form"]');
check("Tur tanlash: 4 guruh, 13 tur", (await page.locator(".qf-type-group").count()) === 4 && (await page.locator('[data-testid="qf-type"]').count()) === 13);
await page.click('[data-testid="qf-save"]');
await page.waitForSelector('[data-testid="question-form"] .alert', { timeout: 3000 });
check("Bo'sh forma — xato, serverga so'rov yo'q", ((await page.textContent('[data-testid="question-form"] .alert')) ?? "").includes("Savol matnini kiriting") && (await qs()).length === 0);
await page.fill('[data-testid="qf-prompt"]', "Qaysi IKKITASI muallif tavsiyasi?");
const opts = ["Kichik boshlash", "Hammasini birdan", "Muhitni o'zgartirish", "Kutish"];
for (let i = 0; i < 4; i++) await page.locator('[data-testid="qf-option"]').nth(i).fill(opts[i]);
await page.click('[data-testid="qf-save"]');
check("To'g'ri variant belgilanmagan — xato", ((await page.textContent('[data-testid="question-form"] .alert')) ?? "").includes("to'g'ri variantni"));
await page.locator('[data-testid="qf-correct"]').nth(0).check();
await page.locator('[data-testid="qf-correct"]').nth(2).check();
check("Savol matnida son bor ('IKKITASI') — maslahat ko'rinmaydi", (await page.locator('[data-testid="qf-choose-tip"]').count()) === 0);
await page.fill('[data-testid="qf-prompt"]', "Choose THREE letters.");
await page.click('[data-testid="qf-save"]');
check("Matnda THREE, to'g'ri javob 2 ta — xato (so'rovsiz)", ((await page.textContent('[data-testid="question-form"] .alert')) ?? "").includes("mos emas") && (await qs()).length === 0);
await page.fill('[data-testid="qf-prompt"]', "Qaysi IKKITASI muallif tavsiyasi?");
check("Oldindan ko'rish: '2 ta javobni tanlang' va 4 ta katak", ((await page.textContent('[data-testid="qf-preview"]')) ?? "").includes("2 ta javobni tanlang") && (await page.locator('[data-testid="qf-preview"] input[type="checkbox"]').count()) === 4);
await page.click('[data-testid="qf-show-answer"]');
check("'To'g'ri javob bilan' — A va C yashil", (await page.locator('[data-testid="qf-preview"] .qv-opt.correct').count()) === 2);
await page.click('[data-testid="qf-show-answer"]');
await page.screenshot({ path: OUT + "99-admin-q-form-choice.png", fullPage: true });
await page.click('[data-testid="qf-save"]');
await page.waitForSelector('[data-testid="q-item"]', { timeout: 8000 });
let b = await last();
check("Saqlandi: type, data.options, data.choose=2, answer.correct=[0,2]", b.type === "MULTIPLE_CHOICE" && b.data.options.length === 4 && b.data.choose === 2 && JSON.stringify(b.answer.correct) === "[0,2]", JSON.stringify(b));

// ---- 2) TRUE/FALSE/NOT GIVEN
await page.click('[data-testid="q-new"]');
await page.click('[data-testid="qf-type"][data-type="TRUE_FALSE_NOT_GIVEN"]');
check("TFNG: 'Da'vo' maydoni va 3 tugma", ((await page.textContent('[data-testid="question-form"]')) ?? "").includes("Da'vo") && (await page.locator('[data-testid="qf-enum"]').count()) === 3);
await page.fill('[data-testid="qf-prompt"]', "Kichik odatlar natijani tez o'zgartiradi.");
await page.locator('[data-testid="qf-enum"]', { hasText: "FALSE" }).click();
await page.fill('[data-testid="qf-explanation"]', "2-paragraf.");
await page.fill('[data-testid="qf-answer-page"]', "40");
check("Javob sahifasi 40 (maqola 6 bet) — xato", ((await page.textContent('[data-testid="question-form"]')) ?? "").includes("1 dan 6 gacha"));
await page.fill('[data-testid="qf-answer-page"]', "3");
await page.click('[data-testid="qf-save"]');
await page.waitForFunction(() => document.querySelectorAll('[data-testid="q-item"]').length === 2, null, { timeout: 8000 });
b = await last();
check("TFNG saqlandi: data {}, answer.value FALSE, izoh + sahifa ('2-paragraf. [p. 3]')", b.type === "TRUE_FALSE_NOT_GIVEN" && JSON.stringify(b.data) === "{}" && b.answer.value === "FALSE" && b.explanation === "2-paragraf. [p. 3]", JSON.stringify(b));
check("Ro'yxatda: '3-bet' belgisi", ((await page.locator('[data-testid="q-item"]').nth(1).locator('[data-testid="qa-page"]').textContent()) ?? "").includes("3-bet"));

// ---- 3) Matching headings → information (kalitlar qayta nomlanadi)
await page.click('[data-testid="q-new"]');
await page.click('[data-testid="qf-type"][data-type="MATCHING_HEADINGS"]');
const keys = async () => page.$$eval('[data-testid="qf-opt-key"]', (els) => els.map((e) => e.value));
check("Sarlavhalar: kalitlar i, ii, iii", JSON.stringify(await keys()) === JSON.stringify(["i", "ii", "iii"]));
await page.fill('[data-testid="qf-prompt"]', "A–B paragraflar uchun sarlavha tanlang.");
await page.locator('[data-testid="qf-item"]').nth(0).fill("Paragraf A");
await page.locator('[data-testid="qf-item"]').nth(1).fill("Paragraf B");
for (const [i, txt] of ["Kichik qadamlar", "Muhitning roli", "Motivatsiya afsonasi"].entries()) await page.locator('[data-testid="qf-opt-text"]').nth(i).fill(txt);
await page.locator('[data-testid="qf-item-answer"]').nth(0).selectOption("i");
await page.click('[data-testid="qf-save"]');
check("Element uchun to'g'ri kalit tanlanmagan — xato", ((await page.textContent('[data-testid="question-form"] .alert')) ?? "").includes("Har bir element uchun"));
await page.locator('[data-testid="qf-item-answer"]').nth(1).selectOption("i");
await page.click('[data-testid="qf-save"]');
check("Sarlavhalar: bitta sarlavha ikki paragrafga — xato (IELTS: faqat bir marta)", ((await page.textContent('[data-testid="question-form"] .alert')) ?? "").includes("faqat bir marta"));
await page.locator('[data-testid="qf-item-answer"]').nth(1).selectOption("ii");
await page.click('[data-testid="qf-type"][data-type="MATCHING_INFORMATION"]');
check("Turni MATCHING_INFORMATION ga — kalitlar A, B, C va javoblar ham (A, B)", JSON.stringify(await keys()) === JSON.stringify(["A", "B", "C"]) && (await page.locator('[data-testid="qf-item-answer"]').nth(1).inputValue()) === "B");
await page.click('[data-testid="qf-type"][data-type="MATCHING_HEADINGS"]');
check("Yana sarlavhalarga — i, ii, iii (javob ii)", JSON.stringify(await keys()) === JSON.stringify(["i", "ii", "iii"]) && (await page.locator('[data-testid="qf-item-answer"]').nth(1).inputValue()) === "ii");
await page.click('[data-testid="qf-save"]');
await page.waitForFunction(() => document.querySelectorAll('[data-testid="q-item"]').length === 3, null, { timeout: 8000 });
b = await last();
check("Matching saqlandi: items 2, options {key,text} 3, answer.map {0:i,1:ii}", b.type === "MATCHING_HEADINGS" && b.data.items.length === 2 && b.data.options[2].key === "iii" && JSON.stringify(b.answer.map) === JSON.stringify({ 0: "i", 1: "ii" }), JSON.stringify(b));

// ---- 4) Sentence completion — bo'sh joy tugmasi, variantlar, so'z chegarasi
await page.click('[data-testid="q-new"]');
await page.click('[data-testid="qf-type"][data-type="SENTENCE_COMPLETION"]');
await page.fill('[data-testid="qf-prompt"]', "Matndan BIR so'z bilan to'ldiring.");
await page.fill('[data-testid="qf-text"]', "Odat  kun ichida shakllanadi va  talab qiladi.");
await page.locator('[data-testid="qf-text"]').evaluate((el) => el.setSelectionRange(5, 5));
await page.click('[data-testid="qf-insert-blank"]');
await page.locator('[data-testid="qf-text"]').evaluate((el) => el.setSelectionRange(el.value.indexOf("va ") + 3, el.value.indexOf("va ") + 3));
await page.click('[data-testid="qf-insert-blank"]');
check("Bo'sh joy tugmasi: matnda 2 ta ___ va 2 ta javob qatori", (await page.inputValue('[data-testid="qf-text"]')).match(/___/g)?.length === 2 && (await page.locator('[data-testid="qf-blank-answers"]').count()) === 2, await page.inputValue('[data-testid="qf-text"]'));
await page.locator('[data-testid="qf-word-limit"]', { hasText: "1 so'z" }).click();
await page.locator('[data-testid="qf-accepted"]').nth(0).fill("66");
await page.locator('[data-testid="qf-add-variant"]').nth(0).click();
await page.locator('[data-testid="qf-accepted"]').nth(1).fill("oltmish olti");
await page.locator('[data-testid="qf-accepted"]').nth(2).fill("sabr");
await page.click('[data-testid="qf-save"]');
check("So'z chegarasi 1, javob 2 so'z ('oltmish olti') — xato", ((await page.textContent('[data-testid="question-form"] .alert')) ?? "").includes("so'z chegarasidan"));
await page.locator('[data-testid="qf-word-limit"]', { hasText: "2 so'z" }).click();
await page.waitForTimeout(300); // rang o'tishi (140 ms) tugasin
const pressed = await page.$$eval('[data-testid="qf-word-limit"]', (els) => els.map((e) => [e.textContent, e.getAttribute("aria-pressed"), getComputedStyle(e).backgroundColor]));
check("So'z chegarasi: faqat '2 so'z' tanlangan, eski xato yo'qoldi", pressed.filter((p) => p[1] === "true").length === 1 && pressed[1][1] === "true" && pressed[0][2] !== pressed[1][2] && (await page.locator('[data-testid="question-form"] .alert').count()) === 0, JSON.stringify(pressed));
check("Oldindan ko'rish: matn ichida 2 ta bo'sh joy, '2 so'zdan oshmasin'", (await page.locator('[data-testid="qf-preview"] [data-testid="qv-blank"]').count()) === 2 && ((await page.textContent('[data-testid="qf-preview"]')) ?? "").includes("2 so'zdan oshmasin"));
await page.screenshot({ path: OUT + "99-admin-q-form-text.png", fullPage: true });
await page.click('[data-testid="qf-save"]');
await page.waitForFunction(() => document.querySelectorAll('[data-testid="q-item"]').length === 4, null, { timeout: 8000 });
b = await last();
check("Completion saqlandi: data {blanks:2, text, word_limit:2}, answer.blanks [[66, oltmish olti],[sabr]]", b.data.blanks === 2 && b.data.text.includes("___") && b.data.word_limit === 2 && JSON.stringify(b.answer.blanks) === JSON.stringify([["66", "oltmish olti"], ["sabr"]]), JSON.stringify(b));

// ---- 5) Jadval — katakchalar quruvchisi
await page.click('[data-testid="q-new"]');
await page.click('[data-testid="qf-type"][data-type="TABLE_COMPLETION"]');
await page.fill('[data-testid="qf-prompt"]', "Jadvalni to'ldiring.");
check("Jadval quruvchisi: 3 qator × 2 ustun, 2 ta bo'sh joy", (await page.locator('[data-testid="qf-cell"]').count()) === 6 && (await page.locator('[data-testid="qf-blank-answers"]').count()) === 2);
await page.click('[data-testid="qf-add-row"]');
await page.locator('[data-testid="qf-cell"]').nth(6).fill("3");
await page.locator('[data-testid="qf-cell"]').nth(7).fill("___");
const acc = page.locator('[data-testid="qf-accepted"]');
await acc.nth(0).fill("kichik qadam");
await acc.nth(1).fill("har kuni");
await acc.nth(2).fill("natija");
check("Oldindan ko'rish: jadval (4 qator) va 3 ta bo'sh joy", (await page.locator('[data-testid="qf-preview"] .qv-table tr').count()) === 4 && (await page.locator('[data-testid="qf-preview"] [data-testid="qv-blank"]').count()) === 3);
await page.click('[data-testid="qf-save"]');
await page.waitForFunction(() => document.querySelectorAll('[data-testid="q-item"]').length === 5, null, { timeout: 8000 });
b = await last();
check("Jadval saqlandi: matn qatorlari '|' bilan, blanks 3", b.type === "TABLE_COMPLETION" && b.data.blanks === 3 && b.data.text.split("\n").length === 4 && b.data.text.includes(" | "), JSON.stringify(b.data));

// ---- 6) Oqim sxemasi
await page.click('[data-testid="q-new"]');
await page.click('[data-testid="qf-type"][data-type="FLOW_CHART_COMPLETION"]');
await page.fill('[data-testid="qf-prompt"]', "Jarayonni to'ldiring.");
await page.click('[data-testid="qf-add-step"]');
check("Oqim: 3 qadam, oldindan ko'rishda strelkalar", (await page.locator('[data-testid="qf-step"]').count()) === 3 && (await page.locator('[data-testid="qf-preview"] .qv-flow-arrow').count()) === 2);
for (let i = 0; i < 3; i++) await page.locator('[data-testid="qf-accepted"]').nth(i).fill(["maqsad", "reja", "takror"][i]);
await page.click('[data-testid="qf-save"]');
await page.waitForFunction(() => document.querySelectorAll('[data-testid="q-item"]').length === 6, null, { timeout: 8000 });

// ---- Ro'yxat: raqamlar ballar bo'yicha, xulosa
const nums = await page.$$eval('[data-testid="q-item"] .qa-num', (els) => els.map((e) => e.textContent));
check("Raqamlar ballar bo'yicha: 1, 2, 3–4, 5–6, 7–9, 10–12", JSON.stringify(nums) === JSON.stringify(["1", "2", "3–4", "5–6", "7–9", "10–12"]), JSON.stringify(nums));
const summary = ((await page.textContent('[data-testid="qa-summary"]')) ?? "").replace(/\s+/g, " ");
check("Xulosa: 6 ta savol · 12 ball · mexanikalar", summary.includes("6 ta savol") && summary.includes("12 ball") && summary.includes("Moslashtirish: 1"), summary);
check("Javob qisqacha: matching '1 → i, 2 → ii'", ((await page.locator('[data-testid="qa-answer"]').nth(2).textContent()) ?? "").includes("1 → i, 2 → ii"));
await page.screenshot({ path: OUT + "99-admin-q-list.png", fullPage: true });

// ---- Tartib, nusxa, tahrir, o'chirish
await page.locator('[data-testid="q-down"]').nth(0).click();
await mockWait("/__questions", (l) => { const a = l.filter((q) => q.article_id === ART).sort((x, y) => x.order_index - y.order_index); return a[0]?.type === "TRUE_FALSE_NOT_GIVEN" && a[1]?.type === "MULTIPLE_CHOICE"; });
await page.waitForFunction(() => document.querySelector('[data-testid="q-item"]')?.dataset.type === "TRUE_FALSE_NOT_GIVEN", null, { timeout: 8000 });
check("Pastga: TFNG birinchi, tanlov ikkinchi (order_index)", (await qs()).map((q) => q.order_index).join() === "0,1,2,3,4,5");
await page.locator('[data-testid="q-duplicate"]').nth(0).click();
await page.waitForFunction(() => document.querySelectorAll('[data-testid="q-item"]').length === 7, null, { timeout: 8000 });
check("Nusxa: ro'yxat oxirida TFNG nusxasi", (await qs())[6]?.type === "TRUE_FALSE_NOT_GIVEN");
await page.locator('[data-testid="q-edit"]').nth(6).click();
await page.waitForSelector('[data-testid="question-form"]');
check("Tahrir: forma joriy qiymatlar bilan (izoh va sahifa alohida), boshqa tugmalar o'chiq", (await page.inputValue('[data-testid="qf-prompt"]')).includes("Kichik odatlar") && (await page.inputValue('[data-testid="qf-explanation"]')) === "2-paragraf." && (await page.inputValue('[data-testid="qf-answer-page"]')) === "3" && (await page.locator('[data-testid="q-new"]').isDisabled()));
await page.fill('[data-testid="qf-prompt"]', "Odat shakllanishi uchun iroda yetarli.");
await page.locator('[data-testid="qf-enum"]', { hasText: "NOT GIVEN" }).click();
await page.click('[data-testid="qf-save"]');
await page.waitForSelector("text=Odat shakllanishi uchun iroda yetarli.", { timeout: 8000 });
check("Tahrir saqlandi (PATCH): matn va javob NOT_GIVEN", (await qs())[6].prompt.includes("iroda") && (await qs())[6].answer.value === "NOT_GIVEN");
await page.locator('[data-testid="q-delete"]').nth(6).click();
await confirmDialog(page);
await page.waitForFunction(() => document.querySelectorAll('[data-testid="q-item"]').length === 6, null, { timeout: 8000 });
check("O'chirish (tasdiq bilan)", (await qs()).length === 6);

// ---- Server 422 xabari; data.choose saqlanmasa — ogohlantirish
await page.click('[data-testid="q-new"]');
await page.click('[data-testid="qf-type"][data-type="YES_NO_NOT_GIVEN"]');
check("YNNG: YES / NO / NOT GIVEN", (await page.locator('[data-testid="qf-enum"]').allTextContents()).join("|") === "YES|NO|NOT GIVEN");
await page.fill('[data-testid="qf-prompt"]', "__422__");
await page.locator('[data-testid="qf-enum"]', { hasText: "YES" }).click();
await page.click('[data-testid="qf-save"]');
await page.waitForSelector('[data-testid="question-form"] .alert', { timeout: 5000 });
check("Server 422 — xabar formada, forma ochiq qoladi", (await page.locator('[data-testid="question-form"]').count()) === 1 && ((await page.textContent('[data-testid="question-form"] .alert')) ?? "").length > 3);
await page.locator('[data-testid="question-form"] button', { hasText: "Bekor" }).click();
await confirmDialog(page); // o'zgargan forma — "O'zgarishlarni tashlash"
await page.click('[data-testid="q-new"]');
await page.fill('[data-testid="qf-prompt"]', "Choose TWO letters.");
for (let i = 0; i < 4; i++) await page.locator('[data-testid="qf-option"]').nth(i).fill(`V${i + 1}`);
await page.locator('[data-testid="qf-correct"]').nth(1).check();
await page.locator('[data-testid="qf-correct"]').nth(3).check();
await page.click('[data-testid="qf-save"]');
await page.waitForFunction(() => document.querySelectorAll('[data-testid="q-item"]').length === 7, null, { timeout: 8000 });
check("Ko'p javobli: data.choose = 2 yuborildi va saqlandi", (await last()).data.choose === 2 && (await qs()).at(-1).data.choose === 2);

// ---- Diagramma: rasm yuklash, bo'sh joylarni rasmda joylash
await page.click('[data-testid="q-new"]');
await page.click('[data-testid="qf-type"][data-type="DIAGRAM_LABEL_COMPLETION"]');
await page.fill('[data-testid="qf-prompt"]', "Diagrammani belgilang.");
await page.fill('[data-testid="qf-text"]', "Ildiz: ___\nBarg: ___");
await page.locator('[data-testid="qf-accepted"]').nth(0).fill("suv");
await page.locator('[data-testid="qf-accepted"]').nth(1).fill("o‘simlik"); // apostrof shakli — saqlashda `'`
await page.setInputFiles('[data-testid="qf-image-file"]', { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
check("Matn fayli — 'Faqat JPEG, PNG yoki WebP'", ((await page.textContent('[data-testid="question-form"] .alert')) ?? "").includes("Faqat JPEG"));
await page.click('[data-testid="qf-image-url-toggle"]');
await page.fill('[data-testid="qf-image-url"]', "http://img.test/plant.png");
check("Tashqi havola http:// — xato", ((await page.textContent('[data-testid="qf-diagram"]')) ?? "").includes("https:// bilan boshlanishi"));
await page.fill('[data-testid="qf-image-url"]', "");
await page.setInputFiles('[data-testid="qf-image-file"]', WEBP);
await page.waitForFunction(() => document.querySelector('[data-testid="qf-labels-img"]')?.naturalWidth > 0, null, { timeout: 8000 });
const labelsImg = page.locator('[data-testid="qf-labels-img"]');
const clickImg = async (fx, fy) => {
  await labelsImg.scrollIntoViewIfNeeded();
  const box = await labelsImg.boundingBox();
  await labelsImg.click({ position: { x: box.width * fx, y: box.height * fy } });
};
const imgOffset = () => labelsImg.evaluate((img) => img.getBoundingClientRect().top - img.closest('[data-testid="qf-labels"]').getBoundingClientRect().top);
const off0 = await imgOffset();
await clickImg(0.25, 0.3);
check("Birinchi nuqtadan keyin rasm siljimaydi", Math.abs((await imgOffset()) - off0) < 1);
await clickImg(0.75, 0.8);
const pv = await page.$$eval('[data-testid="qf-preview"] [data-testid="qv-pin"]', (els) => els.map((e) => e.textContent).join(","));
check("Yorliqlar: '2 / 2 joylashtirildi', o'quvchi ko'rinishida 2 nuqta (1, 2)", ((await page.textContent('[data-testid="qf-labels-count"]')) ?? "").includes("2 / 2") && pv === "1,2", pv);
await page.locator('[data-testid="qf-label-chip"]').nth(0).click(); // 1-ni qayta joylash
await clickImg(0.5, 0.5);
await page.locator('[data-testid="qa-editor"]').screenshot({ path: OUT + "99-admin-q-diagram.png" });
await fetch(`${API_HOST}/__diagram-delay?ms=1500`);
await page.click('[data-testid="qf-save"]');
await page.waitForSelector('[data-testid="qf-upload-progress"]', { timeout: 5000 });
check("Rasm yuklanishi: 'Rasm yuklanmoqda… N%' va chiziq, 'Bekor' o'chiq", ((await page.textContent('[data-testid="qf-upload-progress"]')) ?? "").includes("Rasm yuklanmoqda") && (await page.locator('[data-testid="qf-cancel"]').isDisabled()));
await page.waitForFunction(() => document.querySelectorAll('[data-testid="q-item"]').length === 8, null, { timeout: 8000 });
await fetch(`${API_HOST}/__diagram-delay?ms=0`);
await page.waitForSelector('[data-testid="qa-image"]', { timeout: 8000 });
const dg = (await qs()).at(-1);
const near = (a, b) => Math.abs(a - b) < 1.5;
check("Saqlandi: labels [(50,50), (75,80)], so'ng rasm yuklandi → data.image_url (backend yo'li), apostrof `'`", near(dg.data.labels[0].x, 50) && near(dg.data.labels[0].y, 50) && near(dg.data.labels[1].x, 75) && near(dg.data.labels[1].y, 80) && dg.data.image_url === `/api/v1/reader/questions/${dg.id}/diagram` && dg.answer.blanks[1][0] === "o'simlik", JSON.stringify(dg.data));
// Tahrir: PATCH `data` ni to'liq almashtiradi — rasm va yorliqlar yo'qolmasin
await page.locator('[data-testid="q-edit"]').last().click();
await page.waitForFunction(() => document.querySelector('[data-testid="qf-labels-img"]')?.naturalWidth > 0, null, { timeout: 8000 });
await page.fill('[data-testid="qf-prompt"]', "Diagrammani belgilang (rasmga qarang).");
await page.click('[data-testid="qf-save"]');
await page.waitForSelector("text=Diagrammani belgilang (rasmga qarang).", { timeout: 8000 });
const dg2 = (await qs()).at(-1);
check("Tahrirdan keyin: rasm (token bilan yuklandi) va yorliqlar joyida", dg2.data.image_url === dg.data.image_url && dg2.data.labels?.length === 2 && (await last()).data.image_url === dg.data.image_url, JSON.stringify(dg2.data));

// ---- 91: saqlanmagan o'zgarishlar
await page.click('[data-testid="q-new"]');
await page.click('[data-testid="qf-type"][data-type="TRUE_FALSE_NOT_GIVEN"]');
await page.click('[data-testid="qf-cancel"]');
check("Faqat tur tanlandi (hech narsa yozilmadi) — 'Bekor' tasdiqsiz yopadi", (await page.locator('[data-testid="question-form"]').count()) === 0 && (await page.locator('[data-testid="confirm-dialog"]').count()) === 0);
await page.click('[data-testid="q-new"]');
await page.fill('[data-testid="qf-prompt"]', "Yarim yozilgan savol");
const unload = await page.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
check("Tabni yopish/yangilash — brauzer tasdig'i (beforeunload)", unload);
await page.click('[data-testid="questions-page"] nav.crumbs a[href="/admin/books"]');
await page.waitForSelector('[data-testid="confirm-dialog"]', { timeout: 5000 });
check("Havola (breadcrumbs) — 'Saqlanmagan o'zgarishlar' tasdig'i", ((await page.textContent('[data-testid="confirm-dialog"]')) ?? "").includes("Saqlanmagan o'zgarishlar"));
await confirmDialog(page, false);
check("'Qolish' — sahifada, yozilgani joyida", page.url().endsWith("/questions") && (await page.inputValue('[data-testid="qf-prompt"]')) === "Yarim yozilgan savol");
await page.click('[data-testid="qf-cancel"]');
await page.waitForSelector('[data-testid="confirm-dialog"]', { timeout: 5000 });
check("'Bekor' — 'O'zgarishlarni tashlash' tasdig'i", ((await page.textContent('[data-testid="confirm-dialog"]')) ?? "").includes("O'zgarishlarni tashlash"));
await confirmDialog(page);
check("Tashlandi — forma yopildi", (await page.locator('[data-testid="question-form"]').count()) === 0);
const unload2 = await page.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
check("Forma yopilgach — himoya o'chdi", !unload2);

// ---- Kitob sahifasiga qaytish — Maqolalar tabi, savollar soni
await page.click(`[data-testid="questions-page"] nav.crumbs a[href^="/admin/books/${BOOK}"]`);
await page.waitForSelector('[data-testid="article-qcount"]', { timeout: 15000 });
await page.waitForFunction(() => document.querySelector('[data-testid="article-qcount"]')?.dataset.count === "8", null, { timeout: 10000 });
check("Breadcrumb → kitob sahifasi 'Maqolalar' tabida, '8 ta savol'", ((await page.textContent('[data-testid="article-qcount"]')) ?? "").includes("8 ta savol"));

// ---- O'quvchi — admin UI'da yaratilgan savollarni yechadi (to'liq zanjir)
const student = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
student.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
await student.goto(`${BASE}/login`);
await student.fill('input[autocomplete="username"]', "user@articles365.local");
await student.fill('input[type="password"]', "User12345!");
await student.click('button[type="submit"]');
await student.waitForURL(`${BASE}/library`, { timeout: 30000 });
await student.goto(`${BASE}/reader/${ART}`);
await student.waitForFunction(() => [...document.querySelectorAll("[data-page] canvas")].some((c) => c.width > 0), null, { timeout: 30000 });
await student.click('button[aria-label="Panel"]');
await student.click('[role="tab"]:has-text("Test")');
await student.waitForSelector('[data-testid="quiz-panel"]');
const sq = (type) => student.locator(`[data-testid="quiz-question"][data-type="${type}"]`).first();
check("O'quvchi: admin yaratgan 8 savol, turlari bo'yicha ko'rinish", (await student.locator('[data-testid="quiz-question"]').count()) === 8 && (await sq("FLOW_CHART_COMPLETION").locator(".qv-flow-box").count()) === 3 && (await sq("TABLE_COMPLETION").locator(".qv-table").count()) === 1);
check("O'quvchi: 'Choose TWO letters' — 2 ta javob, belgilash kataklari", ((await student.locator('[data-testid="quiz-question"]', { hasText: "Choose TWO letters" }).textContent()) ?? "").includes("2 ta javobni tanlang") && (await student.locator('[data-testid="quiz-question"]', { hasText: "Choose TWO letters" }).locator('input[type="checkbox"]').count()) === 4);
await student.waitForFunction(() => document.querySelector('[data-type="DIAGRAM_LABEL_COMPLETION"] .qv-figure img')?.naturalWidth > 0, null, { timeout: 8000 });
check("O'quvchi: rasm ustida savol raqamli nuqtalar (14, 15)", (await sq("DIAGRAM_LABEL_COMPLETION").locator('[data-testid="qv-pin"]').allTextContents()).join(",") === "14,15");
await sq("DIAGRAM_LABEL_COMPLETION").locator(".qv-figure button").click();
await student.waitForSelector('[data-testid="qv-figure-zoom"]');
check("Kattalashtirishda ham nuqtalar", (await student.locator('[data-testid="qv-figure-zoom"] [data-testid="qv-pin"]').count()) === 2);
await student.keyboard.press("Escape");
check("O'quvchi: diagramma rasmi; bosilsa kattalashadi, Esc — yopiladi", (await student.locator('[data-testid="qv-figure-zoom"]').count()) === 0);
await sq("TRUE_FALSE_NOT_GIVEN").locator('[data-testid="qv-enum"]', { hasText: "FALSE" }).click();
await sq("SENTENCE_COMPLETION").locator('[data-testid="qv-blank"]').nth(0).fill("OLTMISH  olti."); // variant + normalizatsiya (katta harf, bo'shliq, chetdagi nuqta)
await sq("SENTENCE_COMPLETION").locator('[data-testid="qv-blank"]').nth(1).fill("SABR");
await sq("DIAGRAM_LABEL_COMPLETION").locator('[data-testid="qv-blank"]').nth(0).fill("(Suv)");
await sq("DIAGRAM_LABEL_COMPLETION").locator('[data-testid="qv-blank"]').nth(1).fill("oʻsimlik"); // boshqa apostrof shakli
await sq("MATCHING_HEADINGS").locator('[data-testid="qv-match-select"]').nth(0).selectOption("i");
await sq("MATCHING_HEADINGS").locator('[data-testid="qv-match-select"]').nth(1).selectOption("ii");
await student.click('[data-testid="quiz-submit"]');
await confirmDialog(student);
await student.waitForSelector('[data-testid="quiz-score"]', { timeout: 8000 });
const st = await student.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-testid="quiz-question"]')].map((el) => [el.dataset.type, el.dataset.result])));
check("O'quvchi natijasi: TFNG, matching (2/2), completion ('OLTMISH  olti.', 'SABR'), diagramma ('(Suv)', 'oʻsimlik') — to'g'ri", st.TRUE_FALSE_NOT_GIVEN === "correct" && st.MATCHING_HEADINGS === "correct" && st.SENTENCE_COMPLETION === "correct" && st.DIAGRAM_LABEL_COMPLETION === "correct" && st.TABLE_COMPLETION === "wrong", JSON.stringify(st));
check("Natijada diagramma nuqtalari yashil", (await sq("DIAGRAM_LABEL_COMPLETION").locator(".qv-pin.correct").count()) === 2);
check("Yuborilgan javobda apostrof `'` ga keltirildi", JSON.stringify(await mockGet("/__last-quiz-body")).includes("o'simlik"));
check("Ball: 7 / 15 (TFNG 1 + matching 2 + completion 2 + diagramma 2; jami: 1+1+2+2+3+3+1+2)", ((await student.textContent('[data-testid="quiz-score"]')) ?? "").includes("7 / 15"), (await student.textContent('[data-testid="quiz-score"]')) ?? "");
await student.context().close();

// ---- Telefon: o'quvchi — diagramma panelga sig'adi, nuqtalar rasm ustida, kattalashtirish
const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
phone.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
await phone.goto(`${BASE}/login`);
await phone.fill('input[autocomplete="username"]', "user@articles365.local");
await phone.fill('input[type="password"]', "User12345!");
await phone.click('button[type="submit"]');
await phone.waitForURL(`${BASE}/library`, { timeout: 30000 });
await phone.goto(`${BASE}/reader/${ART}`);
await phone.waitForFunction(() => [...document.querySelectorAll("[data-page] canvas")].some((c) => c.width > 0), null, { timeout: 30000 });
await phone.click('button[aria-label="Panel"]');
await phone.click('[role="tab"]:has-text("Test")');
const pdg = phone.locator('[data-testid="quiz-question"][data-type="DIAGRAM_LABEL_COMPLETION"]');
await pdg.scrollIntoViewIfNeeded();
await phone.waitForFunction(() => document.querySelector('[data-type="DIAGRAM_LABEL_COMPLETION"] .qv-figure img')?.naturalWidth > 0, null, { timeout: 8000 });
const geo = await pdg.evaluate((el) => {
  const img = el.querySelector(".qv-figure img").getBoundingClientRect();
  const panel = el.closest('[data-testid="quiz-panel"]').getBoundingClientRect();
  const pins = [...el.querySelectorAll('[data-testid="qv-pin"]')].map((p) => { const r = p.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  return { fit: img.left >= panel.left - 1 && img.right <= panel.right + 1, inside: pins.every((p) => p.x >= img.left && p.x <= img.right && p.y >= img.top && p.y <= img.bottom), pins: pins.length, sw: document.documentElement.scrollWidth - innerWidth };
});
check("390px o'quvchi: rasm panelga sig'adi, 2 nuqta rasm ustida, toshish yo'q", geo.fit && geo.inside && geo.pins === 2 && geo.sw <= 1, JSON.stringify(geo));
await pdg.screenshot({ path: OUT + "99-reader-diagram-390.png" });
await pdg.locator(".qv-figure button").tap();
await phone.waitForSelector('[data-testid="qv-figure-zoom"]');
const zoomGeo = await phone.evaluate(() => { const r = document.querySelector('[data-testid="qv-figure-zoom"] img').getBoundingClientRect(); return { w: Math.round(r.width), fits: r.right <= innerWidth && r.bottom <= innerHeight, pins: document.querySelectorAll('[data-testid="qv-figure-zoom"] [data-testid="qv-pin"]').length }; });
check("390px kattalashtirish: ekranga sig'adi, nuqtalar bor", zoomGeo.fits && zoomGeo.pins === 2 && zoomGeo.w > 300, JSON.stringify(zoomGeo));
await phone.screenshot({ path: OUT + "99-reader-diagram-390-zoom.png" });
await phone.locator('[data-testid="qv-figure-zoom"]').tap();
check("Bosilsa yopiladi", (await phone.locator('[data-testid="qv-figure-zoom"]').count()) === 0);
await phone.context().close();

// ---- Telefon: admin — ro'yxat va forma sig'adi, diagrammada nuqta qo'yish
await page.goto(`${BASE}/admin/books/${BOOK}/articles/${ART}/questions`);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForSelector('[data-testid="q-item"]');
await page.locator('[data-testid="q-edit"]').last().click();
await page.waitForFunction(() => document.querySelector('[data-testid="qf-labels-img"]')?.naturalWidth > 0, null, { timeout: 8000 });
const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const imgFit = await labelsImg.evaluate((img) => img.getBoundingClientRect().right <= innerWidth);
check("390px admin: ro'yxat, forma va diagramma muharriri sig'adi", sw <= 1 && imgFit, `+${sw}`);
await page.locator('[data-testid="qf-label-chip"]').nth(1).click();
await clickImg(0.2, 0.2);
const mpins = await page.$$eval('[data-testid="qf-preview"] [data-testid="qv-pin"]', (els) => els.length);
check("390px admin: rasmni bosib 2-nuqta ko'chirildi (forma o'zgardi)", mpins === 2 && (await page.locator('[data-testid="qf-labels-count"]').textContent()).includes("2 / 2"));
await page.screenshot({ path: OUT + "99-admin-q-390.png", fullPage: true });
await page.click('[data-testid="qf-cancel"]');
await confirmDialog(page);
check("Bekor — o'zgarish tashlandi (saqlanmadi)", (await qs()).at(-1).data.labels[1].x > 60);

check("Sahifa xatolari yo'q", errors.length === 0, errors.join(" | ").slice(0, 300));
await done(browser);
