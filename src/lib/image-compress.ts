/**
 * Rasmni yuklashdan oldin brauzerda siqish (canvas): o'lcham chegarasi + sifat. Siqilgan rasm 10–20× kichik — sekin
 * internetda ham tez yuklanadi.
 *  - 46: fon rasmi — eni ≤ 1920 px, WebP (brauzer qo'llamasa — JPEG);
 *  - 55: to'lov cheki — eni ≤ 1600 px, JPEG 0.8 (backend tavsiyasi; Telegram ham JPEG'ni yaxshi ko'rsatadi).
 * EXIF burilishi `createImageBitmap` da hisobga olinadi; JPEG'da shaffof joylar oq bo'ladi.
 */
export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  /** "webp" — WebP, bo'lmasa JPEG; "jpeg" — doim JPEG */
  type?: "webp" | "jpeg";
}

export async function compressImage(file: Blob, opts: CompressOptions = {}): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const { maxWidth = 1920, maxHeight = Infinity, quality = 0.82, type = "webp" } = opts;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bmp.width, maxHeight / bmp.height);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  if (type === "jpeg") {
    ctx.fillStyle = "#ffffff"; // JPEG'da shaffoflik yo'q — qora emas, oq fon
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const toBlob = (mime: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, mime, quality));
  if (type === "webp") {
    const webp = await toBlob("image/webp");
    if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  }
  const jpg = await toBlob("image/jpeg");
  if (!jpg) throw new Error("encode");
  return { blob: jpg, ext: "jpg" };
}
