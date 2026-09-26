// 9.7 — frontend xavfsizlik header'lari (next.config.ts headers())
import { BASE } from "../lib.mjs";
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failures++; };
const h = async (path) => { const r = await fetch(`${BASE}${path}`, { redirect: "manual" }); return { status: r.status, get: (k) => r.headers.get(k) }; };
for (const path of ["/login", "/catalog"]) {
  const r = await h(path);
  check(`${path}: X-Frame-Options DENY`, r.get("x-frame-options") === "DENY");
  check(`${path}: X-Content-Type-Options nosniff`, r.get("x-content-type-options") === "nosniff");
  check(`${path}: Referrer-Policy`, r.get("referrer-policy") === "strict-origin-when-cross-origin");
  check(`${path}: Permissions-Policy (camera/mic/geo yopiq)`, /camera=\(\)/.test(r.get("permissions-policy") ?? ""));
}
const rd = await h("/reader/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
// dev'da Next sahifalarga o'zining "no-cache, must-revalidate" header'ini qo'yadi — to'liq tekshiruv production'da
check("/reader: Cache-Control private, no-store", process.env.E2E_PROD ? /no-store/.test(rd.get("cache-control") ?? "") : /no-store|no-cache/.test(rd.get("cache-control") ?? ""), rd.get("cache-control"));
const bk = await h("/books/11111111-1111-4111-8111-111111111111");
check("/books: Cache-Control private, no-store", /no-store/.test(bk.get("cache-control") ?? ""), bk.get("cache-control"));
const guard = await h("/books/11111111-1111-4111-8111-111111111111");
check("/books auth'siz → proxy /login ga yo'naltiradi", guard.status >= 300 && guard.status < 400 && /\/login\?next=/.test(guard.get("location") ?? ""), `${guard.status} ${guard.get("location")}`);
const w = await h("/pdf.worker.min.mjs");
check("pdf.js worker: nosniff + to'g'ri MIME", w.get("x-content-type-options") === "nosniff" && /javascript/.test(w.get("content-type") ?? ""), w.get("content-type"));
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
