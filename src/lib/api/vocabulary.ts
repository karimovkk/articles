/**
 * Lug'at (33). Backend'da alohida lug'at API'si yo'q (OpenAPI 2026-09-25) — so'zlar `NOTE` annotatsiya sifatida
 * saqlanadi, `label: "vocab"`:
 *   selected_text = so'z, note_text = tarjima,
 *   location_data = { kind: "vocab", v: 1, book_id, book_title, article_title, context, rects, learned, learned_at }.
 * Serverda saqlanadi va qurilmalar orasida sinxron.
 *
 * Hamma maqolalar bo'yicha annotatsiyalar endpointi yo'q, shuning uchun `listAll`:
 *  - mahalliy indeks (so'z bor maqolalar id'lari) bo'yicha faqat o'sha maqolalarni so'raydi;
 *  - indeks yo'q yoki eskirgan bo'lsa (yangi qurilma, boshqa qurilmada qo'shilgan so'zlar) — kutubxona → maqolalar →
 *    annotatsiyalar bo'yicha to'liq skanlaydi (parallel, cheklangan) va indeksni yangilaydi.
 * Backend `/me/vocabulary` qo'shsa (B30) — faqat shu fayl almashadi.
 */
import { libraryApi } from "./library";
import { readerApi } from "./reader";
import { readingApi } from "./reading";
import type { Annotation } from "./types";
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
  bookId?: string | null;
  bookTitle?: string | null;
  articleTitle?: string | null;
}

/** So'z uzunligi chegarasi (iboralar ham bo'lishi mumkin) */
export const VOCAB_WORD_MAX = 120;
export const VOCAB_TRANSLATION_MAX = 500;

/** Annotatsiya — lug'at so'zimi? (reader "Eslatmalar" ro'yxatidan chiqarib tashlash uchun ham) */
export function isVocab(a: Pick<Annotation, "type" | "label">): boolean {
  return a.type === "NOTE" && a.label === VOCAB_LABEL;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

export function toVocab(a: Annotation): VocabEntry | null {
  if (!isVocab(a) || !a.selected_text) return null;
  const d = (a.location_data ?? {}) as Record<string, unknown>;
  const rects = Array.isArray(d.rects) ? (d.rects.filter((r) => Array.isArray(r) && r.length === 4 && r.every((n) => typeof n === "number")) as HighlightRect[]) : [];
  return {
    id: a.id,
    articleId: a.article_id,
    bookId: str(d.book_id),
    bookTitle: str(d.book_title),
    articleTitle: str(d.article_title),
    word: a.selected_text,
    translation: str(a.note_text),
    context: str(d.context),
    page: a.page,
    rects,
    learned: d.learned === true,
    learnedAt: str(d.learned_at),
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  };
}

function locationOf(e: Pick<VocabEntry, "bookId" | "bookTitle" | "articleTitle" | "context" | "rects" | "learned" | "learnedAt">) {
  return {
    kind: "vocab",
    v: 1,
    book_id: e.bookId,
    book_title: e.bookTitle,
    article_title: e.articleTitle,
    context: e.context,
    rects: e.rects,
    learned: e.learned,
    learned_at: e.learnedAt,
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

/* ---------------- Mahalliy indeks (so'z bor maqolalar) ---------------- */

const INDEX_KEY = "a365.vocab.index";
/** To'liq skandan keyin shuncha vaqt indeksga ishoniladi (boshqa qurilmada qo'shilganlar keyin topiladi) */
const INDEX_TTL = 12 * 60 * 60 * 1000;

interface VocabIndex {
  user: string;
  scannedAt: number;
  articles: string[];
}

function readIndex(userId: string): VocabIndex | null {
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    const ix = raw ? (JSON.parse(raw) as VocabIndex) : null;
    return ix && ix.user === userId && Array.isArray(ix.articles) ? ix : null;
  } catch {
    return null;
  }
}

function writeIndex(ix: VocabIndex) {
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(ix));
  } catch {
    /* saqlab bo'lmadi — keyingi safar to'liq skan */
  }
}

function touchIndex(userId: string | null, articleId: string) {
  if (!userId) return;
  const ix = readIndex(userId);
  if (!ix) return; // indeks yo'q — keyingi ochilishda baribir to'liq skan bo'ladi
  if (!ix.articles.includes(articleId)) writeIndex({ ...ix, articles: [...ix.articles, articleId] });
}

/** Chiqishda (boshqa foydalanuvchi) — indeks va kesh tozalanadi */
export function clearVocabCache() {
  cache = null;
  try {
    window.localStorage.removeItem(INDEX_KEY);
  } catch {
    /* yo'q */
  }
}

/* ---------------- Kesh ---------------- */

let cache: { user: string; at: number; items: VocabEntry[] } | null = null;
const CACHE_TTL = 60 * 1000;

