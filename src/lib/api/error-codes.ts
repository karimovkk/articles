/**
 * Backend `error.code` → foydalanuvchiga tushunarli matn (FE-0.5, API.md «Errors»).
 * Matnlar lug'atda (`src/i18n/dict/*`, `error.<CODE>` kalitlari) — joriy tilda qaytadi.
 * Maxsus holatlar: `*_NOT_FOUND` → NOT_FOUND; 5xx → INTERNAL_ERROR; tarmoq → NETWORK_ERROR.
 */
import { hasKey, t } from "@/i18n";

export function messageForCode(code: string, status?: number): string | undefined {
  const key = `error.${code}`;
  if (hasKey(key)) return t(key);
  if (code.endsWith("_NOT_FOUND")) return t("error.NOT_FOUND");
  if (status !== undefined && status >= 500) return t("error.INTERNAL_ERROR");
  return undefined;
}
