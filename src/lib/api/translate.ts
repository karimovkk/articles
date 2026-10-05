/**
 * 41: avtomatik tarjima — `POST /translate` (backend Google Cloud Translation orqali; kalit faqat serverda).
 * Yordamchi funksiya: har qanday xatoda `null` qaytadi — so'zni lug'atga qo'shish baribir ishlaydi.
 * `503 TRANSLATE_UNAVAILABLE` / `TRANSLATE_QUOTA_EXCEEDED` → shu sessiyada qayta so'ralmaydi.
 * Provayder biror tilni qo'llamasa (hozirgi self-hosted LibreTranslate — `uz` yo'q, faqat ru/en): shu til uchun ketma-ket
 * `502 TRANSLATE_FAILED` → o'sha til shu sessiyada o'chiriladi (bir martalik uzilish uchun 2 ta urinish qoldiriladi).
 * Tarjima tilini o'quvchi o'zi tanlaydi (47 — sayt tili emas). O'zbekcha tanlanib, o'zbekcha tarjima bo'lmasa —
 * **ruscha** beriladi (mahsulot qarori: ko'radi va xohlasa o'zi o'zbekchasini yozadi). Backend uz'ni qo'llasa
 * (Google kaliti) — o'zbekcha o'z-o'zidan qaytadi.
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

/** Tanlangan til → qaysi tillarda so'raladi (tartib bo'yicha) */
const FALLBACK: Record<TranslateLang, TranslateLang[]> = { uz: ["uz", "ru"], ru: ["ru"], en: ["en"] };

export interface AutoTranslation {
  text: string;
  /** Qaysi tilga tarjima qilindi (uz interfeysda `ru` bo'lishi mumkin) */
  lang: TranslateLang;
}

/** `undefined` — so'rov muvaffaqiyatsiz (keyingi tilga o'tish mumkin); `null` — bir xil til (tarjima kerak emas) */
type Attempt = string | null | undefined;

let disabled = false;
/** Til → ketma-ket 502 soni; `LANG_FAIL_LIMIT` ga yetsa o'sha tilga so'ralmaydi */
const langFails = new Map<TranslateLang, number>();
const LANG_FAIL_LIMIT = 2;

export const translateApi = {
  /** Avtomatik tarjima shu sessiyada (shu tilga) mavjudmi — backend o'chiq / til qo'llanmasa yo'q */
  enabled(target?: TranslateLang): boolean {
    return !disabled && (!target || (langFails.get(target) ?? 0) < LANG_FAIL_LIMIT);
  },

  /** Tanlangan tilga avtomatik tarjima mavjudmi (uz — uz yoki zaxira ru) */
  availableFor(target: TranslateLang): boolean {
    return FALLBACK[target].some((l) => translateApi.enabled(l));
  },

  /** Tanlangan tilga tarjima (uz bo'lmasa — ruscha) yoki `null` (bir xil til, xato, o'chiq) */
  async translate(text: string, target: TranslateLang): Promise<AutoTranslation | null> {
    const q = text.trim().slice(0, TRANSLATE_TEXT_MAX);
    if (!q) return null;
    for (const lang of FALLBACK[target]) {
      if (!translateApi.enabled(lang)) continue;
      const r = await attempt(q, lang);
      if (r === null) return null; // so'z allaqachon shu tilda — boshqa tilga o'girish shart emas
      if (r) return { text: r, lang };
    }
    return null;
  },
};

async function attempt(q: string, target: TranslateLang): Promise<Attempt> {
  try {
    const r = await api<TranslateResponse>("/translate", { method: "POST", body: { text: q, source_lang: "auto", target_lang: target } });
    langFails.delete(target);
    return r.same_language ? null : r.translation?.trim() || undefined;
  } catch (e) {
    if (isApiError(e) && e.code === "TRANSLATE_FAILED") langFails.set(target, (langFails.get(target) ?? 0) + 1);
    if (isApiError(e) && (e.code === "TRANSLATE_UNAVAILABLE" || e.code === "TRANSLATE_QUOTA_EXCEEDED" || e.status === 404)) disabled = true;
    return undefined;
  }
}
