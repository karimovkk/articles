import { hasKey, t, type DictKey } from "@/i18n";

/**
 * 124: backend kodlari (ACTIVE, READY, ADMIN, …) ekranda xom ko'rinmasin — tarjima qilingan so'z.
 * Noma'lum kod — "Kichik harf, bo'sh joy bilan" (masalan `SOME_NEW` → "Some new"), xom katta harf emas.
 */
const KNOWN = new Set(["UPLOADING", "ACTIVE", "INACTIVE", "BLOCKED", "DELETED", "REVOKED", "EXPIRED", "READY", "PROCESSING", "PENDING", "FAILED", "UPLOADED", "DRAFT", "ADMIN", "USER", "GUEST"]);

export function codeLabel(code?: string | null): string {
  if (!code) return "—";
  if (KNOWN.has(code)) return t(`code.${code}` as DictKey);
  // buyurtma holatlari — mavjud tarjimalar
  if (hasKey(`orders.status.${code}`)) return t(`orders.status.${code}` as DictKey);
  const s = code.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
