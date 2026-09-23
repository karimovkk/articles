/**
 * Sahifadagi matn qatlamidan (PDF.js `textLayer`) so'zni topish (17.5): qidiruv natijasi bosilganda o'sha
 * sahifadagi barcha mosliklar vaqtincha bo'rttirib ko'rsatiladi. Koordinatalar sahifaga nisbatan ulushda
 * qaytadi (highlight qatlami bilan bir xil format), shuning uchun zoom/o'lcham o'zgarsa ham to'g'ri turadi.
 */
import type { HighlightRect } from "./highlights";

/** Qidiruvga tayyorlash: kichik harf + turli tirnoq/probel belgilarini bir xillashtirish */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[   ]/g, " ")
    .replace(/[‘’ʼʻ`´]/g, "'")
    .replace(/[“”]/g, '"');
}

/** Matn tugunlari va ularning umumiy satrdagi boshlanish indekslari */
function collect(container: HTMLElement): { nodes: Text[]; starts: number[]; hay: string } {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const starts: number[] = [];
  let hay = "";
  let node = walker.nextNode();
  while (node) {
    const text = node as Text;
    starts.push(hay.length);
    nodes.push(text);
    hay += text.data;
    node = walker.nextNode();
  }
  return { nodes, starts, hay: normalize(hay) };
}

/** Umumiy satrdagi indeks → (tugun, tugun ichidagi offset) */
function locate(starts: number[], nodes: Text[], index: number): { node: Text; offset: number } | null {
  let lo = 0;
  let hi = nodes.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const start = starts[mid];
    const end = start + nodes[mid].data.length;
    if (index < start) hi = mid - 1;
    else if (index >= end) lo = mid + 1;
    else return { node: nodes[mid], offset: index - start };
  }
  const last = nodes.length - 1;
  return last >= 0 ? { node: nodes[last], offset: nodes[last].data.length } : null;
}

/**
 * `query` ning sahifadagi barcha mosliklarining to'rtburchaklari (ulushda: [x, y, w, h]).
 * Bir necha qatorga bo'lingan moslik bir nechta to'rtburchak beradi.
 */
export function findTextRects(textLayer: HTMLElement, pageEl: HTMLElement, query: string, limit = 300): HighlightRect[] {
  const q = normalize(query).trim();
  if (q.length < 2) return [];
  const { nodes, starts, hay } = collect(textLayer);
  if (!nodes.length) return [];
  const page = pageEl.getBoundingClientRect();
  if (!page.width || !page.height) return [];

  const out: HighlightRect[] = [];
  let from = hay.indexOf(q);
  while (from !== -1 && out.length < limit) {
    const a = locate(starts, nodes, from);
    const b = locate(starts, nodes, from + q.length - 1);
    if (a && b) {
      const range = document.createRange();
      try {
        range.setStart(a.node, a.offset);
        range.setEnd(b.node, Math.min(b.node.data.length, b.offset + 1));
        for (const r of Array.from(range.getClientRects())) {
          if (r.width < 0.5 || r.height < 0.5) continue;
          out.push([(r.left - page.left) / page.width, (r.top - page.top) / page.height, r.width / page.width, r.height / page.height]);
        }
      } catch {
        /* tugun almashgan bo'lsa — o'tkazib yuboramiz */
      }
    }
    from = hay.indexOf(q, from + q.length);
  }
  return out;
}
