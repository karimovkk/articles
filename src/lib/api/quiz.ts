/**
 * 44.5 → 87: maqola testi — IELTS Reading uslubidagi 13 savol turi (avtomatik baholanadi).
 *   Savol = `type` + `prompt` + `data` (o'quvchi ko'radi) + `answer` (yashirin; faqat admin). 4 mexanika:
 *     choice   — MULTIPLE_CHOICE                         data {options}            answer {correct:[i]}   response {selected:[i]}
 *     enum     — TRUE_FALSE_NOT_GIVEN, YES_NO_NOT_GIVEN   data {}                   answer {value}         response {value}
 *     matching — MATCHING_* (4)                          data {items, options[{key,text}]}  answer/response {map:{"0":"i"}}
 *     text     — *_COMPLETION (6)                        data {blanks, text?, word_limit?}  answer {blanks:[["a","b"]]}  response {blanks:["a"]}
 *   Matching/completion'da har element/bo'sh joy = 1 ball (`points` — savolning maksimal bali).
 *   Reader: GET /reader/articles/{id}/questions (answer'siz), POST /reader/articles/{id}/quiz {answers:[{question_id,response}]}
 *           → {score,total,percentage,results:[{question_id,type,is_correct,score,max_score,correct_answer,explanation}]}.
 *   Admin:  GET/POST /admin/articles/{id}/questions, PATCH/DELETE …/questions/{qid} (shakl turga mos emas → 422).
 *   Eski format (options + correct_index) — avtomatik MULTIPLE_CHOICE ga o'giriladi (migratsiyadan oldingi javoblar uchun).
 */
import { api } from "./client";
import type { MessageResponse } from "./types";

