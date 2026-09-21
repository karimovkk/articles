import type { uz } from "./uz";

/** Barcha lug'at kalitlari — `uz` dan olinadi. */
export type DictKey = keyof typeof uz;
export type Dict = Record<DictKey, string>;
