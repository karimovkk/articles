/**
 * 107: rasmli (skaner) PDF'ga brauzerda OCR — admin yuklashdan oldin.
 *
 * Matni bor sahifalar o'zgarmaydi (`ocrmypdf --skip-text` kabi). Matnsiz sahifa yuqori aniqlikda chiziladi, tesseract.js
 * (faqat ingliz) so'zlarni va joylarini topadi; pdf-lib bilan har so'z o'z joyiga, o'lchamiga moslab KO'RINMAS
 * (`Tr 3`) yoziladi. Sahifa rasmi, o'lchami va sahifalar soni o'zgarmaydi, rasmlar qayta siqilmaydi — backend uni oddiy
 * matnli PDF kabi qabul qiladi (belgilash, lug'at, qidiruv ishlaydi).
 *
 * tesseract.js worker / yadro / `eng` modeli birinchi ishlatilganda CDN'dan yuklanadi (~10 MB, keyin brauzer keshida).
 */
import { loadPdfJs } from "@/lib/reader/range-transport";

export interface OcrProgress {
  /** "check" — matn qatlami tekshirilmoqda; "ocr" — bet tanilmoqda; "build" — PDF yig'ilmoqda */
  stage: "check" | "ocr" | "build";
  /** Tanilayotgan bet (1-based) va tanilishi kerak bo'lgan betlar ichidagi tartibi */
  page: number;
  done: number;
  total: number;
  /** Joriy bet ichidagi foiz (0–1) */
  pageProgress: number;
}

export interface OcrResult {
  file: File;
  /** OCR qilingan betlar (0 — fayl o'zgarmadi) */
  ocrPages: number;
  /** Topilgan so'zlar soni */
  words: number;
}

/** Bu belgidan kam matnli bet — "matnsiz" (sahifa raqami, kolontitul kabi bir-ikki so'z hisobga olinmaydi) */
const MIN_TEXT_CHARS = 25;
/** Tanish uchun chizish: uzun tomoni ~ shuncha piksel (≈ 300 DPI A4) */
const TARGET_PX = 2600;
const MIN_CONFIDENCE = 30;

interface OcrWord {
  text: string;
  /** PDF koordinatalarida: tayanch chiziq boshi, yo'nalish (radian), eni, balandligi */
  x: number;
  y: number;
  angle: number;
  width: number;
  height: number;
}

class Aborted extends Error {
  constructor() {
    super("aborted");
    this.name = "AbortError";
  }
}
const check = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new Aborted();
};
export const isOcrAbort = (e: unknown) => (e as { name?: string })?.name === "AbortError";

