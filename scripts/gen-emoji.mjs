// 101: emoji tanlagich ma'lumoti — emojibase-data (en + ru kalit so'zlari) dan ixcham JSON.
// Ishga tushirish: `node scripts/gen-emoji.mjs` → src/lib/emoji/emoji-data.json (tanlagich ochilganda yuklanadi).
// Faqat Unicode ≤ 15.1 — Windows 11, Android, iOS 17+ shriftlarida bor (yangilari "kvadrat" bo'lib ko'rinadi).
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const en = require("emojibase-data/en/data.json");
const ru = require("emojibase-data/ru/data.json");
const { groups } = require("emojibase-data/meta/groups.json");

const MAX_VERSION = 15.1;
const ruBy = new Map(ru.map((e) => [e.hexcode, e]));
const words = (e) => [e.label, ...(e.tags ?? [])].join(" ").toLowerCase();
const out = Object.entries(groups)
  .filter(([id]) => id !== "2") // "component" — teri rangi bo'laklari, alohida emas
  .map(([id, key]) => ({
    id: key,
    emojis: en
      .filter((e) => String(e.group) === id && (e.version ?? 0) <= MAX_VERSION)
      .sort((a, b) => a.order - b.order)
      .map((e) => {
        const r = ruBy.get(e.hexcode);
        return [e.emoji, [...new Set(`${words(e)} ${r ? words(r) : ""}`.split(/\s+/).filter(Boolean))].join(" ")];
      }),
  }));
writeFileSync(new URL("../src/lib/emoji/emoji-data.json", import.meta.url), JSON.stringify({ groups: out }));
console.log(out.map((g) => `${g.id}: ${g.emojis.length}`).join(", "));
