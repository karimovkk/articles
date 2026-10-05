/**
 * 44.5: maqola testi (ko'p tanlovli, avtomatik tekshiriladi).
 *   Reader: GET /reader/articles/{id}/questions (to'g'ri javobsiz; tekin kitobda mehmon ham),
 *           POST /reader/articles/{id}/quiz → ball + to'g'ri javoblar va izohlar (faqat yuborilgandan keyin).
 *   Admin:  GET/POST /admin/articles/{id}/questions, PATCH/DELETE …/questions/{qid} (`correct_index` variantlardan
 *           tashqarida → 422). Keyin AI savol yaratsa ham kontrakt o'zgarmaydi.
 */
import { api } from "./client";
import type { MessageResponse } from "./types";

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  order_index: number;
}

export interface QuizAnswerResult {
  question_id: string;
  selected_index: number | null;
  correct_index: number;
  is_correct: boolean;
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
  correct_index: number;
  explanation: string | null;
}

export interface QuestionInput {
  prompt: string;
  options: string[];
  correct_index: number;
  explanation?: string | null;
  order_index?: number;
}

export const QUIZ_MIN_OPTIONS = 2;
export const QUIZ_MAX_OPTIONS = 6;

export const quizApi = {
  questions(articleId: string): Promise<QuizQuestion[]> {
    return api<QuizQuestion[]>(`/reader/articles/${articleId}/questions`);
  },
  submit(articleId: string, answers: Array<{ question_id: string; selected_index: number }>): Promise<QuizResult> {
    return api<QuizResult>(`/reader/articles/${articleId}/quiz`, { method: "POST", body: { answers } });
  },

  // ---- admin
  adminList(articleId: string): Promise<AdminQuestion[]> {
    return api<AdminQuestion[]>(`/admin/articles/${articleId}/questions`);
  },
  adminCreate(articleId: string, input: QuestionInput): Promise<AdminQuestion> {
    return api<AdminQuestion>(`/admin/articles/${articleId}/questions`, { method: "POST", body: input });
  },
  adminUpdate(articleId: string, questionId: string, patch: Partial<QuestionInput>): Promise<AdminQuestion> {
    return api<AdminQuestion>(`/admin/articles/${articleId}/questions/${questionId}`, { method: "PATCH", body: patch });
  },
  adminDelete(articleId: string, questionId: string): Promise<MessageResponse> {
    return api<MessageResponse>(`/admin/articles/${articleId}/questions/${questionId}`, { method: "DELETE" });
  },
};