export const QUESTION_TYPES = [
  "MULTIPLE_CHOICE",
  "TRUE_FALSE_NOT_GIVEN",
  "YES_NO_NOT_GIVEN",
  "MATCHING_INFORMATION",
  "MATCHING_HEADINGS",
  "MATCHING_FEATURES",
  "MATCHING_SENTENCE_ENDINGS",
  "SENTENCE_COMPLETION",
  "SUMMARY_COMPLETION",
  "NOTE_COMPLETION",
  "TABLE_COMPLETION",
  "FLOW_CHART_COMPLETION",
  "DIAGRAM_LABEL_COMPLETION",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type Mechanic = "choice" | "enum" | "matching" | "text";

export function mechanicOf(type: QuestionType): Mechanic {
  if (type === "MULTIPLE_CHOICE") return "choice";
  if (type === "TRUE_FALSE_NOT_GIVEN" || type === "YES_NO_NOT_GIVEN") return "enum";
  if (type.startsWith("MATCHING_")) return "matching";
  return "text";
}

export interface MatchingOption {
  key: string;
  text: string;
}
/** `data` — tur bo'yicha (bo'sh maydonlar ixtiyoriy; o'qishda doim tekshiriladi) */
export interface QuestionData {
  options?: string[] | MatchingOption[];
  items?: string[];
  blanks?: number;
  text?: string;
  word_limit?: number | null;
}
export interface QuestionAnswer {
  correct?: number[];
  value?: string;
  map?: Record<string, string>;
  blanks?: string[][];
}
export interface QuestionResponse {
  selected?: number[];
  value?: string;
  map?: Record<string, string>;
  blanks?: string[];
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  data: QuestionData;
  /** Maksimal ball (matching — elementlar, completion — bo'sh joylar soni) */
  points: number;
  order_index: number;
}

export interface QuizAnswerResult {
  question_id: string;
  type: QuestionType;
  is_correct: boolean;
  score: number;
  max_score: number;
  correct_answer: QuestionAnswer | null;
  explanation: string | null;
}

export interface QuizResult {
  score: number;
  total: number;
  percentage: number;
  results: QuizAnswerResult[];
}

export interface AdminQuestion extends QuizQuestion {
  article_id: string;
  answer: QuestionAnswer;
  explanation: string | null;
}

export interface QuestionInput {
  type: QuestionType;
  prompt: string;
  data: QuestionData;
  answer: QuestionAnswer;
  explanation?: string | null;
  order_index?: number;
}

/** Savolning maksimal bali (server `points` bermasa) */
export function pointsOf(type: QuestionType, data: QuestionData): number {
  const m = mechanicOf(type);
  if (m === "matching") return Math.max(1, data.items?.length ?? 1);
  if (m === "text") return Math.max(1, Number(data.blanks) || 1);
  return 1;
}

type Raw = Record<string, unknown>;
const isType = (v: unknown): v is QuestionType => typeof v === "string" && (QUESTION_TYPES as readonly string[]).includes(v);

/** Server javobi → yagona shakl (eski format ham) */
function normalizeQuestion<T extends QuizQuestion>(raw: Raw): T {
  if (!isType(raw.type) && Array.isArray(raw.options)) {
    // Eski: {prompt, options, correct_index?}
    const data: QuestionData = { options: raw.options as string[] };
    const out: Raw = { ...raw, type: "MULTIPLE_CHOICE", data, points: 1 };
    if (typeof raw.correct_index === "number") out.answer = { correct: [raw.correct_index] };
    return out as unknown as T;
  }
  const type = isType(raw.type) ? raw.type : "MULTIPLE_CHOICE";
  const data = (raw.data && typeof raw.data === "object" ? raw.data : {}) as QuestionData;
  return { ...raw, type, data, points: typeof raw.points === "number" && raw.points > 0 ? raw.points : pointsOf(type, data) } as unknown as T;
}

function normalizeResult(raw: Raw): QuizResult {
  const results = (Array.isArray(raw.results) ? raw.results : []).map((r: Raw) => {
    if (r.correct_answer === undefined && typeof r.correct_index === "number") {
      return { ...r, type: "MULTIPLE_CHOICE", score: r.is_correct ? 1 : 0, max_score: 1, correct_answer: { correct: [r.correct_index] } } as unknown as QuizAnswerResult;
    }
    return { ...r, score: Number(r.score ?? (r.is_correct ? 1 : 0)), max_score: Number(r.max_score ?? 1) } as unknown as QuizAnswerResult;
  });
  return { score: Number(raw.score ?? 0), total: Number(raw.total ?? 0), percentage: Number(raw.percentage ?? 0), results };
}

export const quizApi = {
  async questions(articleId: string): Promise<QuizQuestion[]> {
    const list = await api<Raw[]>(`/reader/articles/${articleId}/questions`);
    return list.map((q) => normalizeQuestion<QuizQuestion>(q));
  },
  async submit(articleId: string, answers: Array<{ question_id: string; response: QuestionResponse }>): Promise<QuizResult> {
    return normalizeResult(await api<Raw>(`/reader/articles/${articleId}/quiz`, { method: "POST", body: { answers } }));
  },

  // ---- admin
  async adminList(articleId: string): Promise<AdminQuestion[]> {
    const list = await api<Raw[]>(`/admin/articles/${articleId}/questions`);
    return list.map((q) => normalizeQuestion<AdminQuestion>(q));
  },
  async adminCreate(articleId: string, input: QuestionInput): Promise<AdminQuestion> {
    return normalizeQuestion<AdminQuestion>(await api<Raw>(`/admin/articles/${articleId}/questions`, { method: "POST", body: input }));
  },
  async adminUpdate(articleId: string, questionId: string, patch: Partial<QuestionInput>): Promise<AdminQuestion> {
    return normalizeQuestion<AdminQuestion>(await api<Raw>(`/admin/articles/${articleId}/questions/${questionId}`, { method: "PATCH", body: patch }));
  },
  adminDelete(articleId: string, questionId: string): Promise<MessageResponse> {
    return api<MessageResponse>(`/admin/articles/${articleId}/questions/${questionId}`, { method: "DELETE" });
  },
};
