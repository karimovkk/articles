/**
 * 46: rasmni yuklashdan oldin brauzerda siqish — eni ko'pi bilan `maxWidth` px, WebP (brauzer qo'llamasa — JPEG).
 * Fon rasmi uchun 2–8 MB lik foto → odatda 150–400 KB: tez yuklanadi, sahifalar tez ochiladi.
 */
export async function compressImage(file: File, maxWidth = 1920, quality = 0.82): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bmp.width);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const toBlob = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpg = await toBlob("image/jpeg");
  if (!jpg) throw new Error("encode");
  return { blob: jpg, ext: "jpg" };
}
