// Articles365 backend mock — OpenAPI 2026-09-21 shakllari (kitob → maqolalar, orders, notifications, 2FA, ...).
/* eslint-disable @typescript-eslint/no-unused-vars -- `_user` ichki maydonini ajratib tashlash uchun destructuring */
// Faqat frontend funksional tekshiruvi uchun. Prod kabi: 206 javobda Content-Range YO'Q (B1), 416 → details.size.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 8001);
const PDF = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "book.pdf"));
const now = () => new Date().toISOString();

const BOOK_ID = "11111111-1111-4111-8111-111111111111";
const BOOK2_ID = "33333333-3333-4333-8333-333333333333";
const ART_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ART2_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ART3_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ART_BIG_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"; // katta PDF (9.4) — /__setbig bilan yuklanadi
const BOOK_BIG_ID = "44444444-4444-4444-8444-444444444444";
let BIG_PDF = null;
const CAT = { id: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1", name: "Fan", slug: "fan", description: null, status: "ACTIVE", created_at: now(), updated_at: now() };

const USER = { id: "u1u1u1u1-u1u1-4u1u-8u1u-u1u1u1u1u1u1", email: "user@articles365.local", phone: null, full_name: "Test User", role: "USER", status: "ACTIVE", two_factor_enabled: false, created_at: now(), updated_at: now() };
const ADMIN = { id: "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1", email: "admin@articles365.local", phone: null, full_name: "Admin", role: "ADMIN", status: "ACTIVE", two_factor_enabled: false, created_at: now(), updated_at: now() };
const TWOFA_USER = { id: "f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2", email: "2fa@articles365.local", phone: null, full_name: "TwoFA User", role: "USER", status: "ACTIVE", two_factor_enabled: true, created_at: now(), updated_at: now() };
const TOKENS = { "access-token-1": USER, "access-token-1b": USER, "access-token-1c": USER, "access-token-admin": ADMIN, "access-token-2fa": TWOFA_USER };
const invalidTokens = new Set(); // /__expire — muddati tugagan access tokenlar
const usedRefresh = new Set(); // rotatsiya: ishlatilgan refresh token qayta ishlamaydi
let refreshBroken = false; // /__expire?all=1 — refresh ham ishlamaydi (sessiya bekor)

const freshBooks = () => [
  { id: BOOK_ID, title: "Test kitob", author: "Muallif", description: "Sinov uchun kitob tavsifi.\nIkkinchi qator.", price: "45000.00", status: "ACTIVE", category_id: CAT.id, category: CAT, book_metadata: {}, created_at: now(), updated_at: now(), has_cover: false },
  { id: BOOK2_ID, title: "Ruxsatsiz kitob", author: "B. Boboyev", description: "Sotib olinmagan.", price: "70000.00", status: "ACTIVE", category_id: CAT.id, category: CAT, book_metadata: {}, created_at: now(), updated_at: now(), has_cover: false },
  ...Array.from({ length: 29 }, (_, i) => ({ id: `22222222-2222-4222-8222-${String(i).padStart(12, "0")}`, title: `Kitob ${i + 1}`, author: i % 2 ? "A. Aliyev" : "B. Boboyev", description: `Tavsif ${i + 1}`, price: i % 5 === 0 ? "0" : "49000.00", status: "ACTIVE", category_id: i % 3 ? null : CAT.id, category: i % 3 ? null : CAT, book_metadata: {}, created_at: now(), updated_at: now(), has_cover: false })),
];
// 37: tekin kitob — narxi 0 (backend `is_free` bilan); "Kitob 1" da 2 ta maqola — mehmon o'qishi uchun
const FREE_BOOK_ID = "22222222-2222-4222-8222-000000000000";
const FREE_ART1 = "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1";
const FREE_ART2 = "f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2";
const withFree = (list) => list.map((b) => ({ ...b, is_free: Number(b.price) === 0 }));
// 81: asl narx + chegirma — backend kabi: has_discount = original_price > price (pullik), foiz butun
const discount = (b) => { const p = Number(b.price), o = Number(b.original_price); const has = !b.is_free && p > 0 && o > p; return { original_price: b.original_price ?? null, has_discount: has, discount_percent: has ? Math.round((1 - p / o) * 100) : 0 }; };
const withDiscount = (b) => Object.assign(b, discount(b));
const freshArticles = () => [
  { id: FREE_ART1, book_id: FREE_BOOK_ID, title: "Tekin maqola", order_index: 0, mime_type: "application/pdf", file_size: PDF.length, format: "pdf", page_count: 6, processing_status: "READY", processing_error: null, text_extractable: true, file_version: 1, content_updated_at: null, article_metadata: {}, created_at: now(), updated_at: now(), has_source_file: true },
  { id: FREE_ART2, book_id: FREE_BOOK_ID, title: "Tekin maqola 2", order_index: 1, mime_type: "application/pdf", file_size: PDF.length, format: "pdf", page_count: 6, processing_status: "READY", processing_error: null, text_extractable: true, file_version: 1, content_updated_at: null, article_metadata: {}, created_at: now(), updated_at: now(), has_source_file: true },
  { id: ART_ID, book_id: BOOK_ID, title: "Birinchi maqola", order_index: 0, mime_type: "application/pdf", file_size: PDF.length, format: "pdf", page_count: 6, processing_status: "READY", processing_error: null, text_extractable: true, file_version: 1, content_updated_at: null, article_metadata: {}, created_at: now(), updated_at: now(), has_source_file: true },
  { id: ART2_ID, book_id: BOOK_ID, title: "Ikkinchi maqola", order_index: 1, mime_type: "application/pdf", file_size: PDF.length, format: "pdf", page_count: 6, processing_status: "READY", processing_error: null, text_extractable: true, file_version: 1, content_updated_at: null, article_metadata: {}, created_at: now(), updated_at: now(), has_source_file: true },
  { id: ART3_ID, book_id: BOOK_ID, title: "Qayta ishlanayotgan maqola", order_index: 2, mime_type: null, file_size: null, format: null, page_count: null, processing_status: "PROCESSING", processing_error: null, text_extractable: false, file_version: 0, content_updated_at: null, article_metadata: {}, created_at: now(), updated_at: now(), has_source_file: true },
  { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", book_id: BOOK2_ID, title: "Boshqa kitob maqolasi", order_index: 0, mime_type: "application/pdf", file_size: PDF.length, format: "pdf", page_count: 6, processing_status: "READY", processing_error: null, text_extractable: true, file_version: 1, content_updated_at: null, article_metadata: {}, created_at: now(), updated_at: now(), has_source_file: true },
];

let books, articles, access, progress, annotations, orders, receipts, receiptFiles, paymentInfo, notifications, uploads, categories, users, sessions, twofaEnabled;
const log = [];
const headersSeen = [];
let audit500 = false;
let noContentRange = false;
let delayRule = null; // /__delay?search=Kitob&ms=1500
let failRule = null; // /__fail?path=/catalog&status=429&code=RATE_LIMIT_EXCEEDED — mos yo'llar shu xato bilan javob beradi // B1 workaround'ni sinash uchun toggle (prod'da Content-Range BOR)
// 35: ko'p kitobga chegirma (BACKEND_TASKS.md §2) — `/__pricing?off=1` bilan o'chiriladi (backend qo'llamagan holat)
// 85: admin pog'onalari (id, is_active); public `/pricing` va hisob — faqat faollari
const DEFAULT_PRICING = { currency: "UZS", tiers: [{ id: "tier-2", min_quantity: 2, unit_price: "39000.00", is_active: true }, { id: "tier-3", min_quantity: 3, unit_price: "30000.00", is_active: true }] };
const freshPricing = () => JSON.parse(JSON.stringify(DEFAULT_PRICING));
let pricing = freshPricing();
const activeTiers = () => (pricing?.tiers ?? []).filter((t) => t.is_active !== false);
let __lastTiersBody = null;
// 38: qurilma bog'lash (BACKEND_TASKS.md 3-qism). Testlar har kontekstda yangi X-Device-Id bilan kiradi — limit
// faqat `/__devicelimit?on=1` bilan qo'llanadi; `device_secret` esa har doim birinchi bog'lashda beriladi.
let devices = []; // { id, user, key, secret, name, user_agent, bound_at, last_seen_at, removed_at, removed_by_admin_id, remove_reason }
let deviceLimitOn = false;
let deviceRemovedOnRefresh = false; // /__device-removed?on=1 — refresh → 401 DEVICE_REMOVED
// 38: lug'at (`/me/vocabulary`, BACKEND_TASKS.md 1-qism)
let vocab = [];
let questions = [];
// 44.6: kunlik o'qish seriyasi — userId → { current, longest, total, last } (last: "YYYY-MM-DD", UTC)
let streaks = {};
let appSettings = {}; // 44.8: global ilova sozlamalari (erkin JSON, kalit [a-z0-9_.-])
// 46: yuklangan rasmlar — name → theme → { data, type, v }; URL'da ?v= (almashtirilsa yangilanadi)
let appImages = {};
let appImageVersion = 0;
const appImageUrl = (name, theme) => `/api/v1/app-settings/images/${name}?theme=${theme}&v=${appImages[name][theme].v}`;
const appImagesOut = () => Object.fromEntries(Object.entries(appImages).map(([n, th]) => [n, Object.fromEntries(Object.keys(th).map((t) => [t, appImageUrl(n, t)]))]));
let extraLeaders = []; // /__seed-streak — reytingdagi boshqa o'quvchilar
const todayUtc = () => new Date().toISOString().slice(0, 10);
const bumpStreak = (uid) => {
  const s = streaks[uid] ?? { current: 0, longest: 0, total: 0, last: null };
  const today = todayUtc(); if (s.last === today) return;
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  s.current = s.last === y ? s.current + 1 : 1; s.longest = Math.max(s.longest, s.current); s.total += 1; s.last = today; streaks[uid] = s;
}; // 44.5: { id, article_id, prompt, options, correct_index, explanation, order_index }
const passwords = new Map(); // ro'yxatdan o'tganlar: user.id → parol (44.1)
// 41: avtomatik tarjima (`POST /translate`) — jonli saytdagidek standart o'chiq (503); `/__translate?on=1[&ms=..]`
let translateOn = false;
let translateDelay = 0;
let translateNoUz = false;
// 57: integratsiya sozlamalari — server (env) qiymatlari + admin o'zgartirishlari (db); maxfiylar niqoblanadi
const INTEG_ENV = { "telegram.bot_token": "123456:ENVTOKENabcd", "telegram.bot_username": "articles365_test_bot", "telegram.webhook_secret": "", "telegram.admin_chat_id": "111222333", "telegram.order_group_id": "", "payment.card_number": "8600123412345678", "payment.recipient": "Test Admin", "payment.instructions": "Izohga buyurtma raqamini yozing" };
const INTEG_SECRET = new Set(["telegram.bot_token", "telegram.webhook_secret"]);
let integ = {}, integLog = [], webhookCalls = 0;
// 67: reklama (broadcast) — har GET'da jarayon oldinga siljiydi (5 ta qabul qiluvchi, 1 tasi xato)
let broadcasts = [];
let paymentsUnscoped = false;
let __lastQuizBody = null; // 87: oxirgi test yuborish (o'quvchi) — testlar javob shaklini tekshiradi
let __lastQuestionBody = null; // 87: oxirgi admin savol so'rovi
let questionsDropChoose = false; // 87: /__questions-strict?on=1 — server data.choose ni saqlamaydi (backend kabi bo'lishi mumkin)
let __lastBookBody = null; // 81: oxirgi admin kitob so'rovi (testlar — original_price yuborilganini tekshirish) // 68: /__payments-unscoped?on=1 — holatlar oraliqqa bo'ysunmaydi (jonli backend kabi)
const integOut = () => ({ settings: Object.fromEntries(Object.keys(INTEG_ENV).map((k) => {
  const v = integ[k] ?? (INTEG_ENV[k] || null); const sec = INTEG_SECRET.has(k);
  return [k, { is_secret: sec, is_set: !!v, source: integ[k] != null ? "db" : INTEG_ENV[k] ? "env" : null, ...(sec ? { value: null, preview: v ? `••••${v.slice(-4)}` : null } : { value: v }) }];
})) });
let tgLinkOff = false; // 56: /__tg-link?off=1 — bot sozlanmagan (deep_link: null)
let receiptDelay = 0; // 44.2: /__slow-receipt?ms= — chek javobi kechikadi (100% dan keyingi "tekshirilmoqda" holati) // LibreTranslate (prod'dagi provayder) o'zbek tilini qo'llamaydi → uz uchun 502
const translateLog = [];
const TR = { uz: { quick: "tez", brown: "jigarrang", fox: "tulki", dog: "it", lazy: "dangasa" }, ru: { quick: "быстрый", fox: "лиса", dog: "собака" }, en: {} };
const normWord = (w) => String(w ?? "").toLocaleLowerCase().replace(/[‘’ʻʼ`]/g, "'").replace(/^[\s"'«»“”.,;:!?()[\]{}—–-]+|[\s"'«»“”.,;:!?()[\]{}—–-]+$/g, "").replace(/\s+/g, " ");
const DEVICE_LIMIT = 2;
const activeDevices = (userId) => devices.filter((d) => d.user === userId && !d.removed_at);
const money = (n) => n.toFixed(2);
function quoteFor(bookIds) {
  const list = bookIds.map((id) => books.find((b) => b.id === id)).filter(Boolean).filter((b) => Number(b.price) > 0);
  const q = list.length;
  const tier = activeTiers().filter((t) => t.min_quantity <= q).sort((a, b) => b.min_quantity - a.min_quantity)[0];
  const cap = tier ? Number(tier.unit_price) : null;
  const items = list.map((b) => ({ book_id: b.id, book_title: b.title, list_price: money(Number(b.price)), unit_price: money(cap == null ? Number(b.price) : Math.min(Number(b.price), cap)) }));
  const subtotal = items.reduce((s, i) => s + Number(i.list_price), 0);
  const total = items.reduce((s, i) => s + Number(i.unit_price), 0);
  const next = activeTiers().filter((t) => t.min_quantity > q).sort((a, b) => a.min_quantity - b.min_quantity)[0];
  return { items, quantity: q, subtotal: money(subtotal), discount: money(subtotal - total), total: money(total), currency: pricing.currency, next_tier: next ? { min_quantity: next.min_quantity, unit_price: next.unit_price, add_count: next.min_quantity - q } : null };
}
const orderBookIds = (o) => (o.items?.length ? o.items.map((i) => i.book_id) : [o.book_id]);
// ---- 87: IELTS savollari (13 tur, 4 mexanika) — backend kontrakti kabi
const Q_TYPES = ["MULTIPLE_CHOICE", "TRUE_FALSE_NOT_GIVEN", "YES_NO_NOT_GIVEN", "MATCHING_INFORMATION", "MATCHING_HEADINGS", "MATCHING_FEATURES", "MATCHING_SENTENCE_ENDINGS", "SENTENCE_COMPLETION", "SUMMARY_COMPLETION", "NOTE_COMPLETION", "TABLE_COMPLETION", "FLOW_CHART_COMPLETION", "DIAGRAM_LABEL_COMPLETION"];
const qMech = (t) => (t === "MULTIPLE_CHOICE" ? "choice" : t === "TRUE_FALSE_NOT_GIVEN" || t === "YES_NO_NOT_GIVEN" ? "enum" : t.startsWith("MATCHING_") ? "matching" : "text");
const qPoints = (q) => { const m = qMech(q.type); return m === "matching" ? q.data.items.length : m === "text" ? q.data.blanks : 1; };
const qNorm = (s) => String(s ?? "").toLowerCase().normalize("NFKC").replace(/[\s\p{P}\p{S}]+/gu, "");
const isStrList = (a, min = 1) => Array.isArray(a) && a.length >= min && a.every((x) => typeof x === "string" && x.trim());
function qValid(q) {
  if (!Q_TYPES.includes(q.type) || typeof q.prompt !== "string" || !q.prompt.trim() || !q.data || typeof q.data !== "object" || !q.answer || typeof q.answer !== "object") return false;
  const { data: d, answer: a } = q;
  switch (qMech(q.type)) {
    case "choice": return isStrList(d.options, 2) && Array.isArray(a.correct) && a.correct.length > 0 && new Set(a.correct).size === a.correct.length && a.correct.every((i) => Number.isInteger(i) && i >= 0 && i < d.options.length);
    case "enum": return (q.type === "YES_NO_NOT_GIVEN" ? ["YES", "NO", "NOT_GIVEN"] : ["TRUE", "FALSE", "NOT_GIVEN"]).includes(String(a.value ?? "").toUpperCase());
    case "matching": {
      if (!isStrList(d.items) || !Array.isArray(d.options) || !d.options.length || !d.options.every((o) => o && typeof o.key === "string" && o.key && typeof o.text === "string" && o.text.trim())) return false;
      const keys = new Set(d.options.map((o) => o.key)); if (keys.size !== d.options.length) return false;
      return !!a.map && d.items.every((_, i) => keys.has(a.map[String(i)]));
    }
    case "text": return Number.isInteger(d.blanks) && d.blanks >= 1 && Array.isArray(a.blanks) && a.blanks.length === d.blanks && a.blanks.every((v) => isStrList(v));
  }
  return false;
}
function qGrade(q, r) {
  const { data: d, answer: a } = q; r = r ?? {};
  switch (qMech(q.type)) {
    case "choice": { const sel = [...new Set(r.selected ?? [])].sort(); const ok = JSON.stringify(sel) === JSON.stringify([...a.correct].sort()); return ok ? 1 : 0; }
    case "enum": return String(r.value ?? "").toUpperCase() === String(a.value).toUpperCase() ? 1 : 0;
    case "matching": return d.items.filter((_, i) => (r.map ?? {})[String(i)] === a.map[String(i)]).length;
    case "text": return a.blanks.filter((vs, i) => { const v = qNorm((r.blanks ?? [])[i]); return !!v && vs.some((x) => qNorm(x) === v); }).length;
  }
  return 0;
}
const qReader = ({ id, type, prompt, data, order_index, ...q }) => ({ id, type, prompt, data, points: qPoints({ type, data, ...q }), order_index });
const qAdmin = (q) => ({ ...q, points: qPoints(q) });


function reset(opts = {}) {
  pricing = freshPricing();
  devices = [];
  deviceLimitOn = false;
  deviceRemovedOnRefresh = false;
  vocab = [];
  passwords.clear();
  questions = [];
  questionsDropChoose = false;
  streaks = {};
  appSettings = {};
  appImages = {};
  extraLeaders = [];
  translateOn = false;
  translateDelay = 0;
  translateNoUz = false;
  receiptDelay = 0;
  tgLinkOff = false;
  integ = {}; integLog = []; webhookCalls = 0;
  broadcasts = [];
  paymentsUnscoped = false;
  translateLog.length = 0;
  books = withFree(freshBooks());
  articles = freshArticles();
  access = [{ id: "acc-1", user_id: USER.id, book_id: BOOK_ID, status: "ACTIVE", granted_at: now(), granted_by_admin_id: ADMIN.id, revoked_at: null, revoked_by_admin_id: null, created_at: now(), updated_at: now() }];
  progress = {}; // key: user:article
  annotations = opts.legacy
    ? [{ id: "legacy-1", article_id: ART_ID, type: "HIGHLIGHT", page: 1, location_data: { page: 1, rects: [[0.1, 0.5, 0.3, 0.02]] }, selected_text: "legacy", note_text: null, color: "#93c5fd", label: null, created_at: now(), updated_at: now(), _user: USER.id }]
    : [];
  orders = [];
  receipts = [];
  receiptFiles = {}; // order_id → { data, type } (admin `/admin/orders/{id}/receipt` uchun)
  paymentInfo = { card_number: "8600123412345678", recipient: "Articles365 MChJ", instructions: "To'lov izohiga buyurtma raqamini yozing." };
  notifications = [];
  uploads = [];
  categories = [CAT];
  users = [USER, ADMIN, TWOFA_USER];
  sessions = [];
  twofaEnabled = { [TWOFA_USER.id]: true };
  USER.two_factor_enabled = false; ADMIN.two_factor_enabled = false; TWOFA_USER.two_factor_enabled = true;
  log.length = 0;
  headersSeen.length = 0;
  audit500 = false;
  noContentRange = false;
  failRule = null;
  invalidTokens.clear();
  usedRefresh.clear();
  refreshBroken = false;
}
reset();

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const err = (res, status, code, message, details = null) => json(res, status, { error: { code, message, details } });
const paged = (items, page = 1, size = 20) => ({ items: items.slice((page - 1) * size, page * size), page, page_size: size, total: items.length, pages: Math.max(0, Math.ceil(items.length / size)) });
const readBody = (req) => new Promise((ok) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => ok(d ? JSON.parse(d) : {})); });
const readRaw = (req) => new Promise((ok) => { const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", () => ok(Buffer.concat(chunks))); });
/** Oddiy multipart/form-data parser (mock uchun): { fields: {name: string}, files: {name: {filename, type, data}} } */
function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? "");
  if (!m) return null;
  const boundary = Buffer.from(`--${m[1] ?? m[2]}`);
  const fields = {}, files = {};
  let pos = buf.indexOf(boundary);
  while (pos !== -1) {
    const start = pos + boundary.length;
    if (buf.slice(start, start + 2).toString() === "--") break;
    const next = buf.indexOf(boundary, start);
    if (next === -1) break;
    const part = buf.slice(start + 2, next - 2); // \r\n ... \r\n
    const sep = part.indexOf("\r\n\r\n");
    const head = part.slice(0, sep).toString();
    const body = part.slice(sep + 4);
    const name = /name="([^"]*)"/.exec(head)?.[1];
    const filename = /filename="([^"]*)"/.exec(head)?.[1];
    const type = /content-type:\s*([^\r\n]+)/i.exec(head)?.[1] ?? "application/octet-stream";
    if (name) { if (filename !== undefined) files[name] = { filename, type, data: body }; else fields[name] = body.toString(); }
    pos = next;
  }
  return { fields, files };
}
const isPdfBytes = (b) => b.slice(0, 5).toString() === "%PDF-";
const isImageBytes = (b) => (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || (b[0] === 0x89 && b.slice(1, 4).toString() === "PNG") || (b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP");
const isOpen = (o) => o.status === "PENDING" || o.status === "AWAITING_REVIEW";
const withNames = (x) => { const u = users.find((y) => y.id === x.user_id); const b = books.find((y) => y.id === x.book_id); return { ...x, user_email: u?.email ?? null, user_full_name: u?.full_name ?? null, book_title: b?.title ?? null, ...(x.items ? { items: x.items.map((i) => ({ ...i, book_title: books.find((y) => y.id === i.book_id)?.title ?? null })) } : {}) }; };
const isFreeId = (bookId) => !!books.find((b) => b.id === bookId && b.is_free && b.status === "ACTIVE");
const GUEST = { id: "guest-000", email: null, phone: null, full_name: null, role: "GUEST" };
/** 37: o'qish ruxsati — tekin kitob hamma uchun */
const canRead = (userId, bookId) => hasAccess(userId, bookId) || isFreeId(bookId);
const hasAccess = (userId, bookId) => access.some((a) => a.user_id === userId && a.book_id === bookId && a.status === "ACTIVE");
const progKey = (u, a) => `${u}:${a}`;
const getProg = (u, aid) => progress[progKey(u, aid)] ?? { article_id: aid, current_page: 0, current_location: null, percentage: 0, is_read: false, reading_seconds: 0, last_read_at: null, updated_at: null };
const libraryItem = (userId, b) => {
  const arts = articles.filter((a) => a.book_id === b.id);
  const ps = arts.map((a) => getProg(userId, a.id));
  const acc = access.find((a) => a.user_id === userId && a.book_id === b.id && a.status === "ACTIVE");
  return { book_id: b.id, title: b.title, author: b.author, description: b.description, category_id: b.category_id, category_name: b.category?.name ?? null, has_cover: b.has_cover, price: b.price, article_count: arts.length, read_count: ps.filter((p) => p.is_read).length, overall_percentage: ps.length ? ps.reduce((s, p) => s + p.percentage, 0) / ps.length : 0, last_read_at: ps.map((p) => p.last_read_at).filter(Boolean).sort().at(-1) ?? null, access_granted_at: acc?.granted_at ?? now() };
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const path = url.pathname.replace(/^\/api\/v1/, "");
  const m = req.method;
  const q = url.searchParams;
  log.push(`${m} ${path}${req.headers.range ? " " + req.headers.range : ""}`);
  if (!path.startsWith("/__")) headersSeen.push({ path, secret: req.headers["x-device-secret"] ?? null, ngrok: req.headers["ngrok-skip-browser-warning"], device: req.headers["x-device-id"], auth: !!req.headers.authorization });

  // ---- test yordamchilari
  if (path === "/__reset") { reset({ legacy: q.get("legacy") === "1" }); return json(res, 200, { ok: true }); }
  if (path === "/__log") return json(res, 200, log);
  if (path === "/__headers") return json(res, 200, headersSeen);
  if (path === "/__devices") return json(res, 200, devices);
  if (path === "/__users") return json(res, 200, users);
  if (path === "/__questions") return json(res, 200, questions);
  if (path === "/__last-quiz-body") return json(res, 200, __lastQuizBody ?? {});
  if (path === "/__last-question-body") return json(res, 200, __lastQuestionBody ?? {});
  if (path === "/__questions-strict") { questionsDropChoose = q.get("on") === "1"; return json(res, 200, { questionsDropChoose }); }
  // 87: o'quvchi testi uchun — har mexanikadan namuna savollar (tartib bilan)
  if (path === "/__seed-ielts") {
    const aid = q.get("article"); questions = questions.filter((x) => x.article_id !== aid);
    const mk = (o, i) => questions.push({ id: randomUUID(), article_id: aid, explanation: null, order_index: i, ...o });
    [
      { type: "TRUE_FALSE_NOT_GIVEN", prompt: "Kichik odatlar natijani tez o'zgartiradi.", data: {}, answer: { value: "FALSE" }, explanation: "2-paragraf: natija sekin, lekin barqaror. [p. 3]" },
      { type: "TRUE_FALSE_NOT_GIVEN", prompt: "Muallif 21 kunlik qoida haqida yozadi.", data: {}, answer: { value: "NOT_GIVEN" } },
      { type: "MULTIPLE_CHOICE", prompt: "Odatni nima mustahkamlaydi?", data: { options: ["Iroda", "Takrorlash", "Omad", "Pul"] }, answer: { correct: [1] } },
      { type: "MULTIPLE_CHOICE", prompt: "Qaysi IKKITASI muallif tavsiyasi?", data: { options: ["Kichik boshlash", "Hammasini birdan", "Muhitni o'zgartirish", "Kutish"], choose: 2 }, answer: { correct: [0, 2] } },
      { type: "MATCHING_HEADINGS", prompt: "A–C paragraflar uchun sarlavha tanlang.", data: { items: ["Paragraf A", "Paragraf B", "Paragraf C"], options: [{ key: "i", text: "Kichik qadamlar" }, { key: "ii", text: "Muhitning roli" }, { key: "iii", text: "Natijani o'lchash" }, { key: "iv", text: "Motivatsiya afsonasi" }] }, answer: { map: { 0: "i", 1: "ii", 2: "iii" } }, explanation: "[p. 2]" },
      { type: "SENTENCE_COMPLETION", prompt: "Matndan BIR so'z bilan to'ldiring.", data: { blanks: 2, text: "Odat ___ kun ichida shakllanadi va ___ talab qiladi.", word_limit: 1 }, answer: { blanks: [["66", "oltmish olti"], ["sabr", "sabr-toqat"]] }, explanation: "3-paragraf." },
      { type: "TABLE_COMPLETION", prompt: "Jadvalni to'ldiring.", data: { blanks: 2, text: "Bosqich | Tavsif\nBoshlash | ___\nTakrorlash | ___", word_limit: 2 }, answer: { blanks: [["kichik qadam"], ["har kuni"]] } },
    ].forEach(mk);
    return json(res, 200, { count: questions.filter((x) => x.article_id === aid).length });
  }
  // 49: test uchun — sozlamani to'g'ridan-to'g'ri yozish (masalan, eski xavfli fon rangi)
  if (path === "/__app-settings" && q.get("set")) { appSettings = { ...appSettings, ...JSON.parse(q.get("set")) }; return json(res, 200, appSettings); }
  if (path === "/__app-settings") return json(res, 200, appSettings);
  if (path === "/__app-images") return json(res, 200, Object.fromEntries(Object.entries(appImages).map(([n, th]) => [n, Object.fromEntries(Object.entries(th).map(([t, x]) => [t, { type: x.type, size: x.data.length, v: x.v }]))])));
  if (path === "/__streaks") return json(res, 200, streaks);
  // ?user=<id>&current=&longest=&total=&today=1 — foydalanuvchi seriyasini o'rnatish; ?leaders=N — soxta o'quvchilar
  if (path === "/__seed-streak") {
    if (q.get("user")) { const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10); streaks[q.get("user")] = { current: Number(q.get("current") ?? 0), longest: Number(q.get("longest") ?? q.get("current") ?? 0), total: Number(q.get("total") ?? q.get("current") ?? 0), last: q.get("today") === "1" ? todayUtc() : y }; }
    if (q.get("leaders")) extraLeaders = Array.from({ length: Number(q.get("leaders")) }, (_, i) => ({ display_name: `O'quvchi ${i + 1}`, current_streak: Math.max(1, 40 - i), longest_streak: Math.max(1, 45 - i) }));
    return json(res, 200, { streaks, extraLeaders: extraLeaders.length });
  }
  // 44.4: grafik uchun bir necha oylik tasdiqlangan buyurtmalar (oy: yyyy-mm, miqdor) — ?months=6
  if (path === "/__seed-payments") {
    const n = Number(q.get("months") ?? 6); const base = new Date(Date.UTC(2026, 9, 15));
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(base); d.setUTCMonth(base.getUTCMonth() - i);
      for (let k = 0; k <= (i % 3); k++) {
        const bk = books[2 + ((i + k) % 5)];
        orders.push({ id: randomUUID(), user_id: USER.id, book_id: bk.id, amount: bk.price === "0" ? "49000.00" : bk.price, status: "APPROVED", receipt_note: null, has_receipt_file: false, reviewed_by_admin_id: ADMIN.id, reviewed_at: d.toISOString(), reject_reason: null, created_at: d.toISOString(), updated_at: d.toISOString() });
      }
    }
    // 52: `mixed=1` — boshqa holatlar ham (rad etilgan 2, tekshiruvda 1, kutilmoqda 1) — holat filtri uchun
    if (q.get("mixed") === "1") {
      const mk = (status, bk) => orders.push({ id: randomUUID(), user_id: USER.id, book_id: bk.id, amount: bk.price === "0" ? "49000.00" : bk.price, status, receipt_note: null, has_receipt_file: status !== "PENDING", reviewed_by_admin_id: null, reviewed_at: null, reject_reason: status === "REJECTED" ? "test" : null, created_at: base.toISOString(), updated_at: base.toISOString() });
      mk("REJECTED", books[2]); mk("REJECTED", books[3]); mk("AWAITING_REVIEW", books[4]); mk("PENDING", books[5]);
    }
    return json(res, 200, { orders: orders.length });
  }
  if (path === "/__last-book-body") return json(res, 200, __lastBookBody ?? {});
  if (path === "/__payments-unscoped") { paymentsUnscoped = q.get("on") === "1"; return json(res, 200, { paymentsUnscoped }); }
  if (path === "/__broadcasts") return json(res, 200, broadcasts);
  if (path === "/__integrations") return json(res, 200, { db: integ, log: integLog, webhookCalls });
  if (path === "/__tg-link") { tgLinkOff = q.get("off") === "1"; return json(res, 200, { tgLinkOff }); }
  // 56: bot oqimini taqlid — buyurtma holatini o'zgartirish (botda chek yuborildi → AWAITING_REVIEW va h.k.)
  if (path === "/__set-order") { const o = orders.find((x) => x.id === q.get("id")); if (!o) return err(res, 404, "ORDER_NOT_FOUND", "Not found"); Object.assign(o, { status: q.get("status"), has_receipt_file: q.get("status") !== "PENDING", updated_at: now() }); return json(res, 200, o); }
  if (path === "/__slow-receipt") { receiptDelay = Number(q.get("ms") ?? 0); return json(res, 200, { receiptDelay }); }
  if (path === "/__devicelimit") { deviceLimitOn = q.get("on") === "1"; return json(res, 200, { deviceLimitOn }); }
  if (path === "/__device-removed") { deviceRemovedOnRefresh = q.get("on") === "1"; return json(res, 200, { deviceRemovedOnRefresh }); }
  if (path === "/__vocab") return json(res, 200, vocab);
  if (path === "/__translate") { translateOn = q.get("on") === "1"; translateDelay = Number(q.get("ms") ?? 0); translateNoUz = q.get("nouz") === "1"; return json(res, 200, { translateOn, translateDelay, translateNoUz }); }
  if (path === "/__translate-log") return json(res, 200, translateLog);
  if (path === "/__annotations") return json(res, 200, annotations);
  if (path === "/__progress") return json(res, 200, progress);
  if (path === "/__uploads") return json(res, 200, uploads);
  if (path === "/__orders") return json(res, 200, orders);
  if (path === "/__receipts") return json(res, 200, receipts);
  // /__payment?empty=1 — prod'dagidek bo'sh rekvizitlar (B21); parametrsiz — to'ldirilgan
  if (path === "/__payment") { if (q.get("empty") === "1") paymentInfo = { card_number: "", recipient: "", instructions: "" }; return json(res, 200, paymentInfo); }
  if (path === "/__notify") { notifications.unshift({ id: randomUUID(), type: "GENERAL", title: q.get("title") ?? "Xabar", body: q.get("body") ?? null, is_read: false, meta: {}, created_at: now(), _user: USER.id }); return json(res, 200, { ok: true }); }
  if (path === "/__articles") return json(res, 200, articles);
  if (path === "/__books") return json(res, 200, books);
  if (path === "/__set500") { audit500 = q.get("on") === "1"; return json(res, 200, { audit500 }); }
  if (path === "/__expire") { if (q.get("all") === "1") refreshBroken = true; if (q.get("token")) invalidTokens.add(q.get("token")); return json(res, 200, { invalid: [...invalidTokens], refreshBroken }); }
  if (path === "/__setbig") {
    BIG_PDF = q.get("path") ? readFileSync(q.get("path")) : null;
    books = books.filter((b) => b.id !== BOOK_BIG_ID); articles = articles.filter((a) => a.id !== ART_BIG_ID); access = access.filter((a) => a.book_id !== BOOK_BIG_ID);
    if (BIG_PDF) {
      books.push({ id: BOOK_BIG_ID, title: "Katta kitob", author: null, description: null, price: "0", status: "ACTIVE", category_id: null, category: null, book_metadata: {}, created_at: now(), updated_at: now(), has_cover: false });
      articles.push({ id: ART_BIG_ID, book_id: BOOK_BIG_ID, title: "Katta maqola (60 MB)", order_index: 0, mime_type: "application/pdf", file_size: BIG_PDF.length, format: "pdf", page_count: 300, processing_status: "READY", processing_error: null, text_extractable: false, file_version: 1, content_updated_at: null, article_metadata: {}, created_at: now(), updated_at: now(), has_source_file: true });
      access.push({ id: "acc-big", user_id: USER.id, book_id: BOOK_BIG_ID, status: "ACTIVE", granted_at: now(), granted_by_admin_id: ADMIN.id, revoked_at: null, revoked_by_admin_id: null, created_at: now(), updated_at: now() });
    }
    return json(res, 200, { size: BIG_PDF?.length ?? 0 });
  }
  if (path === "/__fail") { failRule = q.get("off") ? null : { path: q.get("path") ?? "/", status: Number(q.get("status") ?? 500), code: q.get("code") ?? "INTERNAL_ERROR" }; return json(res, 200, { failRule }); }
  if (failRule && path.startsWith(failRule.path)) return err(res, failRule.status, failRule.code, `Injected ${failRule.status}`);
  if (path === "/__setnocr") { noContentRange = q.get("on") === "1"; return json(res, 200, { noContentRange }); }
  // Jonli qidiruv poygasi: berilgan `search` qiymatli so'rov `ms` kechikadi (eskirgan javob keyin keladi)
  if (path === "/__delay") { delayRule = q.get("off") ? null : { search: q.get("search") ?? "", ms: Number(q.get("ms") ?? 1000) }; return json(res, 200, { delayRule }); }
  if (delayRule && q.get("search") === delayRule.search) await new Promise((r) => setTimeout(r, delayRule.ms));

  if (path === "/__pricing") { pricing = q.get("off") === "1" ? null : freshPricing(); return json(res, 200, { pricing }); }
  if (path === "/__last-tiers-body") return json(res, 200, __lastTiersBody ?? {});

  // ---- public
  if (path === "/pricing" && m === "GET") return pricing ? json(res, 200, { currency: pricing.currency, tiers: activeTiers().sort((a, b) => a.min_quantity - b.min_quantity).map(({ min_quantity, unit_price }) => ({ min_quantity, unit_price })) }) : err(res, 404, "NOT_FOUND", "Not Found");
  if (path === "/catalog") {
    const s = (q.get("search") ?? "").toLowerCase();
    const fq = q.get("is_free"); // 45: true — kunlik (tekin), false — pullik
    const all = books.filter((b) => b.status === "ACTIVE").filter((b) => fq === null || !!b.is_free === (fq === "true")).filter((b) => !q.get("category_id") || b.category_id === q.get("category_id")).filter((b) => !s || b.title.toLowerCase().includes(s) || (b.author ?? "").toLowerCase().includes(s) || (b.description ?? "").toLowerCase().includes(s))
      .map((b) => ({ book_id: b.id, title: b.title, author: b.author, description: b.description, category_name: b.category?.name ?? null, price: b.price, is_free: !!b.is_free, ...discount(b), has_cover: b.has_cover, article_count: articles.filter((a) => a.book_id === b.id).length }));
    return json(res, 200, paged(all, Number(q.get("page") ?? 1), Number(q.get("page_size") ?? 20)));
  }
  const cm0 = /^\/catalog\/([^/]+)(\/cover)?$/.exec(path);
  if (cm0) {
    const b = books.find((x) => x.id === cm0[1] && x.status === "ACTIVE");
    if (!b) return err(res, 404, "BOOK_NOT_FOUND", "Book not found");
    if (cm0[2]) return err(res, 404, "NOT_FOUND", "Cover not found");
    return json(res, 200, { book_id: b.id, title: b.title, author: b.author, description: b.description, category_name: b.category?.name ?? null, price: b.price, is_free: !!b.is_free, ...discount(b), has_cover: b.has_cover, article_count: articles.filter((a) => a.book_id === b.id).length });
  }
  if (path === "/categories") return json(res, 200, categories.filter((c) => c.status === "ACTIVE"));
  if (path === "/app-settings" && m === "GET") return json(res, 200, { settings: appSettings, images: appImagesOut() });
  const aim = /^\/app-settings\/images\/([^/]+)$/.exec(path);
  if (aim && m === "GET") {
    const set = appImages[aim[1]]; const th = q.get("theme") === "dark" ? "dark" : "light";
    const img = set?.[th] ?? set?.[th === "dark" ? "light" : "dark"];
    if (!img) return err(res, 404, "IMAGE_NOT_FOUND", "Image not found");
    res.writeHead(200, { "Content-Type": img.type, "Content-Length": img.data.length, "Cache-Control": "public, max-age=300" });
    return res.end(img.data);
  }
  if (m === "POST" && path === "/auth/login") {
    const b = await readBody(req);
    if (b.identifier === "limit@articles365.local") return err(res, 403, "DEVICE_NOT_ALLOWED", "This account is already linked to 2 devices", { limit: 2, devices: [{ name: "Chrome · Windows", bound_at: now(), last_seen_at: now() }, { name: "Safari · iOS", bound_at: now(), last_seen_at: now() }] });
    if (b.identifier === TWOFA_USER.email) {
      if (b.password !== "User12345!") return err(res, 401, "INVALID_CREDENTIALS", "Invalid credentials");
      if (!b.totp_code) return err(res, 401, "TOTP_REQUIRED", "TOTP code required");
      if (b.totp_code !== "123456") return err(res, 401, "INVALID_TOTP", "Invalid code");
      return json(res, 200, { access_token: "access-token-2fa", refresh_token: "refresh-2fa", token_type: "bearer", expires_in: 900, user: TWOFA_USER });
    }
    if (b.identifier === ADMIN.email && b.password === "Admin12345!") { sessions.push({ id: randomUUID(), user: ADMIN.id, device: b.device_name }); return json(res, 200, { access_token: "access-token-admin", refresh_token: "refresh-a", token_type: "bearer", expires_in: 900, user: ADMIN }); }
    if (b.identifier === USER.email && b.password === "User12345!") {
      // 38: qurilmani bog'lash — X-Device-Id bo'yicha; nusxalangan id + noto'g'ri sir → DEVICE_NOT_ALLOWED
      const key = req.headers["x-device-id"] ?? "no-device"; const secret = req.headers["x-device-secret"] ?? null;
      let dev = activeDevices(USER.id).find((d) => d.key === key); let newSecret = null;
      if (dev && dev.secret && secret && secret !== dev.secret) return err(res, 403, "DEVICE_NOT_ALLOWED", "Device secret mismatch", { limit: DEVICE_LIMIT, devices: activeDevices(USER.id).map(({ name, bound_at, last_seen_at }) => ({ name, bound_at, last_seen_at })) });
      if (!dev) {
        if (deviceLimitOn && activeDevices(USER.id).length >= DEVICE_LIMIT) return err(res, 403, "DEVICE_NOT_ALLOWED", "This account is already linked to 2 devices", { limit: DEVICE_LIMIT, devices: activeDevices(USER.id).map(({ name, bound_at, last_seen_at }) => ({ name, bound_at, last_seen_at })) });
        newSecret = "secret-" + randomUUID();
        dev = { id: randomUUID(), user: USER.id, key, secret: newSecret, name: b.device_name ?? null, user_agent: req.headers["user-agent"] ?? null, bound_at: now(), last_seen_at: now(), removed_at: null, removed_by_admin_id: null, remove_reason: null };
        devices.push(dev);
      }
      dev.last_seen_at = now();
      sessions.push({ id: randomUUID(), user: USER.id, device: b.device_name });
      return json(res, 200, { access_token: "access-token-1", refresh_token: "refresh-1", token_type: "bearer", expires_in: 900, user: USER, device_secret: newSecret });
    }
    // Ro'yxatdan o'tgan foydalanuvchi (telefon yoki email bilan)
    const reg = users.find((x) => x.id !== USER.id && (x.phone === b.identifier || (x.email && x.email === b.identifier)) && passwords.get(x.id) === b.password);
    if (reg) { TOKENS["access-token-new"] = reg; return json(res, 200, { access_token: "access-token-new", refresh_token: "refresh-new", token_type: "bearer", expires_in: 900, user: reg }); }
    return err(res, 401, "INVALID_CREDENTIALS", "Invalid credentials");
  }
  if (m === "POST" && path === "/auth/register") {
    const b = await readBody(req);
    if (!b.password) return err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ type: "missing", loc: ["body", "password"], msg: "Field required" }]);
    // 44.1: email yoki telefondan kamida bittasi; telefon — E.164
    if (!b.email && !b.phone) return err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ loc: ["body"], msg: "email or phone required" }]);
    if (b.phone && !/^\+\d{10,15}$/.test(b.phone)) return err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ loc: ["body", "phone"], msg: "Invalid phone" }]);
    if (b.email === USER.email || (b.phone && users.some((x) => x.phone === b.phone))) return err(res, 409, "ALREADY_EXISTS", "User exists");
    const u = { ...USER, id: randomUUID(), email: b.email ?? null, phone: b.phone ?? null, full_name: b.full_name ?? null };
    users.push(u); TOKENS["access-token-new"] = u; passwords.set(u.id, b.password);
    return json(res, 201, u);
  }
  if (m === "POST" && path === "/auth/refresh") {
    const b = await readBody(req);
    if (deviceRemovedOnRefresh) return err(res, 401, "DEVICE_REMOVED", "This device was removed from the account");
    if (refreshBroken || !b.refresh_token || usedRefresh.has(b.refresh_token)) return err(res, 401, "INVALID_TOKEN", "Invalid refresh token");
    usedRefresh.add(b.refresh_token);
    // rotatsiya: refresh-1 → access-token-1b/refresh-1b → access-token-1c/refresh-1c
    const chain = { "refresh-1": ["access-token-1b", "refresh-1b"], "refresh-1b": ["access-token-1c", "refresh-1c"], "refresh-a": ["access-token-admin", "refresh-a2"], "refresh-a2": ["access-token-admin", "refresh-a3"] };
    const [tok, nextRefresh] = chain[b.refresh_token] ?? ["access-token-1", b.refresh_token + "x"];
    return json(res, 200, { access_token: tok, refresh_token: nextRefresh, token_type: "bearer", expires_in: 900 });
  }

  const auth = req.headers.authorization ?? "";
  const rawTok = auth.replace("Bearer ", "");
  if (invalidTokens.has(rawTok)) return err(res, 401, "TOKEN_EXPIRED", "Token expired");
  let me = TOKENS[rawTok] ?? (auth === "Bearer access-token-new" ? users.at(-1) : undefined);
  // 37: tekin kitob — reader (meta, content, watermark, maqolalar, mundarija, qidiruv) kirishsiz ham ochiq
  if (!me && !auth && m === "GET") {
    const fb = /^\/reader\/books\/([^/]+)\/articles$/.exec(path)?.[1];
    const fa = /^\/reader\/articles\/([^/]+)(?:\/content|\/watermark|\/questions)?$/.exec(path)?.[1] ?? /^\/articles\/([^/]+)\/(?:toc|search)$/.exec(path)?.[1];
    const bid = fb ?? articles.find((x) => x.id === fa)?.book_id;
    if (bid && isFreeId(bid)) me = GUEST;
  }
  if (!me) return err(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");

  if (path === "/auth/me" || (m === "GET" && path === "/me")) return json(res, 200, me);
  if (m === "POST" && path === "/auth/logout") return json(res, 200, { message: "Logged out" });
  if (m === "PATCH" && path === "/me") { const b = await readBody(req); Object.assign(me, { full_name: b.full_name ?? me.full_name, updated_at: now() }); return json(res, 200, me); }
  if (m === "POST" && path === "/me/password") { const b = await readBody(req); if (b.old_password !== "User12345!" && b.old_password !== "Admin12345!") return err(res, 400, "INVALID_CREDENTIALS", "Old password is wrong"); if ((b.new_password ?? "").length < 8) return err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ loc: ["body", "new_password"], msg: "too short" }]); return json(res, 200, { message: "Password changed" }); }
  if (m === "POST" && path === "/me/2fa/setup") return json(res, 200, { secret: "JBSWY3DPEHPK3PXP", provisioning_uri: `otpauth://totp/Articles365:${me.email}?secret=JBSWY3DPEHPK3PXP&issuer=Articles365` });
  if (m === "POST" && path === "/me/2fa/enable") { const b = await readBody(req); if (b.code !== "123456") return err(res, 400, "INVALID_TOTP", "Invalid code"); twofaEnabled[me.id] = true; me.two_factor_enabled = true; return json(res, 200, { message: "2FA enabled" }); }
  if (m === "POST" && path === "/me/2fa/disable") { const b = await readBody(req); if (b.code !== "123456") return err(res, 400, "INVALID_TOTP", "Invalid code"); twofaEnabled[me.id] = false; me.two_factor_enabled = false; return json(res, 200, { message: "2FA disabled" }); }
  if (path === "/sessions" && m === "GET") return json(res, 200, [{ id: "s-cur", ip_address: "127.0.0.1", user_agent: req.headers["user-agent"], created_at: now(), last_active_at: now(), expires_at: now(), revoked_at: null, is_current: true }, { id: "s-old", ip_address: "10.0.0.2", user_agent: "Mozilla/5.0 (iPhone) Safari/604.1", created_at: now(), last_active_at: now(), expires_at: now(), revoked_at: null, is_current: false }, { id: "s-rev", ip_address: "10.0.0.3", user_agent: "python-httpx/0.28", created_at: now(), last_active_at: now(), expires_at: now(), revoked_at: now(), is_current: false }]);
  if (path.startsWith("/sessions/") && m === "DELETE") return json(res, 200, { message: "Session revoked" });

  // ---- library / reader
  if (path === "/library") {
    const sort = q.get("sort") ?? "granted";
    if (!["granted", "title", "recent"].includes(sort)) return err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ type: "literal_error", loc: ["query", "sort"], msg: "Input should be 'granted', 'title' or 'recent'" }]);
    const s = (q.get("search") ?? "").toLowerCase();
    let items = books.filter((b) => hasAccess(me.id, b.id)).filter((b) => !s || b.title.toLowerCase().includes(s)).map((b) => libraryItem(me.id, b));
    if (sort === "title") items = items.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "recent") items = items.sort((a, b) => (b.last_read_at ?? "").localeCompare(a.last_read_at ?? ""));
    return json(res, 200, paged(items, Number(q.get("page") ?? 1), Number(q.get("page_size") ?? 20)));
  }
  const lm = /^\/library\/([^/]+)$/.exec(path);
  if (lm) {
    const b = books.find((x) => x.id === lm[1]);
    if (!b) return err(res, 404, "BOOK_NOT_FOUND", "Book not found");
    if (!hasAccess(me.id, b.id)) return err(res, 403, "BOOK_ACCESS_DENIED", "Access to this book has not been granted");
    return json(res, 200, libraryItem(me.id, b));
  }
  const rb = /^\/reader\/books\/([^/]+)\/(articles|cover)$/.exec(path);
  if (rb) {
    const [, bid, what] = rb;
    if (!books.find((b) => b.id === bid)) return err(res, 404, "BOOK_NOT_FOUND", "Book not found");
    if (!canRead(me.id, bid)) return err(res, 403, "BOOK_ACCESS_DENIED", "Access to this book has not been granted");
    if (what === "cover") return err(res, 404, "COVER_NOT_FOUND", "No cover");
    if (q.get("size") && !/^(original|thumb|medium)$/.test(q.get("size"))) return err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ loc: ["query", "size"], msg: "String should match pattern '^(original|thumb|medium)$'" }]);
    return json(res, 200, articles.filter((a) => a.book_id === bid).sort((a, b) => a.order_index - b.order_index).map((a) => { const p = getProg(me.id, a.id); return { article_id: a.id, title: a.title, order_index: a.order_index, page_count: a.page_count, processing_status: a.processing_status, reading_percentage: p.percentage, current_page: p.current_page, is_read: p.is_read }; }));
  }
  // ---- 44.5: maqola testi
  const rq = /^\/reader\/articles\/([^/]+)\/(questions|quiz)$/.exec(path);
  if (rq) {
    const a = articles.find((x) => x.id === rq[1]);
    if (!a) return err(res, 404, "ARTICLE_NOT_FOUND", "Article not found");
    if (!canRead(me.id, a.book_id)) return err(res, 403, "BOOK_ACCESS_DENIED", "Access to this book has not been granted");
    const qs = questions.filter((q) => q.article_id === a.id).sort((x, y) => x.order_index - y.order_index);
    // 87: o'quvchiga — answer'siz; baholash: matching/completion'da har element/bo'sh joy 1 ball
    if (rq[2] === "questions" && m === "GET") return json(res, 200, qs.map(qReader));
    if (rq[2] === "quiz" && m === "POST") {
      if (me === GUEST) return err(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      const b = await readBody(req); __lastQuizBody = b; const ans = new Map((b.answers ?? []).map((x) => [x.question_id, x.response]));
      const results = qs.map((q) => { const max = qPoints(q); const sc = qGrade(q, ans.get(q.id)); return { question_id: q.id, type: q.type, is_correct: sc === max, score: sc, max_score: max, correct_answer: q.answer, explanation: q.explanation ?? null }; });
      const score = results.reduce((s2, r) => s2 + r.score, 0), total = results.reduce((s2, r) => s2 + r.max_score, 0);
      return json(res, 200, { score, total, percentage: total ? Math.round((score / total) * 10000) / 100 : 0, results });
    }
  }
  const ra = /^\/reader\/articles\/([^/]+)(\/content|\/watermark)?$/.exec(path);
  if (ra) {
    const [, aid, sub] = ra;
    const a = articles.find((x) => x.id === aid);
    if (!a) return err(res, 404, "ARTICLE_NOT_FOUND", "Article not found");
    if (!canRead(me.id, a.book_id)) return err(res, 403, "BOOK_ACCESS_DENIED", "Access to this book has not been granted");
    if (!sub) { const p = getProg(me.id, aid); return json(res, 200, { article_id: aid, book_id: a.book_id, title: a.title, format: a.format, mime_type: a.mime_type, page_count: a.page_count, processing_status: a.processing_status, text_extractable: a.text_extractable, file_version: a.file_version, content_updated_at: null, reading_percentage: p.percentage, current_page: p.current_page, features: { can_read: a.processing_status === "READY", can_download: false, can_print: false, can_search: a.text_extractable, has_toc: aid === ART_ID, watermark: a.watermark_enabled !== false && books.find((x) => x.id === a.book_id)?.watermark_enabled !== false && !isFreeId(a.book_id) } }); }
    if (sub === "/watermark" && me === GUEST) return json(res, 200, { watermark_text: `Articles365 • mehmon • 127.0.0.x`, trace_id: "TRACE-GUEST", user_ref: "GUEST", issued_at: Math.floor(Date.now() / 1000), signature: "guest" });
    if (sub === "/watermark") return json(res, 200, { watermark_text: `U-${me.id.slice(0, 5).toUpperCase()} • u***@articles365.local`, trace_id: "TRACE-42", user_ref: "U-TEST", issued_at: Math.floor(Date.now() / 1000), signature: "abc" });
    if (a.processing_status !== "READY") return err(res, 409, "ARTICLE_NOT_READY", "Article is not ready");
    const FILE = aid === ART_BIG_ID ? BIG_PDF : PDF;
    if (!FILE) return err(res, 409, "ARTICLE_NOT_READY", "Big PDF not loaded (/__setbig)");
    const range = req.headers.range;
    if (!range) { res.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": FILE.length }); return res.end(FILE); }
    const mm = /bytes=(\d+)-(\d*)/.exec(range);
    const start = Number(mm[1]);
    const end = mm[2] ? Math.min(Number(mm[2]), FILE.length - 1) : FILE.length - 1;
    if (start >= FILE.length) return err(res, 416, "RANGE_NOT_SATISFIABLE", "Requested range not satisfiable", { size: FILE.length });
    const chunk = FILE.subarray(start, end + 1);
    const hdr = { "Content-Type": "application/pdf", "Content-Length": chunk.length, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" };
    if (!noContentRange) Object.assign(hdr, { "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${FILE.length}` });
    res.writeHead(206, hdr);
    return res.end(chunk);
  }
  const art = /^\/articles\/([^/]+)\/(progress|reading-heartbeat|mark-read|annotations|search|toc)(?:\/([^/]+))?$/.exec(path);
  if (art) {
    const [, aid, what, sub] = art;
    const a = articles.find((x) => x.id === aid);
    if (!a) return err(res, 404, "ARTICLE_NOT_FOUND", "Article not found");
    if (!canRead(me.id, a.book_id)) return err(res, 403, "BOOK_ACCESS_DENIED", "Access to this book has not been granted");
    const key = progKey(me.id, aid);
    if (what === "progress") {
      if (m === "PUT") { bumpStreak(me.id); const b = await readBody(req); progress[key] = { ...getProg(me.id, aid), current_page: b.current_page, current_location: b.current_location ?? null, percentage: b.percentage ?? 0, updated_at: now() }; }
      return json(res, 200, getProg(me.id, aid));
    }
    if (what === "reading-heartbeat") { bumpStreak(me.id); const b = await readBody(req); const p = getProg(me.id, aid); progress[key] = { ...p, reading_seconds: p.reading_seconds + (b.seconds ?? 0), current_page: b.current_page ?? p.current_page, last_read_at: now(), updated_at: now() }; return json(res, 200, progress[key]); }
    if (what === "mark-read") { progress[key] = { ...getProg(me.id, aid), is_read: q.get("is_read") === "true", updated_at: now() }; return json(res, 200, progress[key]); }
    if (what === "toc") return json(res, 200, { article_id: aid, entries: aid === ART_ID ? [{ level: 1, title: "Bob 1", page: 1 }, { level: 1, title: "Bob 2", page: 3 }, { level: 2, title: "2.1 Kichik bo'lim", page: 4 }] : [] });
    if (what === "search") { const s = q.get("q") ?? ""; return json(res, 200, { article_id: aid, query: s, text_available: a.text_extractable, total_matches: 1, matches: [{ page: 2, snippet: `... ${s} of page 2 ...` }] }); }
    if (what === "annotations") {
      const mine = annotations.filter((x) => x.article_id === aid && x._user === me.id);
      if (m === "GET") { const type = q.get("type"); return json(res, 200, mine.filter((x) => !type || x.type === type).map(({ _user, ...x }) => x)); }
      if (m === "POST") { const b = await readBody(req); if (b.type === "HIGHLIGHT" && b.page == null && !b.location_data) return err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ loc: ["body"], msg: "HIGHLIGHT requires page or location_data" }]); const x = { id: randomUUID(), article_id: aid, type: b.type, page: b.page ?? null, location_data: b.location_data ?? null, selected_text: b.selected_text ?? null, note_text: b.note_text ?? null, color: b.color ?? null, label: b.label ?? null, created_at: now(), updated_at: now(), _user: me.id }; annotations.unshift(x); const { _user, ...out } = x; return json(res, 201, out); }
      const x = mine.find((y) => y.id === sub);
      if (!x) return err(res, 404, "ANNOTATION_NOT_FOUND", "Not found");
      if (m === "PATCH") { const b = await readBody(req); Object.assign(x, b, { updated_at: now() }); const { _user, ...out } = x; return json(res, 200, out); }
      if (m === "DELETE") { annotations = annotations.filter((y) => y.id !== x.id); return json(res, 200, { message: "Annotation deleted" }); }
    }
  }

  // ---- 41: avtomatik tarjima
  if (path === "/translate" && m === "POST") {
    const b = await readBody(req);
    translateLog.push(b);
    if (!translateOn) return err(res, 503, "TRANSLATE_UNAVAILABLE", "Translation is not configured");
    const text = String(b.text ?? "").trim(); const target = b.target_lang ?? "uz";
    if (!text || text.length > 200 || !["uz", "ru", "en"].includes(target)) return err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ loc: ["body", "text"], msg: "Invalid" }]);
    if (translateDelay) await new Promise((r) => setTimeout(r, translateDelay));
    if (translateNoUz && target === "uz") return err(res, 502, "TRANSLATE_FAILED", "Translation provider failed");
    const same = /^(salom|kitob)$/i.test(text) && target === "uz";
    const tr = same ? null : (TR[target][normWord(text)] ?? `${text} (${target})`);
    return json(res, 200, { text, translation: tr, detected_source_lang: same ? "uz" : "en", target_lang: target, same_language: same, provider: "google", cached: false });
  }

  // ---- 44.6: seriya va reyting
  if (path === "/me/streak" && m === "GET") {
    const st = streaks[me.id] ?? { current: 0, longest: 0, total: 0, last: null };
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const current = st.last === todayUtc() || st.last === y ? st.current : 0;
    return json(res, 200, { current_streak: current, longest_streak: st.longest, total_days: st.total, last_activity_date: st.last, active_today: st.last === todayUtc() });
  }
  if (path === "/streak/leaderboard" && m === "GET") {
    const limit = Math.min(100, Number(q.get("limit") ?? 20));
    const mine = users.filter((u) => streaks[u.id]).map((u) => ({ display_name: u.full_name ?? u.email ?? "—", current_streak: streaks[u.id].current, longest_streak: streaks[u.id].longest, is_me: u.id === me.id }));
    const all = [...extraLeaders.map((x) => ({ ...x, is_me: false })), ...mine].sort((a, b) => b.current_streak - a.current_streak || b.longest_streak - a.longest_streak).map((x, i) => ({ rank: i + 1, ...x }));
    return json(res, 200, { entries: all.slice(0, limit), me: all.find((x) => x.is_me) ?? null });
  }

  // ---- 38: bog'langan qurilmalar
  if (path === "/me/devices" && m === "GET") {
    const key = req.headers["x-device-id"];
    return json(res, 200, { limit: DEVICE_LIMIT, items: activeDevices(me.id).map((d) => ({ id: d.id, name: d.name, bound_at: d.bound_at, last_seen_at: d.last_seen_at, is_current: d.key === key })) });
  }

  // ---- 38: lug'at
  const artVocab = /^\/articles\/([^/]+)\/vocabulary$/.exec(path);
  const vocabOut = ({ _user, _norm, ...v }) => { const a = articles.find((x) => x.id === v.article_id); const bk = books.find((x) => x.id === a?.book_id); return { ...v, article_title: a?.title ?? null, book_id: a?.book_id ?? null, book_title: bk?.title ?? null }; };
  if (artVocab && m === "GET") return json(res, 200, vocab.filter((v) => v._user === me.id && v.article_id === artVocab[1]).map(vocabOut));
  if (path === "/me/vocabulary" && m === "GET") {
    const s = normWord(q.get("search") ?? ""); const sort = q.get("sort") ?? "newest";
    let list = vocab.filter((v) => v._user === me.id).filter((v) => !s || v._norm.includes(s) || normWord(v.translation).includes(s));
    list = list.slice().sort((a, b) => (sort === "alpha" ? a.word.localeCompare(b.word) : sort === "oldest" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)));
    return json(res, 200, paged(list.map(vocabOut), Number(q.get("page") ?? 1), Math.min(100, Number(q.get("page_size") ?? 24))));
  }
  if (path === "/me/vocabulary" && m === "POST") {
    const b = await readBody(req);
    const a = articles.find((x) => x.id === b.article_id);
    if (!a || !canRead(me.id, a.book_id)) return err(res, 403, "BOOK_ACCESS_DENIED", "Access to this book has not been granted");
    const norm = normWord(b.word);
    if (!norm) return err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ loc: ["body", "word"], msg: "Empty word" }]);
    const dup = vocab.find((v) => v._user === me.id && v._norm === norm);
    if (dup) return err(res, 409, "VOCAB_DUPLICATE", "Word already in vocabulary", { entry_id: dup.id });
    const v = { id: randomUUID(), _user: me.id, _norm: norm, word: b.word.trim(), translation: b.translation ?? null, context: b.context ?? null, page: b.page ?? null, rects: b.rects ?? null, learned: false, learned_at: null, article_id: a.id, created_at: now(), updated_at: now() };
    vocab.unshift(v);
    return json(res, 201, vocabOut(v));
  }
  const vm = /^\/me\/vocabulary\/([^/]+)$/.exec(path);
  if (vm && vm[1] !== "stats") {
    const v = vocab.find((x) => x.id === vm[1] && x._user === me.id);
    if (!v) return err(res, 404, "VOCAB_NOT_FOUND", "Vocabulary entry not found");
    if (m === "GET") return json(res, 200, vocabOut(v));
    if (m === "PATCH") {
      const b = await readBody(req);
      if (b.word != null) { const n = normWord(b.word); if (vocab.some((x) => x._user === me.id && x.id !== v.id && x._norm === n)) return err(res, 409, "VOCAB_DUPLICATE", "Word already in vocabulary", { entry_id: vocab.find((x) => x._user === me.id && x._norm === n).id }); v.word = b.word.trim(); v._norm = n; }
      if ("translation" in b) v.translation = b.translation;
      if ("context" in b) v.context = b.context;
      if (b.learned != null && b.learned !== v.learned) { v.learned = b.learned; v.learned_at = b.learned ? now() : null; }
      v.updated_at = now();
      return json(res, 200, vocabOut(v));
    }
    if (m === "DELETE") { vocab = vocab.filter((x) => x.id !== v.id); return json(res, 200, { message: "Deleted" }); }
  }

  // ---- orders / notifications
  if (path === "/orders" && m === "GET") return json(res, 200, orders.filter((o) => o.user_id === me.id).map(withNames));
  if (path === "/orders/quote" && m === "POST") {
    if (!pricing) return err(res, 404, "NOT_FOUND", "Not Found");
    const b = await readBody(req); const ids = Array.isArray(b.book_ids) ? [...new Set(b.book_ids)] : [];
    if (!ids.length) return err(res, 422, "CART_EMPTY", "Cart is empty");
    if (ids.length > 20) return err(res, 422, "CART_TOO_LARGE", "At most 20 books per order");
    const missing = ids.filter((id) => !books.some((x) => x.id === id && x.status === "ACTIVE")); if (missing.length) return err(res, 404, "BOOK_NOT_FOUND", "Book not found", { book_ids: missing });
    return json(res, 200, { ...quoteFor(ids), skipped: ids.filter((id) => books.find((x) => x.id === id)?.is_free).map((book_id) => ({ book_id, reason: "BOOK_IS_FREE" })) });
  }
  if (path === "/orders/checkout" && m === "POST") {
    if (!pricing) return err(res, 404, "NOT_FOUND", "Not Found");
    const b = await readBody(req); const ids = Array.isArray(b.book_ids) ? [...new Set(b.book_ids)] : [];
    if (!ids.length) return err(res, 422, "CART_EMPTY", "Cart is empty");
    if (ids.length > 20) return err(res, 422, "CART_TOO_LARGE", "At most 20 books per order");
    const missing = ids.filter((id) => !books.some((x) => x.id === id && x.status === "ACTIVE")); if (missing.length) return err(res, 404, "BOOK_NOT_FOUND", "Book not found", { book_ids: missing });
    const owned = ids.filter((id) => hasAccess(me.id, id)); if (owned.length) return err(res, 409, "ALREADY_HAS_ACCESS", "You already have access to some books", { book_ids: owned });
    const pending = ids.filter((id) => orders.some((x) => x.user_id === me.id && isOpen(x) && orderBookIds(x).includes(id))); if (pending.length) return err(res, 409, "ORDER_ALREADY_PENDING", "Some books are already in an open order", { book_ids: pending });
    const qt = quoteFor(ids); if (!qt.items.length) return err(res, 422, "CART_EMPTY", "No paid books in cart");
    const o = { id: randomUUID(), user_id: me.id, book_id: qt.items[0].book_id, items: qt.items.map(({ book_title, ...i }) => i), subtotal: qt.subtotal, discount: qt.discount, amount: qt.total, status: "PENDING", receipt_note: null, has_receipt_file: false, reviewed_by_admin_id: null, reviewed_at: null, reject_reason: null, created_at: now(), updated_at: now() };
    orders.unshift(o); return json(res, 201, withNames(o));
  }
  if (path === "/orders" && m === "POST") { const b = await readBody(req); const bk = books.find((x) => x.id === b.book_id); if (!bk) return err(res, 404, "BOOK_NOT_FOUND", "Book not found"); if (bk.is_free) return err(res, 422, "BOOK_IS_FREE", "Free books do not need an order"); if (hasAccess(me.id, bk.id)) return err(res, 409, "ALREADY_HAS_ACCESS", "You already have access to this book"); const open = orders.find((x) => x.user_id === me.id && orderBookIds(x).includes(bk.id) && isOpen(x)); if (open) return err(res, 409, "ORDER_ALREADY_PENDING", "You already have an open order for this book", { order_id: open.id, status: open.status }); const o = { id: randomUUID(), user_id: me.id, book_id: bk.id, amount: bk.price, status: "PENDING", receipt_note: null, has_receipt_file: false, reviewed_by_admin_id: null, reviewed_at: null, reject_reason: null, created_at: now(), updated_at: now() }; orders.unshift(o); return json(res, 201, o); }
  // Bitta buyurtma (polling) va bekor qilish — boshqa foydalanuvchiniki 404 (IDOR)
  const og = /^\/orders\/([^/]+)(\/cancel)?$/.exec(path);
  if (og && (og[2] ? m === "POST" : m === "GET")) {
    const o = orders.find((x) => x.id === og[1] && x.user_id === me.id); if (!o) return err(res, 404, "ORDER_NOT_FOUND", "Not found");
    if (og[2]) { if (!isOpen(o)) return err(res, 409, "INVALID_ORDER_STATE", `Order is ${o.status}`); Object.assign(o, { status: "CANCELLED", updated_at: now() }); }
    return json(res, 200, withNames(o));
  }
  if (path === "/payment-info" && m === "GET") return json(res, 200, paymentInfo);
  // 56: botda to'lov — deep-link (faqat ochiq buyurtma; begona — 404)
  const tg = /^\/orders\/([^/]+)\/telegram-link$/.exec(path);
  if (tg && m === "POST") {
    const o = orders.find((x) => x.id === tg[1] && x.user_id === me.id); if (!o) return err(res, 404, "ORDER_NOT_FOUND", "Not found");
    if (!isOpen(o)) return err(res, 409, "INVALID_ORDER_STATE", `Order is ${o.status}`);
    const token = `tg${o.id.slice(0, 8)}`;
    return json(res, 200, { deep_link: tgLinkOff ? null : `https://t.me/articles365_test_bot?start=${token}`, token, bot_username: tgLinkOff ? null : "articles365_test_bot" });
  }
  const om = /^\/orders\/([^/]+)\/receipt$/.exec(path);
  if (om && m === "POST") {
    // Oqim v1.0: multipart/form-data — `file` (JPEG/PNG/WebP/PDF, ≤ 10 MB, tavsiya) + `receipt_note` (ixtiyoriy).
    // Faqat ochiq (PENDING / AWAITING_REVIEW) buyurtmaga — AWAITING'da chek almashtiriladi; aks holda 409.
    const o = orders.find((x) => x.id === om[1] && x.user_id === me.id); if (!o) return err(res, 404, "ORDER_NOT_FOUND", "Not found");
    if (!isOpen(o)) return err(res, 409, "INVALID_ORDER_STATE", `Order is ${o.status}`);
    const ct = req.headers["content-type"] ?? "";
    if (!ct.startsWith("multipart/form-data")) return err(res, 422, "VALIDATION_ERROR", "Expected multipart/form-data");
    const form = parseMultipart(await readRaw(req), ct);
    if (!form) return err(res, 422, "VALIDATION_ERROR", "Bad multipart body");
    const f = form.files.file;
    if (f) {
      if (f.data.length > 10 * 1024 * 1024) return err(res, 413, "PAYLOAD_TOO_LARGE", "Receipt image exceeds 10 MB");
      if (!isImageBytes(f.data) && !isPdfBytes(f.data)) return err(res, 422, "INVALID_FILE", "Receipt must be a JPEG, PNG, WebP image or PDF");
      receiptFiles[o.id] = { data: f.data, type: isPdfBytes(f.data) ? "application/pdf" : f.type };
    }
    if (receiptDelay) await new Promise((r) => setTimeout(r, receiptDelay));
    receipts.push({ order_id: o.id, note: form.fields.receipt_note ?? null, file: f ? { filename: f.filename, type: f.type, size: f.data.length } : null });
    Object.assign(o, { status: "AWAITING_REVIEW", receipt_note: form.fields.receipt_note ?? null, has_receipt_file: !!receiptFiles[o.id], updated_at: now() });
    return json(res, 200, o);
  }
  if (path === "/notifications" && m === "GET") { const mine = notifications.filter((n) => n._user === me.id).filter((n) => q.get("unread_only") !== "true" || !n.is_read).map(({ _user, ...n }) => n); return json(res, 200, paged(mine, Number(q.get("page") ?? 1), Number(q.get("page_size") ?? 20))); }
  if (path === "/notifications/unread-count") return json(res, 200, { unread: notifications.filter((n) => n._user === me.id && !n.is_read).length });
  if (path === "/notifications/read-all" && m === "POST") { notifications.forEach((n) => { if (n._user === me.id) n.is_read = true; }); return json(res, 200, { message: "ok" }); }
  const nm = /^\/notifications\/([^/]+)\/read$/.exec(path);
  if (nm && m === "POST") { const n = notifications.find((x) => x.id === nm[1]); if (n) n.is_read = true; return json(res, 200, { message: "ok" }); }

  // ---- admin
  if (path.startsWith("/admin/")) {
    if (me.role !== "ADMIN") return err(res, 403, "PERMISSION_DENIED", "Admin only");
    if (path === "/admin/stats") return json(res, 200, { users: { total: users.length, by_status: { ACTIVE: users.length }, by_role: { USER: users.length - 1, ADMIN: 1 } }, books: { total: books.length, by_status: { ACTIVE: books.length } }, articles: { total: articles.length, by_processing: { READY: articles.filter((a) => a.processing_status === "READY").length, PROCESSING: articles.filter((a) => a.processing_status === "PROCESSING").length } }, categories: categories.length, access: { total: access.length, by_status: { ACTIVE: access.filter((a) => a.status === "ACTIVE").length } }, annotations: annotations.length, active_sessions: 3 });
    // 67: reklama (broadcast)
    const bout = (b) => ({ id: b.id, caption: b.caption, status: b.status, total: b.total, sent: b.sent, failed: b.failed, has_image: b.has_image, created_at: b.created_at });
    if (path === "/admin/broadcast" && m === "POST") {
      const ct = req.headers["content-type"] ?? "";
      if (!ct.startsWith("multipart/form-data")) return err(res, 422, "VALIDATION_ERROR", "Expected multipart/form-data");
      const form = parseMultipart(await readRaw(req), ct) ?? { fields: {}, files: {} };
      const text = (form.fields.text ?? "").trim(); const f = form.files.file;
      if (!text && !f) return err(res, 422, "VALIDATION_ERROR", "text or file is required");
      if (f && !/^image\/(jpeg|png|webp)$/.test(f.type)) return err(res, 422, "VALIDATION_ERROR", "Image must be jpeg/png/webp");
      if ((f && text.length > 1024) || text.length > 4096) return err(res, 422, "VALIDATION_ERROR", "Caption too long");
      const b = { id: randomUUID(), caption: text || null, status: "PENDING", total: 0, sent: 0, failed: 0, has_image: !!f, created_at: now(), _file: f ? { type: f.type, size: f.data.length } : null, _ticks: 0 };
      broadcasts.unshift(b);
      return json(res, 201, bout(b));
    }
    if (path === "/admin/broadcast" && m === "GET") return json(res, 200, broadcasts.slice(0, Number(q.get("limit") ?? 50)).map(bout));
    const bcm = /^\/admin\/broadcast\/([^/]+)$/.exec(path);
    if (bcm && m === "GET") {
      const b = broadcasts.find((x) => x.id === bcm[1]); if (!b) return err(res, 404, "BROADCAST_NOT_FOUND", "Not found");
      b._ticks++;
      if (b.status === "PENDING") Object.assign(b, { status: "SENDING", total: 5 });
      else if (b.status === "SENDING") { b.sent = Math.min(4, b.sent + 2); if (b.sent >= 4) Object.assign(b, { failed: 1, status: "DONE" }); }
      return json(res, 200, bout(b));
    }
    // 57: integratsiya sozlamalari
    if (path === "/admin/integration-settings" && m === "GET") return json(res, 200, integOut());
    if (path === "/admin/integration-settings" && m === "PUT") {
      const b = await readBody(req); const st = b?.settings;
      if (!st || typeof st !== "object" || !Object.keys(st).length) return err(res, 422, "VALIDATION_ERROR", "settings must have at least 1 key");
      const bad = Object.keys(st).filter((k) => !(k in INTEG_ENV)); if (bad.length) return err(res, 422, "VALIDATION_ERROR", `Unknown keys: ${bad.join(", ")}`);
      integLog.push(st);
      for (const [k, v] of Object.entries(st)) { if (v === "" || v == null) delete integ[k]; else integ[k] = String(v); }
      return json(res, 200, integOut());
    }
    if (path === "/admin/integration-settings/telegram/set-webhook" && m === "POST") { webhookCalls++; return json(res, 200, { ok: true, url: "https://articles.api.cognilabs.org/api/v1/telegram/webhook" }); }
    // 46: fon rasmlari (multipart `file`, ?theme=light|dark)
    const aimg = /^\/admin\/app-settings\/images\/([^/]+)$/.exec(path);
    if (aimg) {
      const name = aimg[1]; const th = q.get("theme") === "dark" ? "dark" : "light";
      if (m === "PUT") {
        const ct = req.headers["content-type"] ?? "";
        if (!ct.startsWith("multipart/form-data")) return err(res, 422, "VALIDATION_ERROR", "Expected multipart/form-data");
        const f = parseMultipart(await readRaw(req), ct)?.files.file;
        if (!f || !/^image\/(jpeg|png|webp)$/.test(f.type)) return err(res, 422, "VALIDATION_ERROR", "Image required (jpeg/png/webp)");
        appImages[name] = appImages[name] ?? {}; appImages[name][th] = { data: f.data, type: f.type, v: ++appImageVersion };
        return json(res, 200, { name, theme: th, url: appImageUrl(name, th) });
      }
      if (m === "DELETE") { if (!appImages[name]?.[th]) return err(res, 404, "IMAGE_NOT_FOUND", "Image not found"); delete appImages[name][th]; if (!Object.keys(appImages[name]).length) delete appImages[name]; return json(res, 200, { message: "Deleted" }); }
    }
    // 44.8: global ko'rinish sozlamalari
    if (path === "/admin/app-settings") {
      if (m === "GET") return json(res, 200, { settings: appSettings });
      if (m === "PUT") { const b = await readBody(req); const st = b.settings; if (!st || typeof st !== "object" || !Object.keys(st).length || Object.keys(st).some((k) => !/^[a-z0-9_.-]{1,64}$/.test(k))) return err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ loc: ["body", "settings"], msg: "Invalid settings" }]); appSettings = { ...appSettings, ...st }; return json(res, 200, { settings: appSettings }); }
    }
    const asm = /^\/admin\/app-settings\/([^/]+)$/.exec(path);
    if (asm && m === "DELETE") { if (!(asm[1] in appSettings)) return err(res, 404, "NOT_FOUND", "Setting not found"); delete appSettings[asm[1]]; return json(res, 200, { message: "Deleted" }); }
    // 44.5: admin — maqola savollari
    const aq = /^\/admin\/articles\/([^/]+)\/questions(?:\/([^/]+))?$/.exec(path);
    if (aq) {
      const [, aid, qid] = aq;
      if (!articles.some((x) => x.id === aid)) return err(res, 404, "ARTICLE_NOT_FOUND", "Article not found");
      const bad = () => err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ loc: ["body", "data"], msg: "data/answer shape does not match type" }]);
      if (!qid && m === "GET") return json(res, 200, questions.filter((q) => q.article_id === aid).sort((x, y) => x.order_index - y.order_index).map(qAdmin));
      if (!qid && m === "POST") { const b = await readBody(req); __lastQuestionBody = b; if (b.prompt === "__422__") return bad(); const q = { id: randomUUID(), article_id: aid, type: b.type, prompt: b.prompt, data: b.data, answer: b.answer, explanation: b.explanation ?? null, order_index: b.order_index ?? 0 }; if (!qValid(q)) return bad(); if (q.type === "MULTIPLE_CHOICE" && questionsDropChoose) delete q.data.choose; questions.push(q); return json(res, 201, qAdmin(q)); }
      const q = questions.find((x) => x.id === qid && x.article_id === aid);
      if (!q) return err(res, 404, "QUESTION_NOT_FOUND", "Question not found");
      if (m === "PATCH") { const b = await readBody(req); __lastQuestionBody = b; const next = { ...q, ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)) }; if (!qValid(next)) return bad(); if (next.type === "MULTIPLE_CHOICE" && questionsDropChoose) delete next.data.choose; Object.assign(q, next); return json(res, 200, qAdmin(q)); }
      if (m === "DELETE") { questions = questions.filter((x) => x.id !== q.id); return json(res, 200, { message: "Question deleted" }); }
    }
    // 44.4: to'lovlar statistikasi — tushum = APPROVED buyurtmalar
    if (path === "/admin/stats/payments" && m === "GET") {
      // 64: group_by (year|month|day|hour), date_from/date_to (YYYY-MM-DD, `to` kun ichida ham), limit; davr — UTC
      const g = ["year", "month", "day", "hour"].includes(q.get("group_by")) ? q.get("group_by") : "month";
      const from = q.get("date_from"), to = q.get("date_to"), limit = Math.max(1, Math.min(1000, Number(q.get("limit") ?? 180)));
      const at = (o) => o.reviewed_at ?? o.updated_at;
      const inRange = (o) => (!from || at(o).slice(0, 10) >= from) && (!to || at(o).slice(0, 10) <= to);
      const scoped = orders.filter(inRange);
      const approved = scoped.filter((o) => o.status === "APPROVED");
      const key = (iso) => (g === "year" ? iso.slice(0, 4) : g === "month" ? iso.slice(0, 7) : g === "day" ? iso.slice(0, 10) : `${iso.slice(0, 10)} ${iso.slice(11, 13)}:00`);
      const by = {}; const byBook = {}; const byMonth = {};
      for (const o of approved) {
        const k = key(at(o)); const mon = at(o).slice(0, 7); const amt = Number(o.amount);
        by[k] = by[k] ?? { period: k, revenue: 0, orders: 0 }; by[k].revenue += amt; by[k].orders += 1;
        byMonth[mon] = byMonth[mon] ?? { month: mon, revenue: 0, orders: 0 }; byMonth[mon].revenue += amt; byMonth[mon].orders += 1;
        const ids = orderBookIds(o); const per = amt / ids.length;
        for (const id of ids) { const bk = books.find((x) => x.id === id); byBook[id] = byBook[id] ?? { book_id: id, title: bk?.title ?? null, revenue: 0, sold: 0 }; byBook[id].revenue += per; byBook[id].sold += 1; }
      }
      const total = approved.reduce((a, o) => a + Number(o.amount), 0);
      const st = {}; for (const o of paymentsUnscoped ? orders : scoped) st[o.status] = (st[o.status] ?? 0) + 1;
      return json(res, 200, {
        currency: "UZS", group_by: g, date_from: from, date_to: to,
        total_revenue: total, approved_orders: approved.length, average_order_value: approved.length ? total / approved.length : 0, orders_by_status: st,
        revenue_by_period: Object.values(by).sort((a, b) => b.period.localeCompare(a.period)).slice(0, limit),
        revenue_by_month: g === "month" ? Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)) : null,
        revenue_by_book: Object.values(byBook).sort((a, b) => b.revenue - a.revenue).slice(0, 50),
      });
    }
    if (path === "/admin/audit-logs") { if (audit500 || q.get("boom")) return err(res, 500, "INTERNAL_ERROR", "boom"); return json(res, 200, paged([{ id: "l1", admin_id: ADMIN.id, action: "BOOK_ACCESS_GRANTED", entity_type: "book_access", entity_id: "acc-1", meta: { book_id: BOOK_ID, user_id: USER.id }, ip_address: "127.0.0.1", created_at: now() }, { id: "l2", admin_id: null, action: "SUSPICIOUS_ACTIVITY", entity_type: "user", entity_id: USER.id, meta: {}, ip_address: null, created_at: now() }].filter((l) => !q.get("action") || l.action === q.get("action")).filter((l) => !q.get("entity_type") || l.entity_type === q.get("entity_type")))); }
    if (path === "/admin/categories" && m === "GET") return json(res, 200, paged(categories.filter((c) => !q.get("status") || c.status === q.get("status"))));
    if (path === "/admin/categories" && m === "POST") { const b = await readBody(req); if (categories.some((c) => c.name === b.name)) return err(res, 409, "ALREADY_EXISTS", "Category exists"); const c = { id: randomUUID(), name: b.name, slug: b.slug ?? b.name.toLowerCase().replace(/\s+/g, "-"), description: b.description ?? null, status: "ACTIVE", created_at: now(), updated_at: now() }; categories.push(c); return json(res, 201, c); }
    const cm = /^\/admin\/categories\/([^/]+)$/.exec(path);
    if (cm && m === "PATCH") { const c = categories.find((x) => x.id === cm[1]); if (!c) return err(res, 404, "CATEGORY_NOT_FOUND", "Not found"); const b = await readBody(req); Object.assign(c, Object.fromEntries(Object.entries(b).filter(([, v]) => v !== null && v !== undefined)), { updated_at: now() }); return json(res, 200, c); }
    if (path === "/admin/users" && m === "GET") { const s = (q.get("search") ?? "").toLowerCase(); return json(res, 200, paged(users.filter((u) => !s || (u.email ?? "").includes(s) || (u.full_name ?? "").toLowerCase().includes(s)).filter((u) => !q.get("status") || u.status === q.get("status")), Number(q.get("page") ?? 1), Number(q.get("page_size") ?? 20))); }
    if (path === "/admin/users" && m === "POST") { const b = await readBody(req); if (!b.password) return err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ loc: ["body", "password"], msg: "Field required" }]); const u = { id: randomUUID(), email: b.email ?? null, phone: b.phone ?? null, full_name: b.full_name ?? null, role: "USER", status: "ACTIVE", created_at: now(), updated_at: now() }; users.push(u); return json(res, 201, u); }
    // 38: admin — foydalanuvchi qurilmalari (sabab majburiy)
    const dm = /^\/admin\/users\/([^/]+)\/devices(?:\/([^/]+))?$/.exec(path);
    if (dm) {
      const [, uid, did] = dm;
      const devOut = ({ user, key, secret, ...d }) => d;
      if (m === "GET" && !did) return json(res, 200, devices.filter((d) => d.user === uid).map(devOut));
      if (m === "DELETE") {
        const b = await readBody(req);
        if (!b.reason || !String(b.reason).trim()) return err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ loc: ["body", "reason"], msg: "Field required" }]);
        const targets = devices.filter((d) => d.user === uid && !d.removed_at && (!did || d.id === did));
        if (did && !targets.length) return err(res, 404, "DEVICE_NOT_FOUND", "Device not found");
        for (const d of targets) Object.assign(d, { removed_at: now(), removed_by_admin_id: me.id, remove_reason: String(b.reason).trim() });
        return json(res, 200, { message: "Device removed" });
      }
    }
    const um = /^\/admin\/users\/([^/]+)(?:\/(status|books|sessions|reset-password))?$/.exec(path);
    if (um) {
      const u = users.find((x) => x.id === um[1]);
      if (!u) return err(res, 404, "USER_NOT_FOUND", "Not found");
      const sub = um[2];
      if (!sub) return json(res, 200, u);
      if (sub === "status") { const b = await readBody(req); u.status = b.status; u.updated_at = now(); return json(res, 200, u); }
      if (sub === "books") return json(res, 200, access.filter((a) => a.user_id === u.id).map(withNames));
      if (sub === "sessions" && m === "GET") return json(res, 200, [{ id: "s-u1", ip_address: "10.0.0.5", user_agent: "Mozilla/5.0 (Windows) Chrome/120", created_at: now(), last_active_at: now(), expires_at: now(), revoked_at: null, is_current: false }]);
      if (sub === "sessions" && m === "DELETE") return json(res, 200, { message: "All sessions revoked" });
      if (sub === "reset-password") { const b = await readBody(req); if ((b.new_password ?? "").length < 8) return err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ loc: ["body", "new_password"], msg: "too short" }]); return json(res, 200, { message: "Password reset" }); }
    }
    if (path.startsWith("/admin/sessions/") && m === "DELETE") return json(res, 200, { message: "Session revoked" });
    // 85: chegirma pog'onalari (admin)
    if (path === "/admin/pricing-tiers") {
      if (!pricing) pricing = { currency: "UZS", tiers: [] };
      const sorted = () => pricing.tiers.slice().sort((a, b) => a.min_quantity - b.min_quantity);
      if (m === "GET") return json(res, 200, sorted());
      if (m === "PUT") {
        const b = await readBody(req); __lastTiersBody = b;
        const list = Array.isArray(b.tiers) ? b.tiers : [];
        const mins = list.map((t) => Number(t.min_quantity));
        if (mins.some((x) => !Number.isInteger(x) || x < 1) || list.some((t) => !(Number(t.unit_price) > 0))) return err(res, 422, "VALIDATION_ERROR", "Invalid tier");
        if (new Set(mins).size !== mins.length) return err(res, 422, "DUPLICATE_TIER", "Duplicate min_quantity");
        pricing.tiers = list.map((t, i) => ({ id: `tier-${Date.now()}-${i}`, min_quantity: Number(t.min_quantity), unit_price: Number(t.unit_price).toFixed(2), is_active: t.is_active !== false }));
        return json(res, 200, sorted());
      }
    }
    if (path === "/admin/books" && m === "GET") { const s = (q.get("search") ?? "").toLowerCase(); return json(res, 200, paged(books.filter((b) => !s || b.title.toLowerCase().includes(s)).filter((b) => !q.get("status") || b.status === q.get("status")), Number(q.get("page") ?? 1), Number(q.get("page_size") ?? 20))); }
    if (path === "/admin/books" && m === "POST") { const b = await readBody(req); const cat = categories.find((c) => c.id === b.category_id) ?? null; const orig = Number(b.original_price ?? 0) > 0 ? Number(b.original_price).toFixed(2) : null; if (orig && !b.is_free && Number(orig) < Number(b.price ?? 0)) return err(res, 422, "VALIDATION_ERROR", "original_price must be greater than price"); const bk = { id: randomUUID(), title: b.title, author: b.author ?? null, description: b.description ?? null, price: b.is_free ? "0.00" : Number(b.price ?? 0).toFixed(2), original_price: orig, is_free: !!b.is_free || Number(b.price ?? 0) === 0, watermark_enabled: b.watermark_enabled !== false, status: "INACTIVE", category_id: cat?.id ?? null, category: cat, book_metadata: b.book_metadata ?? {}, created_at: now(), updated_at: now(), has_cover: false }; withDiscount(bk); books.unshift(bk); __lastBookBody = b; return json(res, 201, bk); }
    const bm = /^\/admin\/books\/([^/]+)(?:\/(cover|articles))?(?:\/([^/]+))?(?:\/(file|toc))?$/.exec(path);
    if (bm) {
      const [, bid, sub, aid, sub2] = bm;
      const bk = books.find((x) => x.id === bid);
      if (!bk) return err(res, 404, "BOOK_NOT_FOUND", "Not found");
      if (!sub) { if (m === "PATCH") { const b = await readBody(req); if (b.status === "ACTIVE" && !articles.some((a) => a.book_id === bid && a.processing_status === "READY")) return err(res, 409, "BOOK_NOT_READY", "No READY articles"); Object.assign(bk, Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)), { updated_at: now() }); if (b.price != null) bk.price = Number(b.price).toFixed(2); if (b.is_free) bk.price = "0.00"; if ("is_free" in b || b.price != null) bk.is_free = !!b.is_free || Number(bk.price) === 0; if ("original_price" in b) { bk.original_price = Number(b.original_price) > 0 ? Number(b.original_price).toFixed(2) : null; if (bk.original_price && !bk.is_free && Number(bk.original_price) < Number(bk.price)) return err(res, 422, "VALIDATION_ERROR", "original_price must be greater than price"); } withDiscount(bk); __lastBookBody = b; if ("category_id" in b) bk.category = categories.find((c) => c.id === b.category_id) ?? null; } return json(res, 200, bk); }
      if (sub === "cover") { let size = 0; for await (const c of req) { size += c.length; await new Promise((r) => setTimeout(r, 3)); } uploads.push({ path, size, contentType: req.headers["content-type"]?.split(";")[0] }); bk.has_cover = true; return json(res, 200, bk); }
      if (sub === "articles" && !aid) {
        const list = articles.filter((a) => a.book_id === bid).sort((a, b) => a.order_index - b.order_index);
        if (m === "GET") return json(res, 200, list);
        const b = await readBody(req);
        const a = { id: randomUUID(), book_id: bid, title: b.title, order_index: b.order_index ?? list.length, mime_type: null, file_size: null, format: null, page_count: null, processing_status: "UPLOADING", processing_error: null, text_extractable: false, file_version: 0, content_updated_at: null, article_metadata: {}, created_at: now(), updated_at: now(), has_source_file: false };
        articles.push(a); return json(res, 201, a);
      }
      const a = articles.find((x) => x.id === aid && x.book_id === bid);
      if (!a) return err(res, 404, "ARTICLE_NOT_FOUND", "Not found");
      if (!sub2) { if (m === "PATCH") { const b = await readBody(req); Object.assign(a, Object.fromEntries(Object.entries(b).filter(([, v]) => v !== null && v !== undefined)), { updated_at: now() }); return json(res, 200, a); } if (m === "DELETE") { articles = articles.filter((x) => x.id !== aid); return json(res, 200, { message: "Article deleted" }); } }
      if (sub2 === "file") { let size = 0; for await (const c of req) { size += c.length; await new Promise((r) => setTimeout(r, 3)); } uploads.push({ path, size, contentType: req.headers["content-type"]?.split(";")[0] }); Object.assign(a, { has_source_file: true, processing_status: "PROCESSING", file_size: size, mime_type: "application/pdf", format: "pdf", file_version: a.file_version + 1, updated_at: now() }); setTimeout(() => Object.assign(a, { processing_status: "READY", page_count: 6, text_extractable: true }), 1500); return json(res, 200, a); }
      if (sub2 === "toc") { const b = await readBody(req); a.article_metadata = { ...a.article_metadata, toc: b.entries }; return json(res, 200, a); }
    }
    if (path === "/admin/book-access" && m === "GET") return json(res, 200, paged(access.filter((a) => (!q.get("book_id") || a.book_id === q.get("book_id")) && (!q.get("user_id") || a.user_id === q.get("user_id")) && (!q.get("status") || a.status === q.get("status"))).map(withNames)));
    if (path === "/admin/book-access" && m === "POST") { const b = await readBody(req); const ex = access.find((a) => a.user_id === b.user_id && a.book_id === b.book_id && a.status === "ACTIVE"); if (ex) return json(res, 200, ex); const a = { id: randomUUID(), user_id: b.user_id, book_id: b.book_id, status: "ACTIVE", granted_at: now(), granted_by_admin_id: me.id, revoked_at: null, revoked_by_admin_id: null, created_at: now(), updated_at: now() }; access.push(a); notifications.unshift({ id: randomUUID(), type: "ACCESS_GRANTED", title: "Kitobga ruxsat berildi", body: books.find((x) => x.id === b.book_id)?.title ?? null, is_read: false, meta: { book_id: b.book_id }, created_at: now(), _user: b.user_id }); return json(res, 201, a); }
    const am = /^\/admin\/book-access\/([^/]+)(\/revoke)?$/.exec(path);
    if (am) { const a = access.find((x) => x.id === am[1]); if (!a) return err(res, 404, "ACCESS_NOT_FOUND", "Not found"); Object.assign(a, { status: "REVOKED", revoked_at: now(), revoked_by_admin_id: me.id, updated_at: now() }); return json(res, 200, a); }
    if (path === "/admin/orders" && m === "GET") return json(res, 200, paged(orders.filter((o) => !q.get("status") || o.status === q.get("status")).map(withNames), Number(q.get("page") ?? 1), Number(q.get("page_size") ?? 20)));
    const arm = /^\/admin\/orders\/([^/]+)\/receipt$/.exec(path);
    if (arm && m === "GET") { const o = orders.find((x) => x.id === arm[1]); if (!o) return err(res, 404, "ORDER_NOT_FOUND", "Not found"); const f = receiptFiles[o.id]; if (!f) return err(res, 404, "RECEIPT_NOT_FOUND", "Receipt not found"); res.writeHead(200, { "Content-Type": f.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }); return res.end(f.data); }
    const aom = /^\/admin\/orders\/([^/]+)\/(approve|reject)$/.exec(path);
    // Approve idempotent (APPROVED → 200 o'zgarishsiz); boshqa yopiq holat → 409 (Telegram'da hal qilingan); sabab majburiy
    if (aom && m === "POST") { const o = orders.find((x) => x.id === aom[1]); if (!o) return err(res, 404, "ORDER_NOT_FOUND", "Not found"); const b = aom[2] === "reject" ? await readBody(req) : {}; if (aom[2] === "reject" && !String(b.reason ?? "").trim()) return err(res, 422, "VALIDATION_ERROR", "reason: String should have at least 1 character"); if (aom[2] === "approve" && o.status === "APPROVED") return json(res, 200, o); if (!isOpen(o)) return err(res, 409, "INVALID_ORDER_STATE", `Order is ${o.status}`); if (aom[2] === "approve") { Object.assign(o, { status: "APPROVED", reviewed_by_admin_id: me.id, reviewed_at: now(), updated_at: now() }); for (const bid of orderBookIds(o)) if (!hasAccess(o.user_id, bid)) access.push({ id: randomUUID(), user_id: o.user_id, book_id: bid, status: "ACTIVE", granted_at: now(), granted_by_admin_id: me.id, revoked_at: null, revoked_by_admin_id: null, created_at: now(), updated_at: now() }); notifications.unshift({ id: randomUUID(), type: "ORDER_APPROVED", title: "Buyurtma tasdiqlandi", body: null, is_read: false, meta: { order_id: o.id, book_id: o.book_id }, created_at: now(), _user: o.user_id }); } else { Object.assign(o, { status: "REJECTED", reject_reason: b.reason ?? null, reviewed_by_admin_id: me.id, reviewed_at: now(), updated_at: now() }); notifications.unshift({ id: randomUUID(), type: "ORDER_REJECTED", title: "Buyurtma rad etildi", body: b.reason ?? null, is_read: false, meta: { order_id: o.id, book_id: o.book_id }, created_at: now(), _user: o.user_id }); } return json(res, 200, o); }
    if (path === "/admin/export/users" || path === "/admin/export/audit-logs") { res.writeHead(200, { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${path.split("/").pop()}.xlsx"` }); return res.end(Buffer.from("PK\x03\x04fake-xlsx")); }
    return err(res, 404, "NOT_FOUND", `No admin route ${m} ${path}`);
  }
  return err(res, 404, "NOT_FOUND", "Not Found");
}).listen(PORT, () => console.log(`mock backend (OpenAPI 2026-09-21) on :${PORT}`));
