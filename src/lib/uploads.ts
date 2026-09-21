/**
 * Fayl yuklashdan oldin klient tomonidagi tekshiruv (FE-6.5): format magic-bayt bo'yicha
 * (backend ham shunday tekshiradi — SECURITY.md), hajm — env limitlari bo'yicha.
 * Bu foydalanuvchiga tez javob berish uchun; asosiy tekshiruv backendda.
 */
import { env } from "@/lib/env";
import { t } from "@/i18n";

const MB = 1024 * 1024;

async function head(file: File, n: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, n).arrayBuffer());
}

const startsWith = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);

/** Xato matni yoki null (yaroqli). */
export async function validatePdf(file: File): Promise<string | null> {
  if (file.size === 0) return t("upload.empty");
  if (file.size > env.maxPdfMb * MB) return t("upload.pdfTooBig", { max: env.maxPdfMb, size: formatMb(file.size) });
  const b = await head(file, 5);
  // %PDF-
  if (!startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return t("upload.notPdf");
  return null;
}

export async function validateCover(file: File): Promise<string | null> {
  if (file.size === 0) return t("upload.empty");
  if (file.size > env.maxCoverMb * MB) return t("upload.coverTooBig", { max: env.maxCoverMb, size: formatMb(file.size) });
  const b = await head(file, 12);
  const isJpeg = startsWith(b, [0xff, 0xd8, 0xff]);
  const isPng = startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // RIFF....WEBP
  const isWebp = startsWith(b, [0x52, 0x49, 0x46, 0x46]) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  if (!isJpeg && !isPng && !isWebp) return t("upload.notImage");
  return null;
}

export function formatMb(bytes: number): string {
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 2 : 0)} MB`;
}
