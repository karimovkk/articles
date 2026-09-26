/**
 * Lug'at (33 → 38): backend `/me/vocabulary` (BACKEND_TASKS.md 1-qism, 2026-09-26 dan jonli):
 *   GET/POST /me/vocabulary, GET /me/vocabulary/stats, GET/PATCH/DELETE /me/vocabulary/{id},
 *   GET /articles/{id}/vocabulary (reader — shu maqola so'zlari).
 * Dublikat (normalize qilingan so'z) → 409 VOCAB_DUPLICATE, `details.entry_id` — mavjud yozuv yangilanadi.
 * Ilgari so'zlar `NOTE` annotatsiya (`label: "vocab"`) sifatida saqlanardi — backend ularni yangi jadvalga ko'chirgan;
 * `isVocab` ular eslatmalar ro'yxatiga tushib qolmasligi uchun qoldirildi.
 */
import { api, isApiError } from "./client";
import type { Annotation, Paginated } from "./types";
import type { HighlightRect } from "@/lib/reader/highlights";

export const VOCAB_LABEL = "vocab";
/** Lug'at o'zgarganda (qo'shish/tahrirlash/o'chirish) — sidebar hisoblagichi va ochiq sahifalar yangilanadi */
export const VOCAB_EVENT = "a365:vocab-changed";

export interface VocabEntry {
  id: string;
  articleId: string;
  bookId: string | null;
  bookTitle: string | null;
  articleTitle: string | null;
  word: string;
  translation: string | null;
  /** So'z uchragan qator/gap (PDF matn qatlamidan) */
  context: string | null;
  page: number | null;
  rects: HighlightRect[];
  learned: boolean;
  learnedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VocabInput {
  word: string;
  translation?: string | null;
  context?: string | null;
  page?: number | null;
  rects?: HighlightRect[];
}

/** So'z uzunligi chegarasi (iboralar ham bo'lishi mumkin) */
export const VOCAB_WORD_MAX = 120;
export const VOCAB_TRANSLATION_MAX = 500;

/** Annotatsiya — lug'at so'zimi? (reader "Eslatmalar" ro'yxatidan chiqarib tashlash uchun ham) */
export function isVocab(a: Pick<Annotation, "type" | "label">): boolean {
  return a.type === "NOTE" && a.label === VOCAB_LABEL;
}

/** Backend javobi (VocabEntryResponse) */
interface VocabEntryResponse {
  id: string;
  word: string;
  translation: string | null;
  context: string | null;
  page: number | null;
  rects: unknown[] | null;
  learned: boolean;
  learned_at: string | null;
  article_id: string | null;
  article_title: string | null;
  book_id: string | null;
  book_title: string | null;
  created_at: string;
  updated_at: string;
}

function toEntry(r: VocabEntryResponse): VocabEntry {
  const rects = Array.isArray(r.rects) ? (r.rects.filter((x) => Array.isArray(x) && x.length === 4 && x.every((n) => typeof n === "number")) as HighlightRect[]) : [];
  return {
    id: r.id,
    articleId: r.article_id ?? "",
    bookId: r.book_id,
    bookTitle: r.book_title,
    articleTitle: r.article_title,
    word: r.word,
    translation: r.translation,
    context: r.context,
    page: r.page,
    rects,
    learned: r.learned,
    learnedAt: r.learned_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** So'zlarni solishtirish: katta-kichik harf, chetdagi tinish belgilari va ortiqcha bo'shliqlarsiz */
export function normalizeWord(w: string): string {
  return w
    .toLocaleLowerCase()
    .replace(/[‘’ʻʼ`]/g, "'")
    .replace(/^[\s"'«»“”.,;:!?()[\]{}—–-]+|[\s"'«»“”.,;:!?()[\]{}—–-]+$/g, "")
    .replace(/\s+/g, " ");
}

/* ---------------- Kesh ---------------- */

let cache: { user: string; at: number; items: VocabEntry[] } | null = null;
const CACHE_TTL = 60 * 1000;

/** Chiqishda (boshqa foydalanuvchi) — kesh tozalanadi */
export function clearVocabCache() {
  cache = null;
}

function changed() {
  cache = null;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(VOCAB_EVENT));
}

const clip = (v: string | null | undefined, max: number) => v?.trim().slice(0, max) || null;

export const vocabularyApi = {
  /** Reader: shu maqoladagi so'zlar */
  async listForArticle(articleId: string): Promise<VocabEntry[]> {
    const list = await api<VocabEntryResponse[]>(`/articles/${articleId}/vocabulary`);
    return list.map(toEntry);
  },

  /** Barcha so'zlar (yangilari birinchi) — lug'at sahifasi filtr/saralashni o'zi qiladi. `force` — keshsiz. */
  async listAll(userId: string, opts: { force?: boolean } = {}): Promise<VocabEntry[]> {
    if (!opts.force && cache && cache.user === userId && Date.now() - cache.at < CACHE_TTL) return cache.items;
    const items: VocabEntry[] = [];
    for (let page = 1; page <= 100; page++) {
      const r = await api<Paginated<VocabEntryResponse>>("/me/vocabulary", { query: { page, page_size: 100, sort: "newest" } });
      items.push(...r.items.map(toEntry));
      if (page >= r.pages || !r.items.length) break;
    }
    cache = { user: userId, at: Date.now(), items };
    return items;
  },

  /** Yangi so'z. Shu so'z (boshqa maqolada ham) allaqachon bo'lsa — mavjud yozuvning tarjimasi/konteksti yangilanadi. */
  async add(articleId: string, input: VocabInput): Promise<VocabEntry> {
    const body = {
      article_id: articleId,
      word: input.word.trim().slice(0, VOCAB_WORD_MAX),
      translation: clip(input.translation, VOCAB_TRANSLATION_MAX),
      context: clip(input.context, 1000),
      page: input.page ?? null,
      rects: input.rects?.length ? input.rects : null,
    };
    try {
      const r = await api<VocabEntryResponse>("/me/vocabulary", { method: "POST", body });
      changed();
      return toEntry(r);
    } catch (e) {
      const id = isApiError(e) && e.code === "VOCAB_DUPLICATE" ? (e.details as { entry_id?: unknown } | null)?.entry_id : null;
      if (typeof id !== "string") throw e;
      const patch: Record<string, string> = {};
      if (body.translation) patch.translation = body.translation;
      if (body.context) patch.context = body.context;
      const r = await api<VocabEntryResponse>(`/me/vocabulary/${id}`, { method: "PATCH", body: patch });
      changed();
      return toEntry(r);
    }
  },

  async update(e: Pick<VocabEntry, "id">, patch: Partial<Pick<VocabEntry, "word" | "translation" | "context" | "learned">>): Promise<VocabEntry> {
    const body: Record<string, unknown> = {};
    if (patch.word !== undefined) body.word = patch.word.trim().slice(0, VOCAB_WORD_MAX);
    if (patch.translation !== undefined) body.translation = clip(patch.translation, VOCAB_TRANSLATION_MAX);
    if (patch.context !== undefined) body.context = clip(patch.context, 1000);
    if (patch.learned !== undefined) body.learned = patch.learned;
    const r = await api<VocabEntryResponse>(`/me/vocabulary/${e.id}`, { method: "PATCH", body });
    changed();
    return toEntry(r);
  },

  async remove(e: Pick<VocabEntry, "id">): Promise<void> {
    await api(`/me/vocabulary/${e.id}`, { method: "DELETE" });
    changed();
  },
};
