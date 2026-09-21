/**
 * O'qish ma'lumotlari — maqola bo'yicha (OpenAPI `/articles/{article_id}/...`):
 * progress (PUT + heartbeat + mark-read), annotatsiyalar, qidiruv, mundarija.
 */
import { api } from "./client";
import type { Annotation, AnnotationType, MessageResponse, ReadingProgress, SearchMatch, SearchResponse, TocEntry, TocResponse } from "./types";

export interface AnnotationInput {
  type: AnnotationType;
  page?: number | null;
  /** Belgi joyi (opaque JSON, ≤ 32 KB) — highlight: `{ page, rects }` */
  location_data?: Record<string, unknown> | null;
  selected_text?: string | null;
  note_text?: string | null;
  color?: string | null;
  label?: string | null;
}

export const readingApi = {
  getProgress(articleId: string): Promise<ReadingProgress> {
    return api<ReadingProgress>(`/articles/${articleId}/progress`);
  },

  /**
   * `keepalive` — reader yopilganda (pagehide) yuborilgan so'rov ham serverga yetib boradi.
   * `current_page` 1-based; `percentage` sahifa/jami dan hisoblanadi (B9).
   */
  saveProgress(articleId: string, p: { current_page: number; total_pages: number; location?: Record<string, unknown> }): Promise<ReadingProgress> {
    const percentage = p.total_pages ? Math.round((p.current_page / p.total_pages) * 10000) / 100 : 0;
    return api<ReadingProgress>(`/articles/${articleId}/progress`, {
      method: "PUT",
      keepalive: true,
      body: { current_page: p.current_page, current_location: p.location ?? { page: p.current_page }, percentage },
    });
  },

  /** Faol o'qish vaqti (T1-21): har N soniyada, faqat sahifa ko'rinayotganda. */
  heartbeat(articleId: string, seconds: number, currentPage?: number): Promise<ReadingProgress> {
    return api<ReadingProgress>(`/articles/${articleId}/reading-heartbeat`, {
      method: "POST",
      keepalive: true,
      body: { seconds, current_page: currentPage ?? null },
    });
  },

  markRead(articleId: string, isRead: boolean): Promise<ReadingProgress> {
    return api<ReadingProgress>(`/articles/${articleId}/mark-read`, { method: "POST", query: { is_read: isRead } });
  },

  listAnnotations(articleId: string, type?: AnnotationType): Promise<Annotation[]> {
    return api<Annotation[]>(`/articles/${articleId}/annotations`, { query: { type } });
  },

  createAnnotation(articleId: string, input: AnnotationInput): Promise<Annotation> {
    return api<Annotation>(`/articles/${articleId}/annotations`, { method: "POST", body: input });
  },

  updateAnnotation(articleId: string, id: string, patch: Partial<Omit<AnnotationInput, "type">>): Promise<Annotation> {
    return api<Annotation>(`/articles/${articleId}/annotations/${id}`, { method: "PATCH", body: patch });
  },

  deleteAnnotation(articleId: string, id: string): Promise<MessageResponse> {
    return api<MessageResponse>(`/articles/${articleId}/annotations/${id}`, { method: "DELETE" });
  },

  async search(articleId: string, q: string, limit = 50): Promise<{ textAvailable: boolean; total: number; hits: SearchMatch[] }> {
    const r = await api<SearchResponse>(`/articles/${articleId}/search`, { query: { q, limit } });
    return { textAvailable: r.text_available !== false, total: r.total_matches ?? r.matches?.length ?? 0, hits: r.matches ?? [] };
  },

  async toc(articleId: string): Promise<TocEntry[]> {
    const r = await api<TocResponse>(`/articles/${articleId}/toc`);
    return r.entries ?? [];
  },
};
