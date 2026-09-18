/** O'qish ma'lumotlari: progress, annotatsiyalar, kitob ichida qidiruv, mundarija. */
import { api } from "./client";
import type { Annotation, AnnotationType, Paginated, ReadingProgress, SearchHit, SearchResponse, TocEntry } from "./types";

export interface AnnotationInput {
  type: AnnotationType;
  page: number;
  text?: string | null;
  note?: string | null;
  color?: string | null;
  location?: Record<string, unknown> | null;
}

function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const r = raw as { items?: T[]; results?: T[] } | null;
  return r?.items ?? r?.results ?? [];
}

export const readingApi = {
  getProgress(bookId: string): Promise<ReadingProgress | null> {
    return api<ReadingProgress | null>(`/books/${bookId}/progress`);
  },

  saveProgress(bookId: string, p: { current_page: number; total_pages: number; location?: Record<string, unknown> }): Promise<ReadingProgress> {
    const percent = p.total_pages ? Math.round((p.current_page / p.total_pages) * 10000) / 100 : 0;
    return api<ReadingProgress>(`/books/${bookId}/progress`, {
      method: "PUT",
      body: { current_page: p.current_page, total_pages: p.total_pages, percent, location: p.location ?? { page: p.current_page } },
    });
  },

  async listAnnotations(bookId: string, type?: AnnotationType): Promise<Annotation[]> {
    const raw = await api<Paginated<Annotation> | Annotation[]>(`/books/${bookId}/annotations`, { query: { type, page_size: 100 } });
    return asList<Annotation>(raw);
  },

  createAnnotation(bookId: string, input: AnnotationInput): Promise<Annotation> {
    return api<Annotation>(`/books/${bookId}/annotations`, { method: "POST", body: input });
  },

  updateAnnotation(bookId: string, id: string, patch: Partial<AnnotationInput>): Promise<Annotation> {
    return api<Annotation>(`/books/${bookId}/annotations/${id}`, { method: "PATCH", body: patch });
  },

  deleteAnnotation(bookId: string, id: string): Promise<void> {
    return api<void>(`/books/${bookId}/annotations/${id}`, { method: "DELETE" });
  },

  async search(bookId: string, q: string): Promise<{ textAvailable: boolean; hits: SearchHit[] }> {
    const raw = await api<SearchResponse | SearchHit[]>(`/books/${bookId}/search`, { query: { q } });
    if (Array.isArray(raw)) return { textAvailable: true, hits: raw };
    return { textAvailable: raw.text_available !== false, hits: asList<SearchHit>(raw) };
  },

  async toc(bookId: string): Promise<TocEntry[]> {
    const raw = await api<TocEntry[] | { items?: TocEntry[]; toc?: TocEntry[] }>(`/books/${bookId}/toc`);
    if (Array.isArray(raw)) return raw;
    return raw?.items ?? raw?.toc ?? [];
  },
};
