// 87–90: PROD smoke — IELTS savollari real backend bilan (admin akkaunt): admin UI'da 13 tur yaratiladi (diagramma —
// rasm yuklash + yorliqlar, tahrirda saqlanib qolishi) →
// saqlangan shakllar API'da tekshiriladi → o'quvchi (shu akkaunt) yechadi: UI'dagi ball va element/bo'sh joy belgilari
// server natijasiga mos, yashirin javoblar, "Matnda ko'rsatish", tuzatib qayta tekshirish (100%) → TOZALASH (yaratilgan
// savollar o'chiriladi, mark-read=false). Maqolada oldindan savol bo'lsa — to'xtaydi (haqiqiy kontentga tegmaydi).
import { launch, confirmDialog } from "../lib.mjs";
import { mkdirSync } from "node:fs";

const BASE = process.env.E2E_BASE ?? "http://localhost:3200";
const API = "https://articles.api.cognilabs.org/api/v1";
const BOOK = process.env.E2E_IELTS_BOOK ?? "e06f0866-4d46-4c6e-a108-6cac9bbf0fb9"; // "Test" kitobi
const EMAIL = process.env.A365_EMAIL, PASS = process.env.A365_PASS;
if (!EMAIL || !PASS) throw new Error("A365_EMAIL / A365_PASS env kerak");
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };

