/**
 * 124: o'qish musiqasi — BACKEND_TASKS.md 5-qism. Backend tayyor bo'lgach faqat shu fayl moslashtiriladi.
 * Endpoint hali yo'q bo'lsa (`404 NOT_FOUND`) — `null`: treklar yo'q, reader musiqa tugmasini ko'rsatmaydi.
 */
import { api, apiUpload, apiUrl, isApiError, type UploadOptions } from "./client";

export const MUSIC_MOODS = ["CALM", "FOCUS", "NATURE", "CLASSICAL", "LOFI"] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

export interface MusicTrack {
  id: string;
  title: string;
  mood: MusicMood | string;
  duration_seconds: number | null;
  mime_type: string;
  file_size: number;
  file_version: number;
  updated_at: string;
}
export interface AdminMusicTrack extends MusicTrack {
  is_active: boolean;
  order_index: number;
  created_at: string;
}

/** Endpoint yo'q (backend hali qo'shmagan) — xato emas, "musiqa yo'q" holati */
const missing = (e: unknown) => isApiError(e) && e.status === 404 && (e.code === "NOT_FOUND" || e.code === "HTTP_404");

export const musicApi = {
  /** Faol treklar; backend'da endpoint yo'q bo'lsa — `null` */
  async tracks(): Promise<MusicTrack[] | null> {
    try {
      return await api<MusicTrack[]>("/music/tracks", { auth: false });
    } catch (e) {
      if (missing(e)) return null;
      throw e;
    }
  },
  /** `<audio src>` uchun (tokensiz; `?v=` — fayl almashsa kesh yangilanadi) */
  streamUrl(t: Pick<MusicTrack, "id" | "file_version">): string {
    return apiUrl(`/music/tracks/${t.id}/stream`, { v: t.file_version });
  },
};

export const adminMusicApi = {
  async list(): Promise<AdminMusicTrack[] | null> {
    try {
      return await api<AdminMusicTrack[]>("/admin/music/tracks");
    } catch (e) {
      if (missing(e)) return null;
      throw e;
    }
  },
  upload(file: File, meta: { title?: string; mood?: string; duration_seconds?: number | null }, opts?: UploadOptions) {
    const fd = new FormData();
    fd.append("file", file, file.name);
    if (meta.title) fd.append("title", meta.title);
    if (meta.mood) fd.append("mood", meta.mood);
    if (meta.duration_seconds) fd.append("duration_seconds", String(Math.round(meta.duration_seconds)));
    return apiUpload<AdminMusicTrack>("/admin/music/tracks", fd, opts);
  },
  update(id: string, patch: { title?: string; mood?: string; is_active?: boolean; order_index?: number }) {
    return api<AdminMusicTrack>(`/admin/music/tracks/${id}`, { method: "PATCH", body: patch });
  },
  remove(id: string) {
    return api<{ message: string }>(`/admin/music/tracks/${id}`, { method: "DELETE" });
  },
};
