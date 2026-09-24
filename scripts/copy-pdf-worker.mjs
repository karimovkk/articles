// pdfjs-dist worker faylini public/ ga nusxalaydi (versiya mos bo'lishi uchun postinstall'da ishlaydi).
// Legacy build — Safari (iPhone/iPad) uchun polyfill'lar bilan; `src/lib/reader/range-transport.ts` ham legacy'ni yuklaydi.
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs");
const dest = resolve(root, "public/pdf.worker.min.mjs");

if (!existsSync(src)) {
  console.warn("[copy-pdf-worker] pdfjs-dist topilmadi, o'tkazib yuborildi");
  process.exit(0);
}
mkdirSync(dirname(dest), { recursive: true });
// Safari 17/18: worker ichida ham ReadableStream async iteratori yo'q — polyfill worker boshiga qo'shiladi
const polyfill = readFileSync(resolve(root, "src/lib/reader/stream-iterator-polyfill.js"), "utf8");
writeFileSync(dest, polyfill + "\n" + readFileSync(src, "utf8"));
console.log("[copy-pdf-worker] public/pdf.worker.min.mjs yangilandi");