export async function ocrPdfIfNeeded(file: File, opts: { onProgress?: (p: OcrProgress) => void; signal?: AbortSignal } = {}): Promise<OcrResult> {
  const { onProgress, signal } = opts;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdfjs = await loadPdfJs();
  // pdf.js buferni worker'ga o'tkazadi — nusxasi beriladi (asl baytlar pdf-lib uchun kerak)
  const task = pdfjs.getDocument({ data: bytes.slice() });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch {
    // pdf.js ocha olmadi (buzuq / shifrlangan) — OCR'siz o'zi yuboriladi, tekshiruv backend'da
    await task.destroy().catch(() => undefined);
    return { file, ocrPages: 0, words: 0 };
  }
  const pageWords = new Map<number, OcrWord[]>();
  try {
    // 1) Qaysi betlarda matn yo'q
    const need: number[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      check(signal);
      onProgress?.({ stage: "check", page: n, done: n - 1, total: doc.numPages, pageProgress: 0 });
      const page = await doc.getPage(n);
      const tc = await page.getTextContent();
      const chars = tc.items.reduce((s, it) => s + ("str" in it ? it.str.trim().length : 0), 0);
      if (chars < MIN_TEXT_CHARS) need.push(n);
      page.cleanup();
    }
    if (!need.length) return { file, ocrPages: 0, words: 0 };

    // 2) Tanish (bitta worker, betma-bet)
    const { createWorker } = await import("tesseract.js");
    let current = { page: need[0], done: 0 };
    const worker = await createWorker("eng", 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") onProgress?.({ stage: "ocr", page: current.page, done: current.done, total: need.length, pageProgress: m.progress });
      },
    });
    const onAbort = () => void worker.terminate();
    signal?.addEventListener("abort", onAbort);
    try {
      for (const [i, n] of need.entries()) {
        check(signal);
        current = { page: n, done: i };
        onProgress?.({ stage: "ocr", page: n, done: i, total: need.length, pageProgress: 0 });
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(4, TARGET_PX / Math.max(base.width, base.height));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        check(signal);
        const { data } = await worker.recognize(canvas, {}, { blocks: true });
        const words: OcrWord[] = [];
        for (const b of data.blocks ?? [])
          for (const p of b.paragraphs)
            for (const l of p.lines)
              for (const w of l.words) {
                const text = w.text.trim();
                if (!text || w.confidence < MIN_CONFIDENCE) continue;
                const { x0, y0, x1, y1 } = w.bbox;
                const h = y1 - y0;
                // Tayanch chiziq — pastdan ~20% yuqorida (harf dumlari: g, p, y); koordinatalar PDF'ga (aylanish, CropBox hisobda)
                const [bx, by] = viewport.convertToPdfPoint(x0, y1 - h * 0.2);
                const [ex, ey] = viewport.convertToPdfPoint(x1, y1 - h * 0.2);
                const [tx, ty] = viewport.convertToPdfPoint(x0, y0);
                const width = Math.hypot(ex - bx, ey - by);
                const height = Math.hypot(tx - bx, ty - by) / 0.8;
                if (width < 0.5 || height < 0.5) continue;
                words.push({ text, x: bx, y: by, angle: Math.atan2(ey - by, ex - bx), width, height });
              }
        pageWords.set(n, words);
        canvas.width = canvas.height = 0;
        page.cleanup();
      }
    } finally {
      signal?.removeEventListener("abort", onAbort);
      await worker.terminate().catch(() => undefined);
    }
  } finally {
    await task.destroy();
  }
  check(signal);

  // 3) Ko'rinmas matn qatlami (pdf-lib)
  onProgress?.({ stage: "build", page: 0, done: pageWords.size, total: pageWords.size, pageProgress: 1 });
  const { PDFDocument, PDFNumber, PDFOperator, PDFOperatorNames, StandardFonts, TextRenderingMode, beginText, endText, popGraphicsState, pushGraphicsState, setFontAndSize, setTextMatrix, setTextRenderingMode, showText } = await import("pdf-lib");
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const charset = new Set(font.getCharacterSet());
  // WinAnsi'da yo'q belgilar (kam uchraydi) — yaqin ko'rinishi; bo'lmasa "?"
  const clean = (s: string) =>
    [...s.replace(/[ʻʼ`´′]/g, "'").replace(/[″]/g, '"')].map((c) => (charset.has(c.codePointAt(0)!) ? c : "?")).join("");
  let total = 0;
  for (const [n, words] of pageWords) {
    if (!words.length) continue;
    const page = pdf.getPage(n - 1);
    const key = page.node.newFontDictionary("A365Ocr", font.ref);
    const ops: Array<ReturnType<typeof beginText>> = [pushGraphicsState(), beginText(), setTextRenderingMode(TextRenderingMode.Invisible)];
    for (const w of words) {
      const text = clean(w.text);
      const natural = font.widthOfTextAtSize(text, w.height);
      if (!natural) continue;
      const cos = Math.cos(w.angle);
      const sin = Math.sin(w.angle);
      ops.push(
        setFontAndSize(key, w.height),
        // Tz — gorizontal cho'zish: so'z eni rasmdagidek (belgilash so'zga aniq tushsin)
        PDFOperator.of(PDFOperatorNames.SetTextHorizontalScaling, [PDFNumber.of((w.width / natural) * 100)]),
        setTextMatrix(cos, sin, -sin, cos, w.x, w.y),
        showText(font.encodeText(text)),
      );
      total++;
    }
    ops.push(endText(), popGraphicsState());
    page.pushOperators(...ops);
  }
  const out = await pdf.save();
  return { file: new File([new Uint8Array(out)], file.name, { type: "application/pdf", lastModified: Date.now() }), ocrPages: pageWords.size, words: total };
}
