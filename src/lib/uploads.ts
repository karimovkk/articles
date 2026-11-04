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

/** 124: MP3 (ID3 yoki kadr sinxroni) / OGG (OggS) / M4A (….ftyp) — magic baytlar bo'yicha */
export async function validateAudio(file: File): Promise<string | null> {
  if (file.size === 0) return t("upload.empty");
  if (file.size > env.maxMusicMb * MB) return t("upload.audioTooBig", { max: env.maxMusicMb, size: formatMb(file.size) });
  const b = await head(file, 12);
  const mp3 = startsWith(b, [0x49, 0x44, 0x33]) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
  const ogg = startsWith(b, [0x4f, 0x67, 0x67, 0x53]);
  const m4a = b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
  if (!mp3 && !ogg && !m4a) return t("upload.notAudio");
  return null;
}

/** Brauzer aniqlagan davomiylik (soniya); aniqlanmasa — null (backend o'zi aniqlaydi) */
export function audioDuration(file: File, timeoutMs = 4000): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    const done = (v: number | null) => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(v);
    };
    const timer = window.setTimeout(() => done(null), timeoutMs);
    a.preload = "metadata";
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => done(null);
    a.src = url;
  });
}

export function formatMb(bytes: number): string {
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 2 : 0)} MB`;
}
