/**
 * 87: IELTS Reading savollari — reader va admin uchun umumiy qoidalar (ko'rinish, to'liqlik, admin tekshiruvi).
 *
 * Bo'sh joy belgisi — matnda `___` (3 va undan ko'p pastki chiziq). Ko'rinish uchun (backend `text` ni erkin satr
 * sifatida saqlaydi) frontend konventsiyasi:
 *   TABLE_COMPLETION      — har satr jadval qatori, ustunlar `|` bilan; 1-satr — sarlavha;
 *   FLOW_CHART_COMPLETION — har satr bitta qadam (orasida strelka);
 *   NOTE / DIAGRAM_LABEL  — har satr alohida qator ("- " bilan boshlansa — ro'yxat nuqtasi);
 *   SENTENCE / SUMMARY    — oddiy matn (satrlar saqlanadi).
 *   88: rasm — matnning 1-satri `![izoh](https://…)` (DIAGRAM_LABEL_COMPLETION; backendda rasm maydoni yo'q);
 *   88: javob sahifasi — izoh oxirida `[p. 12]` (o'quvchida "Matnda ko'rsatish"; boshqa mijozlarda o'qiladigan matn).
 */
import { mechanicOf, type AdminQuestion, type MatchingOption, type QuestionAnswer, type QuestionData, type QuestionInput, type QuestionResponse, type QuestionType, type QuizQuestion } from "@/lib/api/quiz";

export const BLANK_RE = /_{3,}/g;
/** Bo'sh joylar soni (rasm havolasidagi `___` hisobga olinmaydi) */
export const countBlanks = (text: string) => (splitImage(text).rest.match(BLANK_RE) ?? []).length;

