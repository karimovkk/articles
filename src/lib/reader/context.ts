/**
 * 95.4: lug'at konteksti — tanlangan so'z joylashgan GAP (PDF matn qatlamidan).
 *
 * Avvalgi usul ekrandagi qatorni (bir xil balandlikdagi barcha spanlar) olardi: ikki ustunli sahifada qo'shni ustun
 * matni aralashib ketardi, gap yarim qolardi, qator oxirida bo'lingan so'z (`auto-` / `matic`) uzilardi.
 * Endi: matn qatlami pdf.js'ning o'qish tartibida (ustun-ustun) yig'iladi, qator uzilishi — bo'shliq, qator oxiridagi
 * defis — so'z qo'shiladi; tanlangan joydan oldingi va keyingi gap chegaralarigacha olinadi.
 */
import type { HighlightRect } from "./highlights";

const SENT_END = /[.!?…](?=["'”»)\]]*(\s|$))/g;

/** Matn qatlami → yaxlit matn + har spanning matndagi oralig'i */
function layerText(layer: Element): { text: string; spans: Array<{ el: Element; start: number; end: number }> } {
  let text = "";
  const spans: Array<{ el: Element; start: number; end: number }> = [];
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode() as Element | null; n; n = walker.nextNode() as Element | null) {
    if (n.nodeName === "BR") {
      // Qator oxirida bo'lingan so'z: "auto-" + "matic" → "automatic"; aks holda — bo'shliq
      if (/\p{L}-$/u.test(text)) {
        text = text.slice(0, -1);
        const last = spans[spans.length - 1];
        if (last && last.end > text.length) last.end = text.length; // defis olib tashlandi — span oxiri ham
      }
      else if (text && !/\s$/.test(text)) text += " ";
      continue;
    }
    if (n.nodeName !== "SPAN" || n.querySelector("span")) continue; // faqat matnli (barg) spanlar
    const t = n.textContent ?? "";
    if (!t) continue;
    spans.push({ el: n, start: text.length, end: text.length + t.length });
    text += t;
  }
  return { text, spans };
}

/** Span tanlov to'rtburchaklaridan biri bilan kesishadimi (sahifaga nisbatan ulushlarda) */
function intersects(el: Element, page: DOMRect, rects: HighlightRect[]): boolean {
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  const x = (r.left - page.left) / page.width;
  const y = (r.top - page.top) / page.height;
  const w = r.width / page.width;
  const h = r.height / page.height;
  return rects.some(([rx, ry, rw, rh]) => {
    const ox = Math.min(x + w, rx + rw) - Math.max(x, rx);
    const oy = Math.min(y + h, ry + rh) - Math.max(y, ry);
    return ox > 0 && oy > Math.min(h, rh) * 0.5;
  });
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Tanlangan matn konteksti (gap) va — qator oxirida bo'lingan so'z tanlangan bo'lsa — to'liq so'z.
 * `selected` — tanlangan matn; `rects` — tanlov to'rtburchaklari (sahifaga nisbatan ulush).
 */
export function selectionContext(pageEl: Element, rects: HighlightRect[], selected: string, max = 320): { context: string; word: string | null } {
  const layer = pageEl.querySelector(".textLayer");
  if (!layer || !rects.length) return { context: "", word: null };
  const { text, spans } = layerText(layer);
  const box = pageEl.getBoundingClientRect();
  const hit = spans.filter((s) => intersects(s.el, box, rects));
  if (!hit.length) return { context: "", word: null };
  const from = hit[0].start;
  const to = hit[hit.length - 1].end;
  // Tanlangan matnning aniq joyi (span ichida) — bo'lmasa span boshi
  const needle = squash(selected).replace(/-\s*$/, "");
  let at = needle ? text.indexOf(needle, Math.max(0, from - 1)) : -1;
  if (at < 0 || at > to) at = from;
  const len = needle && text.startsWith(needle, at) ? needle.length : Math.max(1, to - from);

  return contextAt(text, at, len, selected, needle, max);
}

/** Matndagi aniq joy (`at`, `len`) atrofidagi gap; qator oxirida bo'lingan so'z tanlangan bo'lsa — to'liq so'z */
function contextAt(text: string, at: number, len: number, selected: string, needle: string, max: number): { context: string; word: string | null } {
  // Qator oxirida bo'lingan so'z ("auto-" tanlangan) → to'liq so'z ("automatic")
  let word: string | null = null;
  const tail = text.slice(at + len).match(/^[\p{L}\p{N}'’ʻʼ]+/u);
  if (tail && /-\s*$/.test(selected.trim()) && /^\p{L}+$/u.test(needle)) word = needle + tail[0];

  // Gap chegaralari
  let start = 0;
  for (const m of text.slice(0, at).matchAll(SENT_END)) start = (m.index ?? 0) + 1;
  SENT_END.lastIndex = 0;
  const rest = text.slice(at + len);
  const endM = SENT_END.exec(rest);
  SENT_END.lastIndex = 0;
  let end = endM ? at + len + (endM.index ?? 0) + 1 : text.length;
  // Juda uzun gap — so'z atrofidagi oyna (so'z chegarasida, "…" bilan)
  let pre = "";
  let post = "";
  if (end - start > max) {
    const half = Math.floor((max - len) / 2);
    if (at - start > half) {
      start = text.lastIndexOf(" ", at - half) + 1 || at - half;
      pre = "…";
    }
    if (end - (at + len) > half) {
      const cut = text.indexOf(" ", at + len + half);
      end = cut > 0 ? cut : end;
      post = "…";
    }
  }
  return { context: pre + squash(text.slice(start, end)) + post, word };
}

/**
 * 96.x: tanlovning aniq joyidan (Range) — matn bo'yicha qidirilmaydi: so'z sahifada bir necha marta uchrasa ham
 * ("while") aynan tanlangani olinadi.
 */
export function rangeContext(pageEl: Element, range: Range, max = 320): { context: string; word: string | null } {
  const layer = pageEl.querySelector(".textLayer");
  if (!layer) return { context: "", word: null };
  const { text, spans } = layerText(layer);
  const pos = (node: Node, offset: number): number | null => {
    for (const sp of spans) {
      if (!sp.el.contains(node)) continue;
      // span ichidagi matn tugunlari bo'yicha siljish
      let off = 0;
      const w = document.createTreeWalker(sp.el, NodeFilter.SHOW_TEXT);
      for (let t = w.nextNode(); t; t = w.nextNode()) {
        if (t === node) return Math.min(sp.end, sp.start + off + offset);
        off += t.textContent?.length ?? 0;
      }
      return sp.start + Math.min(offset, sp.end - sp.start);
    }
    return null;
  };
  const a = pos(range.startContainer, range.startOffset);
  const b = pos(range.endContainer, range.endOffset);
  if (a === null || b === null || b <= a) return { context: "", word: null };
  const selected = range.toString();
  return contextAt(text, a, b - a, selected, squash(selected).replace(/-\s*$/, ""), max);
}
