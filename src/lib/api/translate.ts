/**
 * 41: avtomatik tarjima — `POST /translate` (backend Google Cloud Translation orqali; kalit faqat serverda).
 * Yordamchi funksiya: har qanday xatoda `null` qaytadi — so'zni lug'atga qo'shish baribir ishlaydi.
 * `503 TRANSLATE_UNAVAILABLE` / `TRANSLATE_QUOTA_EXCEEDED` → shu sessiyada qayta so'ralmaydi.
 */
import { api, isApiError } from "./client";

export type TranslateLang = "uz" | "ru" | "en";

interface TranslateResponse {
  text: string;
  translation: string | null;
  detected_source_lang: string | null;
  target_lang: string;
  same_language: boolean;
  provider: string;
  cached: boolean;
}

export const TRANSLATE_TEXT_MAX = 200;

let disabled = false;

export const translateApi = {
  /** Avtomatik tarjima shu sessiyada mavjudmi (backend o'chiq/byudjet tugagan bo'lsa — yo'q) */
  enabled(): boolean {
    return !disabled;
  },

  /** Tarjima yoki `null` (bir xil til, xato, o'chiq) */
  async translate(text: string, target: TranslateLang): Promise<string | null> {
    const q = text.trim().slice(0, TRANSLATE_TEXT_MAX);
    if (disabled || !q) return null;
    try {
      const r = await api<TranslateResponse>("/translate", { method: "POST", body: { text: q, source_lang: "auto", target_lang: target } });
      return r.same_language ? null : r.translation?.trim() || null;
    } catch (e) {
      if (isApiError(e) && (e.code === "TRANSLATE_UNAVAILABLE" || e.code === "TRANSLATE_QUOTA_EXCEEDED" || e.status === 404)) disabled = true;
      return null;
    }
  },
};
