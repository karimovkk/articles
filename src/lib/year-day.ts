/**
 * Yilning nechanchi kuni (brend "365" shu ustiga qurilgan, 25-bo'lim).
 * Mahalliy vaqt bo'yicha hisoblanadi; kabisa yilida jami 366 kun.
 */
export function dayOfYear(d: Date = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

export function daysInYear(d: Date = new Date()): number {
  const y = d.getFullYear();
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
}

/** Keyingi yarim tungacha necha millisekund qolgani (ko'rsatkichni o'zi yangilash uchun) */
export function msUntilMidnight(d: Date = new Date()): number {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 5);
  return Math.max(1000, next.getTime() - d.getTime());
}
