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

/** JPEG / PNG / WebP (RIFF....WEBP) — magic baytlar bo'yicha */
async function isImage(file: File): Promise<boolean> {
  const b = await head(file, 12);
  const isJpeg = startsWith(b, [0xff, 0xd8, 0xff]);
  const isPng = startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isWebp = startsWith(b, [0x52, 0x49, 0x46, 0x46]) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return isJpeg || isPng || isWebp;
}

export async function validateCover(file: File): Promise<string | null> {
  if (file.size === 0) return t("upload.empty");
  if (file.size > env.maxCoverMb * MB) return t("upload.coverTooBig", { max: env.maxCoverMb, size: formatMb(file.size) });
  if (!(await isImage(file))) return t("upload.notImage");
  return null;
}

/** To'lov cheki (buyurtma oqimi v1.0): JPEG/PNG/WebP rasm yoki PDF, ≤ 10 MB — backend chegarasi */
export const RECEIPT_MAX_MB = 10;
export type ReceiptKind = "image" | "pdf" | "heic";

/** Fayl turi magic baytlar bo'yicha: rasm, PDF (`%PDF-`) yoki HEIC/HEIF (`....ftyp` + heic/heix/mif1/...) */
export async function receiptKind(file: File): Promise<ReceiptKind | null> {
  if (await isImage(file)) return "image";
  const b = await head(file, 12);
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf";
  const box = String.fromCharCode(...b.slice(4, 8));
  const brand = String.fromCharCode(...b.slice(8, 12));
  if (box === "ftyp" && /^(heic|heix|hevc|hevx|mif1|msf1|heim|heis)$/.test(brand)) return "heic";
  return null;
}

export async function validateReceipt(file: File): Promise<string | null> {
  if (file.size === 0) return t("upload.empty");
  if (file.size > RECEIPT_MAX_MB * MB) return t("upload.receiptTooBig", { max: RECEIPT_MAX_MB, size: formatMb(file.size) });
  const kind = await receiptKind(file);
  if (kind === "heic") return t("upload.receiptHeic");
  if (!kind) return t("upload.receiptNotImage");
  return null;
}

/**
 * HEIC → JPEG (backend HEIC qabul qilmaydi): brauzer dekodlay olsa (Safari) canvas orqali JPEG'ga o'giriladi;
 * dekodlay olmasa (Chrome/Firefox) — null (foydalanuvchiga aniq xabar ko'rsatiladi). iOS'da tanlashda o'zi JPEG qiladi.
 */
export async function heicToJpeg(file: File): Promise<File | null> {
  try {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext("2d")?.drawImage(bmp, 0, 0);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.9));
    if (!blob) return null;
    return new File([blob], file.name.replace(/\.(heic|heif)$/i, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return null;
  }
}

export function formatMb(bytes: number): string {
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 2 : 0)} MB`;
}