const login = await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: EMAIL, password: PASS, device_name: "smoke-ielts" }) })).json();
const H = { Authorization: `Bearer ${login.access_token}`, "Content-Type": "application/json" };
const arts = await (await fetch(`${API}/admin/books/${BOOK}/articles`, { headers: H })).json();
const ART = [...(Array.isArray(arts) ? arts : arts.items)].sort((a, b) => a.order_index - b.order_index)[0].id;
const adminQs = async () => (await (await fetch(`${API}/admin/articles/${ART}/questions`, { headers: H })).json()).sort((a, b) => a.order_index - b.order_index);
const before = await adminQs();
if (before.length) throw new Error(`Maqolada ${before.length} ta savol bor — haqiqiy kontentga tegmaslik uchun to'xtatildi`);
for (const pth of ["/login", "/library", `/admin/books/${BOOK}`]) await fetch(`${BASE}${pth}`).catch(() => undefined);

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const WEBP = new URL("../../public/auth/mag-1.webp", import.meta.url).pathname; // diagramma rasmi (yuklanadi)
const pageErrors = [], apiFails = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("response", (r) => { if (r.url().includes("/api/v1/") && r.status() >= 400) apiFails.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
async function cleanup() {
  try {
    const left = await adminQs();
    for (const q of left) await fetch(`${API}/admin/articles/${ART}/questions/${q.id}`, { method: "DELETE", headers: H });
    await fetch(`${API}/articles/${ART}/mark-read?is_read=false`, { method: "POST", headers: H });
    console.log(`(prod) tozalandi: ${left.length} ta savol o'chirildi, qoldi: ${(await adminQs()).length}`);
    await fetch(`${API}/auth/logout`, { method: "POST", headers: H, body: JSON.stringify({ refresh_token: login.refresh_token }) });
  } catch (e) { console.log("(prod) tozalashda xato:", e.message); }
}
process.on("unhandledRejection", async (e) => { console.log("❌ XATO:", e.message.split("\n")[0]); await page.screenshot({ path: OUT + "99-prod-ielts-failure.png" }).catch(() => {}); await cleanup(); await browser.close(); process.exit(1); });

try {
  await page.goto(`${BASE}/login`);
  await page.fill('input[autocomplete="username"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45000 });

  // ---- Admin: kitob → Maqolalar → savollar sahifasi
  await page.goto(`${BASE}/admin/books/${BOOK}?tab=articles`);
  await page.waitForSelector('[data-testid="article-qcount"]', { timeout: 45000 });
  await page.locator('[data-testid="article-qcount"]').first().click();
  await page.waitForURL(`**/articles/${ART}/questions`, { timeout: 30000 });
  await page.waitForSelector("text=Hali savol yo'q", { timeout: 30000 });
  const items = () => page.locator('[data-testid="q-item"]').count();
  const saveAndWait = async (n) => {
    await page.click('[data-testid="qf-save"]');
    await page.waitForFunction((n) => document.querySelectorAll('[data-testid="q-item"]').length === n, n, { timeout: 30000 });
  };
  const start = async (type, prompt) => {
    await page.click('[data-testid="q-new"]');
    await page.click(`[data-testid="qf-type"][data-type="${type}"]`);
    await page.fill('[data-testid="qf-prompt"]', prompt);
  };
  const matching = async (type, prompt, its, opts, answers) => {
    await start(type, prompt);
    for (const [i, t] of its.entries()) await page.locator('[data-testid="qf-item"]').nth(i).fill(t);
    for (const [i, t] of opts.entries()) await page.locator('[data-testid="qf-opt-text"]').nth(i).fill(t);
    for (const [i, k] of answers.entries()) await page.locator('[data-testid="qf-item-answer"]').nth(i).selectOption(k);
  };
  const completion = async (type, prompt, text, accepted) => {
    await start(type, prompt);
    if (text !== null) await page.fill('[data-testid="qf-text"]', text);
    for (const [i, v] of accepted.entries()) await page.locator('[data-testid="qf-accepted"]').nth(i).fill(v);
  };

  // 1 MC (bitta) · 2 MC (ikkita, "Choose TWO") · 3 TFNG (javob sahifasi 2) · 4 YNNG
  await start("MULTIPLE_CHOICE", "Odatni nima mustahkamlaydi?");
  for (const [i, t] of ["Iroda", "Takrorlash", "Omad", "Pul"].entries()) await page.locator('[data-testid="qf-option"]').nth(i).fill(t);
  await page.locator('[data-testid="qf-correct"]').nth(1).check();
  await saveAndWait(1);
  await start("MULTIPLE_CHOICE", "Choose TWO letters, A–D.");
  for (const [i, t] of ["Kichik boshlash", "Hammasini birdan", "Muhitni o'zgartirish", "Kutish"].entries()) await page.locator('[data-testid="qf-option"]').nth(i).fill(t);
  await page.locator('[data-testid="qf-correct"]').nth(0).check();
  await page.locator('[data-testid="qf-correct"]').nth(2).check();
  await saveAndWait(2);
  await start("TRUE_FALSE_NOT_GIVEN", "Kichik odatlar natijani tez o'zgartiradi.");
  await page.locator('[data-testid="qf-enum"]', { hasText: "FALSE" }).click();
  await page.fill('[data-testid="qf-explanation"]', "Natija sekin, lekin barqaror.");
  await page.fill('[data-testid="qf-answer-page"]', "2");
  await saveAndWait(3);
  await start("YES_NO_NOT_GIVEN", "Muallif iroda yetarli deb hisoblaydi.");
  await page.locator('[data-testid="qf-enum"]', { hasText: /^NO$/ }).click();
  await saveAndWait(4);
  // 5–8 matching
  await matching("MATCHING_INFORMATION", "Qaysi paragrafda bor?", ["Muallif tajribasi", "Ilmiy tadqiqot"], ["Paragraf A", "Paragraf B", "Paragraf C"], ["A", "A"]);
  await saveAndWait(5);
  await matching("MATCHING_HEADINGS", "A–C paragraflar uchun sarlavha tanlang.", ["Paragraf A", "Paragraf B"], ["Kichik qadamlar", "Muhitning roli", "Motivatsiya afsonasi"], ["i", "ii"]);
  await saveAndWait(6);
  await matching("MATCHING_FEATURES", "Fikr kimga tegishli?", ["Odat — tizim", "Muhit muhim"], ["Clear", "Fogg", "Duhigg"], ["A", "B"]);
  await saveAndWait(7);
  await matching("MATCHING_SENTENCE_ENDINGS", "Gaplarni tugating.", ["Kichik qadamlar…", "Muhit…"], ["…natijani tezlashtiradi.", "…odatni qo'llab-quvvatlaydi.", "…hech narsa bermaydi."], ["A", "B"]);
  await saveAndWait(8);
  // 9–14 completion
  await completion("SENTENCE_COMPLETION", "Matndan BIR yoki IKKI so'z bilan to'ldiring.", "Odat ___ kun ichida shakllanadi va ___ talab qiladi.", ["oltmish olti", "o‘z-o‘zini nazorat"]);
  await saveAndWait(9);
  await completion("SUMMARY_COMPLETION", "Xulosani to'ldiring.", "Natija ___ keladi.", ["sekin"]);
  await saveAndWait(10);
  await completion("NOTE_COMPLETION", "Qaydlarni to'ldiring.", "Odat qismlari\n- signal: ___\n- mukofot: ___", ["vaqt", "quvonch"]);
  await page.locator('[data-testid="qf-add-variant"]').nth(0).click();
  await page.locator('[data-testid="qf-accepted"]').nth(1).fill("soat"); // 2-variant (natijada backend faqat 1-variantni qaytaradi)
  await saveAndWait(11);
  await start("TABLE_COMPLETION", "Jadvalni to'ldiring.");
  await page.locator('[data-testid="qf-accepted"]').nth(0).fill("kichik qadam");
  await page.locator('[data-testid="qf-accepted"]').nth(1).fill("har kuni");
  await saveAndWait(12);
  await start("FLOW_CHART_COMPLETION", "Jarayonni to'ldiring.");
  await page.locator('[data-testid="qf-accepted"]').nth(0).fill("maqsad");
  await page.locator('[data-testid="qf-accepted"]').nth(1).fill("reja");
  await saveAndWait(13);
  await start("DIAGRAM_LABEL_COMPLETION", "Diagrammani belgilang.");
  await page.fill('[data-testid="qf-text"]', "Ildiz: ___\nBarg: ___");
  await page.setInputFiles('[data-testid="qf-image-file"]', WEBP);
  const labelsImg = page.locator('[data-testid="qf-labels-img"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="qf-labels-img"]')?.naturalWidth > 0, null, { timeout: 15000 });
  for (const [fx, fy] of [[0.5, 0.45], [0.7, 0.8]]) {
    await labelsImg.scrollIntoViewIfNeeded();
    const bb = await labelsImg.boundingBox();
    await labelsImg.click({ position: { x: bb.width * fx, y: bb.height * fy } });
  }
  await page.locator('[data-testid="qf-accepted"]').nth(0).fill("suv");
  await page.locator('[data-testid="qf-accepted"]').nth(1).fill("quyosh");
  await saveAndWait(14);
  check("Admin UI: 14 ta savol (13 tur) real backend'da saqlandi, 4xx yo'q", (await items()) === 14 && apiFails.length === 0, apiFails.join(", "));
  const nums = await page.$$eval('[data-testid="q-item"] .qa-num', (els) => els.map((e) => e.textContent).join(","));
  check("Raqamlar ballar bo'yicha (backend `points`)", nums === "1,2,3,4,5–6,7–8,9–10,11–12,13–14,15,16–17,18–19,20–21,22–23", nums);
  check("Ro'yxatda diagramma savolida rasm belgisi (yuklandi)", (await page.locator('[data-testid="qa-image"]').count()) === 1);
  await page.screenshot({ path: OUT + "99-prod-ielts-admin.png", fullPage: true });

  const saved = await adminQs();
  const byType = (t, i = 0) => saved.filter((q) => q.type === t)[i];
  check("API: data.choose=2, answer.correct=[0,2]", byType("MULTIPLE_CHOICE", 1)?.data.choose === 2 && JSON.stringify(byType("MULTIPLE_CHOICE", 1)?.answer.correct) === "[0,2]");
  check("API: TFNG izohi '… [p. 2]'", byType("TRUE_FALSE_NOT_GIVEN")?.explanation === "Natija sekin, lekin barqaror. [p. 2]");
  check("API: completion — apostrof `'` ga keltirilgan, word_limit 2", JSON.stringify(byType("SENTENCE_COMPLETION")?.answer.blanks) === JSON.stringify([["oltmish olti"], ["o'z-o'zini nazorat"]]) && byType("SENTENCE_COMPLETION")?.data.word_limit === 2);
  const dg = byType("DIAGRAM_LABEL_COMPLETION");
  check("API: jadval/oqim matni; diagramma — yuklangan rasm (data.image_url) va 2 ta yorliq", byType("TABLE_COMPLETION")?.data.text.includes(" | ") && byType("FLOW_CHART_COMPLETION")?.data.blanks === 2 && dg?.data.image_url === `/api/v1/reader/questions/${dg?.id}/diagram` && dg?.data.labels?.length === 2, JSON.stringify(dg?.data));
  check("API: bitta to'g'ri javobli tanlovda choose=1", byType("MULTIPLE_CHOICE", 0)?.data.choose === 1);
  // Tahrir (PATCH data'ni to'liq almashtiradi): rasm va yorliqlar yo'qolmasin
  await page.locator('[data-testid="q-edit"]').last().click();
  await page.waitForFunction(() => document.querySelector('[data-testid="qf-labels-img"]')?.naturalWidth > 0, null, { timeout: 15000 });
  await page.fill('[data-testid="qf-prompt"]', "Diagrammani belgilang (rasmga qarang).");
  await page.click('[data-testid="qf-save"]');
  await page.waitForSelector("text=Diagrammani belgilang (rasmga qarang).", { timeout: 30000 });
  const dg2 = (await adminQs()).find((x) => x.id === dg.id);
  check("Admin tahriri: rasm token bilan ko'rindi; saqlangach image_url va labels joyida", dg2?.data.image_url === dg.data.image_url && dg2?.data.labels?.length === 2);

  // ---- O'quvchi (shu akkaunt)
  await page.goto(`${BASE}/reader/${ART}`);
  await page.waitForFunction(() => [...document.querySelectorAll("[data-page] canvas")].some((c) => c.width > 0), null, { timeout: 60000 });
  await page.click('button[aria-label="Panel"]');
  await page.click('[role="tab"]:has-text("Test")');
  await page.waitForSelector('[data-testid="quiz-panel"]', { timeout: 30000 });
  const q = (t, i = 0) => page.locator(`[data-testid="quiz-question"][data-type="${t}"]`).nth(i);
  check("O'quvchi: 14 savol, 13 guruh (2 ta tanlov — bitta guruh), '23 ta savol'", (await page.locator('[data-testid="quiz-question"]').count()) === 14 && (await page.locator('[data-testid="quiz-group"]').count()) === 13 && ((await page.textContent(".quiz-intro")) ?? "").includes("23"));
  check("Choose TWO: '2 ta javobni tanlang', belgilash kataklari", ((await q("MULTIPLE_CHOICE", 1).textContent()) ?? "").includes("2 ta javobni tanlang") && (await q("MULTIPLE_CHOICE", 1).locator('input[type="checkbox"]').count()) === 4);
  await page.waitForFunction(() => document.querySelector('[data-type="DIAGRAM_LABEL_COMPLETION"] .qv-figure img')?.naturalWidth > 0, null, { timeout: 15000 });
  check("O'quvchi: diagramma rasmi (GET …/diagram, token bilan) va nuqtalar 22, 23", (await q("DIAGRAM_LABEL_COMPLETION").locator('[data-testid="qv-pin"]').allTextContents()).join(",") === "22,23");
  check("Diagramma rasmi, jadval, oqim, qaydlar ko'rinishi", (await q("TABLE_COMPLETION").locator(".qv-table").count()) === 1 && (await q("FLOW_CHART_COMPLETION").locator(".qv-flow-box").count()) === 2 && (await q("NOTE_COMPLETION").locator(".qv-note-line.bullet").count()) === 2);

  // Aralash javoblar: to'g'ri / xato / qisman / normalizatsiya
  await q("MULTIPLE_CHOICE", 0).locator('[data-testid="qv-option"]').nth(1).click(); // ✓
  await q("MULTIPLE_CHOICE", 1).locator('[data-testid="qv-option"]').nth(0).click();
  await q("MULTIPLE_CHOICE", 1).locator('[data-testid="qv-option"]').nth(1).click(); // ✗ (A+B)
  await q("TRUE_FALSE_NOT_GIVEN").locator('[data-testid="qv-enum"]', { hasText: /^TRUE$/ }).click(); // ✗
  await q("YES_NO_NOT_GIVEN").locator('[data-testid="qv-enum"]', { hasText: /^NO$/ }).click(); // ✓
  await q("MATCHING_INFORMATION").locator('[data-testid="qv-match-select"]').nth(0).selectOption("A");
  await q("MATCHING_INFORMATION").locator('[data-testid="qv-match-select"]').nth(1).selectOption("A"); // 2/2
  await q("MATCHING_HEADINGS").locator('[data-testid="qv-match-select"]').nth(0).selectOption("ii");
  await q("MATCHING_HEADINGS").locator('[data-testid="qv-match-select"]').nth(1).selectOption("i"); // 0/2
  await q("MATCHING_FEATURES").locator('[data-testid="qv-match-select"]').nth(0).selectOption("A"); // 1/2
  await q("MATCHING_SENTENCE_ENDINGS").locator('[data-testid="qv-match-select"]').nth(0).selectOption("A");
  await q("MATCHING_SENTENCE_ENDINGS").locator('[data-testid="qv-match-select"]').nth(1).selectOption("B"); // 2/2
  await q("SENTENCE_COMPLETION").locator('[data-testid="qv-blank"]').nth(0).fill("OLTMISH  olti."); // ✓ (katta harf, bo'shliq, nuqta)
  await q("SENTENCE_COMPLETION").locator('[data-testid="qv-blank"]').nth(1).fill("oʻz-oʻzini nazorat"); // ✓ (boshqa apostrof)
  await q("SUMMARY_COMPLETION").locator('[data-testid="qv-blank"]').nth(0).fill("(Sekin)"); // ✓
  await q("NOTE_COMPLETION").locator('[data-testid="qv-blank"]').nth(0).fill("Soat"); // ✓ (2-variant)
  await q("NOTE_COMPLETION").locator('[data-testid="qv-blank"]').nth(1).fill("quvonch-shodlik"); // 1/2 (ichki chiziqcha)
  await q("TABLE_COMPLETION").locator('[data-testid="qv-blank"]').nth(0).fill("kichik-qadam"); // ✗ (chiziqcha muhim)
  await q("TABLE_COMPLETION").locator('[data-testid="qv-blank"]').nth(1).fill("Har kuni!"); // ✓
  await q("FLOW_CHART_COMPLETION").locator('[data-testid="qv-blank"]').nth(0).fill("maqsad"); // 1/2 (2-bo'sh)
  await q("DIAGRAM_LABEL_COMPLETION").locator('[data-testid="qv-blank"]').nth(0).fill("suv");
  await q("DIAGRAM_LABEL_COMPLETION").locator('[data-testid="qv-blank"]').nth(1).fill("quyosh"); // 2/2
  const quizResp = page.waitForResponse((r) => r.url().endsWith(`/reader/articles/${ART}/quiz`) && r.request().method() === "POST", { timeout: 30000 });
  await page.click('[data-testid="quiz-submit"]');
  await confirmDialog(page);
  const server = await (await quizResp).json();
  await page.waitForSelector('[data-testid="quiz-score"]', { timeout: 30000 });
  const expected = 1 + 0 + 0 + 1 + 2 + 0 + 1 + 2 + 2 + 1 + 1 + 1 + 1 + 2; // 15
  const scoreText = ((await page.textContent('[data-testid="quiz-score"]')) ?? "").replace(/\s+/g, " ");
  check(`Server: ${expected} / 23; UI shu ballni ko'rsatadi`, server.score === expected && server.total === 23 && scoreText.includes(`${server.score} / ${server.total}`), `server=${server.score}/${server.total} ui="${scoreText.slice(0, 40)}"`);
  // Har savol: UI'dagi ✓ elementlar soni == server score (frontend normalizatsiyasi backend bilan bir xil)
  const ui = await page.evaluate(() => [...document.querySelectorAll('[data-testid="quiz-question"]')].map((el) => ({ id: el.dataset.qid, verdict: el.dataset.result, ok: el.querySelectorAll(".qv-blank.correct, .qv-match-row.correct").length, unk: el.querySelectorAll(".qv-blank.unknown").length, mech: el.querySelector(".qv-blank, .qv-match-row") ? "parts" : "single", chosenWrong: el.querySelectorAll(".qv-opt.wrong, .qv-enum-btn.wrong").length, chosenOk: el.querySelectorAll(".qv-opt.correct, .qv-enum-btn.correct").length })));
  const mism = [];
  for (const r of server.results) {
    const u = ui.find((x) => x.id === r.question_id);
    const v = r.is_correct ? "correct" : r.score > 0 ? "partial" : "wrong";
    // ✓ lar soni ≤ ball ≤ ✓ + aniq emas (backend faqat 1-variantni qaytaradi); tanlov/enum — to'g'ri bo'lsa yashil, xato bo'lsa qizil
    const partsOk = u?.mech !== "parts" || (u.ok <= r.score && r.score <= u.ok + u.unk);
    const singleOk = u?.mech !== "single" || (r.is_correct ? u.chosenOk > 0 && u.chosenWrong === 0 : u.chosenWrong > 0 || u.chosenOk === 0);
    if (!u || u.verdict !== v || !partsOk || !singleOk) mism.push(`${r.type}: server ${r.score}/${r.max_score}, UI ${u?.verdict} ✓${u?.ok} ?${u?.unk} ok${u?.chosenOk}/bad${u?.chosenWrong}`);
  }
  check("Har savol: UI hukmi va ✓ belgilar server natijasiga mos (14/14)", mism.length === 0, mism.join("; "));
  const note = ui.find((x) => x.id === server.results.find((r) => r.type === "NOTE_COMPLETION").question_id);
  check("NOTE: 'Soat' (2-variant) + xato, ball 1 — qaysi to'g'riligi aniq emas → 2 ta neytral belgi", note.ok === 0 && note.unk === 2, JSON.stringify(note));
  check("Yashirin rejim: to'g'ri javoblar ko'rinmaydi, eslatma bor", (await page.locator('[data-testid="qv-fix"]').count()) === 0 && (await page.locator('[data-testid="quiz-hidden-note"]').count()) === 1);
  check("TFNG xato → 'Matnda ko'rsatish · 2-bet'", ((await q("TRUE_FALSE_NOT_GIVEN").locator('[data-testid="qv-show-page"]').textContent()) ?? "").includes("2-bet"));
  await q("TRUE_FALSE_NOT_GIVEN").locator('[data-testid="qv-show-page"]').click();
  await page.waitForFunction(() => document.querySelector('input[aria-label="Sahifa"]')?.value === "2", null, { timeout: 15000 });
  check("PDF 2-betga o'tdi", true);
  await page.screenshot({ path: OUT + "99-prod-ielts-result.png" });

  // Ko'rsatish → to'g'ri javoblar; tuzatib qayta tekshirish → 100%
  await page.click('[data-testid="quiz-reveal"]');
  check("Ko'rsatildi: to'g'ri javoblar va izoh (sahifa belgisisiz)", (await page.locator('[data-testid="qv-fix"]').count()) > 0 && ((await q("TRUE_FALSE_NOT_GIVEN").locator('[data-testid="quiz-explanation"]').textContent()) ?? "").trim() === "Natija sekin, lekin barqaror.");
  await page.click('[data-testid="quiz-retry"]');
  await q("MULTIPLE_CHOICE", 0).locator('[data-testid="qv-option"]').nth(1).click();
  await q("MULTIPLE_CHOICE", 1).locator('[data-testid="qv-option"]').nth(0).click();
  await q("MULTIPLE_CHOICE", 1).locator('[data-testid="qv-option"]').nth(2).click();
  await q("TRUE_FALSE_NOT_GIVEN").locator('[data-testid="qv-enum"]', { hasText: "FALSE" }).click();
  await q("YES_NO_NOT_GIVEN").locator('[data-testid="qv-enum"]', { hasText: /^NO$/ }).click();
  for (const [t, v] of [["MATCHING_INFORMATION", ["A", "A"]], ["MATCHING_HEADINGS", ["i", "ii"]], ["MATCHING_FEATURES", ["A", "B"]], ["MATCHING_SENTENCE_ENDINGS", ["A", "B"]]])
    for (const [i, k] of v.entries()) await q(t).locator('[data-testid="qv-match-select"]').nth(i).selectOption(k);
  for (const [t, v] of [["SENTENCE_COMPLETION", ["66", "o'z-o'zini nazorat"]], ["SUMMARY_COMPLETION", ["sekin"]], ["NOTE_COMPLETION", ["vaqt", "quvonch"]], ["TABLE_COMPLETION", ["kichik qadam", "har kuni"]], ["FLOW_CHART_COMPLETION", ["maqsad", "reja"]], ["DIAGRAM_LABEL_COMPLETION", ["suv", "quyosh"]]])
    for (const [i, x] of v.entries()) await q(t).locator('[data-testid="qv-blank"]').nth(i).fill(x);
  // "66" — qabul qilingan variant emas (faqat "oltmish olti") → 22 / 23
  await page.click('[data-testid="quiz-submit"]');
  await page.waitForSelector('[data-testid="quiz-score"]', { timeout: 30000 });
  const s2 = ((await page.textContent('[data-testid="quiz-score"]')) ?? "").replace(/\s+/g, " ");
  check("Qayta: 22 / 23 ('66' variant emas), 2-urinish, eng yaxshi — birinchi (ko'rsatilgandan keyingi hisobga olinmaydi)", s2.includes("22 / 23") && s2.includes("2-urinish") && s2.includes(`eng yaxshi: ${expected} / 23`), s2);
  check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
} finally {
  await cleanup();
  await browser.close();
}
console.log(failures ? `\n❌ ${failures} ta tekshiruv muvaffaqiyatsiz` : "\n✅ Hammasi o'tdi");
process.exit(failures ? 1 : 0);