// ---- 88.2: rasm (diagramma) — matnning birinchi satri `![izoh](https://…)`
const IMG_LINE_RE = /^\s*!\[([^\]\n]*)\]\(([^)\s]*)\)\s*$/;
export const HTTPS_URL_RE = /^https:\/\/[^\s"'<>]+$/;
/** Matn → rasm (faqat https) + qolgan matn. `raw` — havola (https bo'lmasa ham; admin tekshiruvi uchun) */
export function splitImage(text: string): { image: { alt: string; src: string } | null; raw: string | null; rest: string } {
  const nl = text.indexOf("\n");
  const first = nl < 0 ? text : text.slice(0, nl);
  const m = IMG_LINE_RE.exec(first);
  if (!m) return { image: null, raw: null, rest: text };
  const rest = nl < 0 ? "" : text.slice(nl + 1);
  return { image: HTTPS_URL_RE.test(m[2]) ? { alt: m[1], src: m[2] } : null, raw: m[2], rest };
}
export const withImage = (src: string, rest: string) => (src.trim() ? `![diagram](${src.trim()})\n${rest}` : rest);

// ---- 88.4: javob sahifasi — izoh oxirida `[p. 12]`
const PAGE_RE = /\s*\[(?:p|bet|стр)\.?\s*(\d{1,4})\]\s*$/i;
export function splitPage(explanation: string | null | undefined): { text: string; page: number | null } {
  const s = explanation ?? "";
  const m = PAGE_RE.exec(s);
  return m ? { text: s.slice(0, m.index).trim(), page: Number(m[1]) || null } : { text: s.trim(), page: null };
}
export const withPage = (text: string, page: number | null) => [text.trim(), page ? `[p. ${page}]` : ""].filter(Boolean).join(" ") || null;

// ---- 88.1: nechta javob tanlanadi — `data.choose`; server uni saqlamasa — savol matnidan
const NUM: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, ikki: 2, uch: 3, tort: 4, besh: 5, два: 2, две: 2, три: 3, четыре: 4, пять: 5 };
const numOf = (w: string) => Number(w) || NUM[w.toLowerCase().replace(/['ʻ’`‘]/g, "")] || 0;
const COUNT_RES = [
  /(?<!\p{L})(?:choose|select|pick|which|name|identify)\s+(two|three|four|five|[2-5])(?!\p{L})/iu, // Choose TWO letters / Which THREE
  /(?<!\p{L})(TWO|THREE|FOUR|FIVE)(?!\p{L})/u, // IELTS: son katta harf bilan
  /(?<!\p{L})qaysi\s+(ikki|uch|to['ʻ’`‘]?rt|besh|[2-5])\s*ta/iu, // Qaysi ikkitasi…
  /(?<!\p{L})(ikki|uch|to['ʻ’`‘]?rt|besh|[2-5])\s*ta(?:si|sini|ni)?\s+(?:javob|variant|tanlang|belgilang)/iu, // 2 ta javobni tanlang
  /(?:выберите|выбери|укажите|отметьте|какие)\s+(два|две|три|четыре|пять|[2-5])(?!\p{L})/iu,
];
export function promptChooseCount(prompt: string): number | null {
  for (const re of COUNT_RES) {
    const m = re.exec(prompt);
    const n = m ? numOf(m[1]) : 0;
    if (n >= 2) return n;
  }
  return null;
}
/** O'quvchi nechta variant tanlaydi: `data.choose` → savol matni → 1 */
export function chooseCount(q: { prompt: string; data: QuestionData }): number {
  const total = choiceOptions(q.data).length;
  const d = Number((q.data as { choose?: number }).choose);
  if (Number.isInteger(d) && d >= 1 && d <= total) return d;
  const p = promptChooseCount(q.prompt);
  return p && p < total ? p : 1;
}
/** Matn → [matn, BO'SH, matn, BO'SH, …] (bo'sh joy — `null`) */
export function splitBlanks(text: string): Array<string | null> {
  const out: Array<string | null> = [];
  let last = 0;
  for (const m of text.matchAll(BLANK_RE)) {
    out.push(text.slice(last, m.index));
    out.push(null);
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}
export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Matching kalitlari: sarlavhalar — i, ii, iii…; qolganlari — A, B, C… */
const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx"];
export function optionKey(type: QuestionType, i: number): string {
  if (type === "MATCHING_HEADINGS") return ROMAN[i] ?? String(i + 1);
  return i < 26 ? String.fromCharCode(65 + i) : String(i + 1);
}

/** IELTS: sarlavha va gap tugatmasi — har biri faqat bir marta (ma'lumot/xususiyat harflari takrorlanishi mumkin) */
export const uniqueOptions = (type: QuestionType) => type === "MATCHING_HEADINGS" || type === "MATCHING_SENTENCE_ENDINGS";

export const MAX_CHOICE_OPTIONS = 8;
export const MAX_MATCH_ITEMS = 15;
export const MAX_MATCH_OPTIONS = 20;
export const MAX_BLANKS = 20;

/** Admin: tanlangan tur uchun bo'sh qoralama */
export function emptyDraft(type: QuestionType): { data: QuestionData; answer: QuestionAnswer } {
  switch (mechanicOf(type)) {
    case "choice":
      return { data: { options: ["", "", "", ""] }, answer: { correct: [] } };
    case "enum":
      return { data: {}, answer: { value: "" } };
    case "matching":
      return { data: { items: ["", ""], options: [0, 1, 2].map((i) => ({ key: optionKey(type, i), text: "" })) }, answer: { map: {} } };
    case "text": {
      const text =
        type === "TABLE_COMPLETION"
          ? "Bosqich | Tavsif\n1 | ___\n2 | ___"
          : type === "FLOW_CHART_COMPLETION"
            ? "1-qadam: ___\n2-qadam: ___"
            : type === "NOTE_COMPLETION"
              ? "Mavzu\n- ___\n- ___"
              : "___";
      const n = countBlanks(text);
      return { data: { text, blanks: n, word_limit: 2 }, answer: { blanks: Array.from({ length: n }, () => [""]) } };
    }
  }
}

/** Javob to'liqmi: har element/bo'sh joy to'ldirilganmi (bo'sh qolganlar soni) */
export function missingParts(q: QuizQuestion, r: QuestionResponse | undefined): number {
  const m = mechanicOf(q.type);
  if (m === "choice") return r?.selected?.length ? 0 : 1;
  if (m === "enum") return r?.value ? 0 : 1;
  if (m === "matching") return (q.data.items ?? []).filter((_, i) => !r?.map?.[String(i)]).length;
  const n = Number(q.data.blanks) || 0;
  return Array.from({ length: n }, (_, i) => r?.blanks?.[i] ?? "").filter((v) => !v.trim()).length;
}

/** Bo'sh javob ham yuboriladi (IELTS'da bo'sh = 0 ball) — server shakli turga mos */
export function responseFor(q: QuizQuestion, r: QuestionResponse | undefined): QuestionResponse {
  const m = mechanicOf(q.type);
  if (m === "choice") return { selected: r?.selected ?? [] };
  if (m === "enum") return { value: r?.value ?? "" };
  if (m === "matching") return { map: r?.map ?? {} };
  const n = Number(q.data.blanks) || 0;
  return { blanks: Array.from({ length: n }, (_, i) => (r?.blanks?.[i] ?? "").trim()) };
}

export const enumValues = (type: QuestionType) => (type === "YES_NO_NOT_GIVEN" ? ["YES", "NO", "NOT_GIVEN"] : ["TRUE", "FALSE", "NOT_GIVEN"]);
export const matchingOptions = (data: QuestionData): MatchingOption[] =>
  (Array.isArray(data.options) ? data.options : []).filter((o): o is MatchingOption => !!o && typeof o === "object" && "key" in o);
export const choiceOptions = (data: QuestionData): string[] => (Array.isArray(data.options) ? data.options : []).map((o) => (typeof o === "string" ? o : (o?.text ?? "")));

/** Admin: saqlashdan oldin tekshiruv — xato kaliti (i18n) yoki null; `input` — yuboriladigan tozalangan shakl */
export function validateDraft(type: QuestionType, prompt: string, data: QuestionData, answer: QuestionAnswer): { error: string | null; input: Omit<QuestionInput, "explanation" | "order_index"> } {
  const base = { type, prompt: prompt.trim() };
  if (!base.prompt) return { error: "ielts.err.prompt", input: { ...base, data, answer } };
  switch (mechanicOf(type)) {
    case "choice": {
      const options = choiceOptions(data).map((o) => o.trim());
      if (options.length < 2 || options.some((o) => !o)) return { error: "ielts.err.options", input: { ...base, data, answer } };
      const correct = [...new Set(answer.correct ?? [])].filter((i) => i >= 0 && i < options.length).sort((a, b) => a - b);
      if (!correct.length) return { error: "ielts.err.correct", input: { ...base, data, answer } };
      // Savol matnidagi son ("Choose TWO") to'g'ri javoblar soniga mos bo'lsin — aks holda o'quvchi to'liq ball ololmaydi
      const said = promptChooseCount(base.prompt);
      if (said && said !== correct.length) return { error: "ielts.err.chooseMismatch", input: { ...base, data, answer } };
      // Ko'p javobli: o'quvchi nechta tanlashini bilishi uchun `choose` (o'quvchi `answer` ni ko'rmaydi — backend kontraktida yo'q)
      const out: QuestionData & { choose?: number } = { options };
      if (correct.length > 1) out.choose = correct.length;
      return { error: null, input: { ...base, data: out, answer: { correct } } };
    }
    case "enum": {
      if (!enumValues(type).includes(answer.value ?? "")) return { error: "ielts.err.value", input: { ...base, data: {}, answer } };
      return { error: null, input: { ...base, data: {}, answer: { value: answer.value } } };
    }
    case "matching": {
      const items = (data.items ?? []).map((s) => s.trim());
      const options = matchingOptions(data).map((o) => ({ key: o.key.trim(), text: o.text.trim() }));
      if (!items.length || items.some((s) => !s)) return { error: "ielts.err.items", input: { ...base, data, answer } };
      if (!options.length || options.some((o) => !o.key || !o.text)) return { error: "ielts.err.mOptions", input: { ...base, data, answer } };
      if (new Set(options.map((o) => o.key)).size !== options.length) return { error: "ielts.err.keys", input: { ...base, data, answer } };
      const keys = new Set(options.map((o) => o.key));
      const map: Record<string, string> = {};
      for (let i = 0; i < items.length; i++) {
        const v = answer.map?.[String(i)];
        if (!v || !keys.has(v)) return { error: "ielts.err.map", input: { ...base, data, answer } };
        map[String(i)] = v;
      }
      if (uniqueOptions(type) && new Set(Object.values(map)).size !== items.length) return { error: "ielts.err.unique", input: { ...base, data, answer } };
      return { error: null, input: { ...base, data: { items, options }, answer: { map } } };
    }
    case "text": {
      const text = (data.text ?? "").replace(/\r\n/g, "\n");
      const img = splitImage(text);
      if (img.raw !== null && !img.image) return { error: "ielts.err.image", input: { ...base, data, answer } };
      const n = text.trim() ? countBlanks(text) : Number(data.blanks) || 0;
      if (n < 1) return { error: "ielts.err.blanks", input: { ...base, data, answer } };
      const blanks = Array.from({ length: n }, (_, i) => (answer.blanks?.[i] ?? []).map((v) => v.trim()).filter(Boolean));
      if (blanks.some((v) => !v.length)) return { error: "ielts.err.accepted", input: { ...base, data, answer } };
      const wl = Number(data.word_limit);
      if (data.word_limit != null && String(data.word_limit) !== "" && wl > 0) {
        // Qabul qilinadigan javob so'z chegarasidan oshmasin (aks holda o'quvchi to'g'ri javob yoza olmaydi)
        if (blanks.some((vs) => vs.some((v) => wordCount(v) > wl))) return { error: "ielts.err.wordLimit", input: { ...base, data, answer } };
      }
      const out: QuestionData = { blanks: n };
      if (text.trim()) out.text = text;
      if (wl > 0) out.word_limit = wl;
      return { error: null, input: { ...base, data: out, answer: { blanks } } };
    }
  }
}

/** Admin ro'yxati uchun — javobning qisqa ko'rinishi */
export function answerSummary(q: AdminQuestion): string {
  switch (mechanicOf(q.type)) {
    case "choice": {
      const opts = choiceOptions(q.data);
      return (q.answer.correct ?? []).map((i) => `${String.fromCharCode(65 + i)}. ${opts[i] ?? ""}`).join(" · ");
    }
    case "enum":
      return (q.answer.value ?? "").replace("_", " ");
    case "matching":
      return Object.entries(q.answer.map ?? {})
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([i, k]) => `${Number(i) + 1} → ${k}`)
        .join(", ");
    case "text":
      return (q.answer.blanks ?? []).map((vs, i) => `(${i + 1}) ${vs.join(" / ")}`).join("  ");
  }
}
