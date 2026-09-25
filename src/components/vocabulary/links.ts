import type { VocabEntry } from "@/lib/api";

/** 33.6: "PDF'da ochish" — o'sha bet va so'z (reader uni vaqtincha bo'rttiradi) */
export function pdfHref(v: Pick<VocabEntry, "articleId" | "page" | "word">) {
  const q = new URLSearchParams();
  if (v.page) q.set("page", String(v.page));
  q.set("word", v.word);
  return `/reader/${v.articleId}?${q}`;
}
