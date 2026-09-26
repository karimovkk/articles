/**
 * 37: tekin kitob — `is_free === true` (backend qo'shgach) yoki narx 0. Tekin kitob sotilmaydi (buyurtma/savatcha
 * yo'q) va mehmonlar ham o'qiy oladi (backend reader endpointlarini kirishsiz ochganda — BACKEND_TASKS.md 4-qism).
 */
export function isFreeBook(b: { is_free?: boolean | null; price?: string | number | null } | null | undefined): boolean {
  if (!b) return false;
  if (b.is_free === true) return true;
  const n = Number(b.price);
  return b.price !== null && b.price !== undefined && b.price !== "" && Number.isFinite(n) && n === 0;
}
