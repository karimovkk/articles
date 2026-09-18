/**
 * PDF.js uchun maxsus Range transport.
 *
 * PDF.js o'zining fetch'ini ishlatsa, 15 daqiqalik access token tugaganda
 * keyingi Range so'rovlari 401 bilan tushadi. Shu sababli barcha bo'laklar
 * bizning apiRaw (Bearer + avtomatik refresh) orqali olinadi:
 *
 *   GET /api/v1/reader/{id}/content   Range: bytes=a-b  →  206 + Content-Range
 *
 * Fayl hech qachon to'liq yuklab olinmaydi — PDF.js faqat kerakli
 * bo'laklarni so'raydi (STORAGE.md: chunk-by-chunk streaming).
 */
import type { PDFDataRangeTransport as PDFDataRangeTransportType } from "pdfjs-dist";
import { readerApi } from "@/lib/api/reader";

type PdfJs = typeof import("pdfjs-dist");

export const RANGE_CHUNK_SIZE = 512 * 1024; // 512 KB

let pdfjsPromise: Promise<PdfJs> | null = null;

/** pdfjs-dist ni faqat brauzerda, bir marta yuklaydi va worker'ni sozlaydi. */
export function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return m;
    });
  }
  return pdfjsPromise;
}

export interface OpenedDocument {
  doc: import("pdfjs-dist").PDFDocumentProxy;
  destroy: () => void;
}

export async function openProtectedPdf(bookId: string, onProgress?: (loaded: number, total: number) => void): Promise<OpenedDocument> {
  const pdfjs = await loadPdfJs();
  const controller = new AbortController();

  const info = await readerApi.size(bookId, controller.signal);

  // Server Range'ni qo'llamasa (200) — butun fayl qo'lda keladi
  if (!info.supportsRange && info.head) {
    const task = pdfjs.getDocument({ data: info.head });
    const doc = await task.promise;
    return { doc, destroy: () => void task.destroy() };
  }

  const total = info.total;
  let loaded = 0;

  class ProtectedRangeTransport extends pdfjs.PDFDataRangeTransport {
    private inflight = new Set<AbortController>();

    override requestDataRange(begin: number, end: number): void {
      // PDF.js `end` ni exclusive beradi; HTTP Range inclusive
      const c = new AbortController();
      this.inflight.add(c);
      readerApi
        .fetchRange(bookId, begin, Math.min(end, total) - 1, c.signal)
        .then((chunk) => {
          loaded += chunk.bytes.byteLength;
          onProgress?.(Math.min(loaded, total), total);
          // Uint8Array worker'ga transfer qilinadi — nusxa ko'chirish shart emas
          this.onDataRange(chunk.start, chunk.bytes);
        })
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name !== "AbortError") console.error("[reader] range failed", err);
        })
        .finally(() => this.inflight.delete(c));
    }

    override abort(): void {
      for (const c of this.inflight) c.abort();
      this.inflight.clear();
      controller.abort();
    }
  }

  const transport: PDFDataRangeTransportType = new ProtectedRangeTransport(total, null, false);
  const task = pdfjs.getDocument({
    range: transport,
    rangeChunkSize: RANGE_CHUNK_SIZE,
    disableAutoFetch: true, // faqat ko'rilayotgan sahifalar uchun bo'lak so'raladi
    disableStream: true,
  });
  const doc = await task.promise;
  return {
    doc,
    destroy: () => {
      transport.abort();
      void task.destroy();
    },
  };
}
