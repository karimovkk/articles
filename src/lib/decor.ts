/**
 * 125: sayt bezaklari — admin "Ko'rinish" sahifasida (`PUT /admin/app-settings`, kalit `decor`), hamma public
 * `GET /app-settings` dan o'qiydi (backend o'zgarishsiz — erkin JSON):
 *   season      "off" | "auto" | "winter" | "spring" | "summer" | "autumn" — mavsumiy effekt (qor, barg, gulbarg,
 *               yozda — oltin uchqunlar). "auto" — oyga qarab. Faqat mijoz sahifalarida (reader va admin'da yo'q).
 *   bestseller  "default" | "off" | "<book_id>" — sidebar'dagi faol band yonidagi kichik kitob muqovasi
 *               ("default" — "365" jurnal muqovasi, `public/covers/mag-1-peek@{2x,3x}.webp`: kichik ko'rinish uchun
 *               oldindan lanczos bilan kichraytirilgan — brauzer 300px rasmni 14 marta siqib xiralashtirmaydi).
 *   bestseller_title — kitob nomi (alt/title uchun; admin tanlaganda yoziladi)
 */
export const DECOR_SETTING_KEY = "decor";

export const SEASONS = ["winter", "spring", "summer", "autumn"] as const;
export type Season = (typeof SEASONS)[number];
export type SeasonMode = "off" | "auto" | Season;
export const SEASON_MODES: readonly SeasonMode[] = ["off", "auto", ...SEASONS];

export interface Decor {
  season: SeasonMode;
  bestseller: string;
  bestseller_title: string | null;
}

export const DEFAULT_DECOR: Decor = { season: "off", bestseller: "default", bestseller_title: null };
export const DEFAULT_BESTSELLER_COVER = "/covers/mag-1-peek@2x.webp";
export const DEFAULT_BESTSELLER_COVER_SRCSET = "/covers/mag-1-peek@2x.webp 2x, /covers/mag-1-peek@3x.webp 3x";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isBookId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** Server javobidan xavfsiz ajratib olish (noto'g'ri qiymat — standart) */
export function parseDecor(settings: unknown): Decor {
  const raw = (settings as { decor?: unknown } | null)?.decor;
  if (!raw || typeof raw !== "object") return DEFAULT_DECOR;
  const r = raw as Record<string, unknown>;
  const season = SEASON_MODES.includes(r.season as SeasonMode) ? (r.season as SeasonMode) : "off";
  const bestseller = r.bestseller === "off" || isBookId(r.bestseller) ? (r.bestseller as string) : "default";
  const title = typeof r.bestseller_title === "string" ? r.bestseller_title.slice(0, 200) : null;
  return { season, bestseller, bestseller_title: title };
}

/** Shimoliy yarimshar (O'zbekiston): dek–fev qish, mar–may bahor, iyun–avg yoz, sen–noy kuz */
export function seasonOf(d = new Date()): Season {
  const m = d.getMonth();
  return m === 11 || m <= 1 ? "winter" : m <= 4 ? "spring" : m <= 7 ? "summer" : "autumn";
}

export function activeSeason(mode: SeasonMode, now?: Date): Season | null {
  if (mode === "off") return null;
  return mode === "auto" ? seasonOf(now) : mode;
}