function changed() {
  cache = null;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(VOCAB_EVENT));
}

/** Cheklangan parallellik bilan bajarish */
async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function listForArticleRaw(articleId: string): Promise<VocabEntry[]> {
  const list = await readingApi.listAnnotations(articleId, "NOTE");
  return list.map(toVocab).filter((x): x is VocabEntry => !!x);
}

/** Kutubxonadagi barcha tayyor maqolalar (to'liq skan uchun) */
async function allArticles(): Promise<Array<{ articleId: string; bookId: string; bookTitle: string; articleTitle: string }>> {
  const books: Array<{ book_id: string; title: string }> = [];
  for (let page = 1; page <= 20; page++) {
    const r = await libraryApi.list({ page, page_size: 100 });
    books.push(...r.items);
    if (page >= r.pages || !r.items.length) break;
  }
  const perBook = await pool(books, 6, async (b) => {
    const arts = await readerApi.articles(b.book_id).catch(() => []);
    return arts.filter((a) => a.processing_status === "READY").map((a) => ({ articleId: a.article_id, bookId: b.book_id, bookTitle: b.title, articleTitle: a.title }));
  });
  return perBook.flat();
}

export const vocabularyApi = {
  listForArticle(articleId: string): Promise<VocabEntry[]> {
    return listForArticleRaw(articleId);
  },

  /**
   * Barcha so'zlar (yangilari birinchi). `force` — indeksga qaramay to'liq skan ("Yangilash" tugmasi).
   * Skandagi kitob/maqola nomlari so'zda saqlanmagan bo'lsa (eski yozuv) — shu yerda to'ldiriladi.
   */
  async listAll(userId: string, opts: { force?: boolean } = {}): Promise<VocabEntry[]> {
    if (!opts.force && cache && cache.user === userId && Date.now() - cache.at < CACHE_TTL) return cache.items;
    const ix = readIndex(userId);
    let items: VocabEntry[];
    if (!opts.force && ix && Date.now() - ix.scannedAt < INDEX_TTL) {
      const lists = await pool(ix.articles, 6, (id) => listForArticleRaw(id).catch(() => [] as VocabEntry[]));
      items = lists.flat();
      // Endi so'zi qolmagan maqolalar indeksdan chiqariladi
      const withWords = new Set(items.map((e) => e.articleId));
      if (withWords.size !== ix.articles.length) writeIndex({ ...ix, articles: ix.articles.filter((a) => withWords.has(a)) });
    } else {
      const arts = await allArticles();
      const lists = await pool(arts, 6, async (a) => {
        const list = await listForArticleRaw(a.articleId).catch(() => [] as VocabEntry[]);
        return list.map((e) => ({ ...e, bookId: e.bookId ?? a.bookId, bookTitle: e.bookTitle ?? a.bookTitle, articleTitle: e.articleTitle ?? a.articleTitle }));
      });
      items = lists.flat();
      writeIndex({ user: userId, scannedAt: Date.now(), articles: Array.from(new Set(items.map((e) => e.articleId))) });
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    cache = { user: userId, at: Date.now(), items };
    return items;
  },

  async add(articleId: string, input: VocabInput, userId: string | null): Promise<VocabEntry> {
    const entry = {
      bookId: input.bookId ?? null,
      bookTitle: input.bookTitle ?? null,
      articleTitle: input.articleTitle ?? null,
      context: input.context?.trim() || null,
      rects: input.rects ?? [],
      learned: false,
      learnedAt: null,
    };
    const a = await readingApi.createAnnotation(articleId, {
      type: "NOTE",
      label: VOCAB_LABEL,
      page: input.page ?? null,
      selected_text: input.word.trim().slice(0, VOCAB_WORD_MAX),
      note_text: input.translation?.trim().slice(0, VOCAB_TRANSLATION_MAX) || null,
      location_data: locationOf(entry),
    });
    touchIndex(userId, articleId);
    changed();
    return toVocab(a)!;
  },

  async update(e: VocabEntry, patch: Partial<Pick<VocabEntry, "word" | "translation" | "context" | "learned">>): Promise<VocabEntry> {
    const next = { ...e, ...patch };
    if (patch.learned !== undefined && patch.learned !== e.learned) next.learnedAt = patch.learned ? new Date().toISOString() : null;
    const a = await readingApi.updateAnnotation(e.articleId, e.id, {
      selected_text: next.word.trim().slice(0, VOCAB_WORD_MAX),
      note_text: next.translation?.trim().slice(0, VOCAB_TRANSLATION_MAX) || null,
      location_data: locationOf(next),
    });
    changed();
    return toVocab(a) ?? next;
  },

  async remove(e: Pick<VocabEntry, "articleId" | "id">): Promise<void> {
    await readingApi.deleteAnnotation(e.articleId, e.id);
    changed();
  },
};
