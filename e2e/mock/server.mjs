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
  ...Array.from({ length: 29 }, (_, i) => ({ id: `22222222-2222-4222-8222-${String(i).padStart(12, "0")}`, title: `Kitob ${i + 1}`, author: i % 2 ? "A. Aliyev" : "B. Boboyev", description: `Tavsif ${i + 1}`, price: i % 5 === 0 ? "0" : `${10000 + i * 1000}.00`, status: "ACTIVE", category_id: i % 3 ? null : CAT.id, category: i % 3 ? null : CAT, book_metadata: {}, created_at: now(), updated_at: now(), has_cover: false })),
];
const freshArticles = () => [
  { id: ART_ID, book_id: BOOK_ID, title: "Birinchi maqola", order_index: 0, mime_type: "application/pdf", file_size: PDF.length, format: "pdf", page_count: 6, processing_status: "READY", processing_error: null, text_extractable: true, file_version: 1, content_updated_at: null, article_metadata: {}, created_at: now(), updated_at: now(), has_source_file: true },
  { id: ART2_ID, book_id: BOOK_ID, title: "Ikkinchi maqola", order_index: 1, mime_type: "application/pdf", file_size: PDF.length, format: "pdf", page_count: 6, processing_status: "READY", processing_error: null, text_extractable: true, file_version: 1, content_updated_at: null, article_metadata: {}, created_at: now(), updated_at: now(), has_source_file: true },
  { id: ART3_ID, book_id: BOOK_ID, title: "Qayta ishlanayotgan maqola", order_index: 2, mime_type: null, file_size: null, format: null, page_count: null, processing_status: "PROCESSING", processing_error: null, text_extractable: false, file_version: 0, content_updated_at: null, article_metadata: {}, created_at: now(), updated_at: now(), has_source_file: true },
  { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", book_id: BOOK2_ID, title: "Boshqa kitob maqolasi", order_index: 0, mime_type: "application/pdf", file_size: PDF.length, format: "pdf", page_count: 6, processing_status: "READY", processing_error: null, text_extractable: true, file_version: 1, content_updated_at: null, article_metadata: {}, created_at: now(), updated_at: now(), has_source_file: true },
];

let books, articles, access, progress, annotations, orders, notifications, uploads, categories, users, sessions, twofaEnabled;
const log = [];
const headersSeen = [];
let audit500 = false;
let noContentRange = false;
let failRule = null; // /__fail?path=/catalog&status=429&code=RATE_LIMIT_EXCEEDED — mos yo'llar shu xato bilan javob beradi // B1 workaround'ni sinash uchun toggle (prod'da Content-Range BOR)
function reset(opts = {}) {
  books = freshBooks();
  articles = freshArticles();
  access = [{ id: "acc-1", user_id: USER.id, book_id: BOOK_ID, status: "ACTIVE", granted_at: now(), granted_by_admin_id: ADMIN.id, revoked_at: null, revoked_by_admin_id: null, created_at: now(), updated_at: now() }];
  progress = {}; // key: user:article
  annotations = opts.legacy
    ? [{ id: "legacy-1", article_id: ART_ID, type: "HIGHLIGHT", page: 1, location_data: { page: 1, rects: [[0.1, 0.5, 0.3, 0.02]] }, selected_text: "legacy", note_text: null, color: "#93c5fd", label: null, created_at: now(), updated_at: now(), _user: USER.id }]
    : [];
  orders = [];
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
const withNames = (x) => { const u = users.find((y) => y.id === x.user_id); const b = books.find((y) => y.id === x.book_id); return { ...x, user_email: u?.email ?? null, user_full_name: u?.full_name ?? null, book_title: b?.title ?? null }; };
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
  if (!path.startsWith("/__")) headersSeen.push({ path, ngrok: req.headers["ngrok-skip-browser-warning"], device: req.headers["x-device-id"], auth: !!req.headers.authorization });

  // ---- test yordamchilari
  if (path === "/__reset") { reset({ legacy: q.get("legacy") === "1" }); return json(res, 200, { ok: true }); }
  if (path === "/__log") return json(res, 200, log);
  if (path === "/__headers") return json(res, 200, headersSeen);
  if (path === "/__annotations") return json(res, 200, annotations);
  if (path === "/__progress") return json(res, 200, progress);
  if (path === "/__uploads") return json(res, 200, uploads);
  if (path === "/__orders") return json(res, 200, orders);
  if (path === "/__notify") { notifications.unshift({ id: randomUUID(), type: "GENERAL", title: q.get("title") ?? "Xabar", body: q.get("body") ?? null, is_read: false, meta: {}, created_at: now(), _user: USER.id }); return json(res, 200, { ok: true }); }
  if (path === "/__articles") return json(res, 200, articles);
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

  // ---- public
  if (path === "/catalog") {
    const s = (q.get("search") ?? "").toLowerCase();
    const all = books.filter((b) => b.status === "ACTIVE").filter((b) => !q.get("category_id") || b.category_id === q.get("category_id")).filter((b) => !s || b.title.toLowerCase().includes(s) || (b.author ?? "").toLowerCase().includes(s) || (b.description ?? "").toLowerCase().includes(s))
      .map((b) => ({ book_id: b.id, title: b.title, author: b.author, description: b.description, category_name: b.category?.name ?? null, price: b.price, has_cover: b.has_cover, article_count: articles.filter((a) => a.book_id === b.id).length }));
    return json(res, 200, paged(all, Number(q.get("page") ?? 1), Number(q.get("page_size") ?? 20)));
  }
  const cm0 = /^\/catalog\/([^/]+)(\/cover)?$/.exec(path);
  if (cm0) {
    const b = books.find((x) => x.id === cm0[1] && x.status === "ACTIVE");
    if (!b) return err(res, 404, "BOOK_NOT_FOUND", "Book not found");
    if (cm0[2]) return err(res, 404, "NOT_FOUND", "Cover not found");
    return json(res, 200, { book_id: b.id, title: b.title, author: b.author, description: b.description, category_name: b.category?.name ?? null, price: b.price, has_cover: b.has_cover, article_count: articles.filter((a) => a.book_id === b.id).length });
  }
  if (path === "/categories") return json(res, 200, categories.filter((c) => c.status === "ACTIVE"));
  if (m === "POST" && path === "/auth/login") {
    const b = await readBody(req);
    if (b.identifier === "limit@articles365.local") return err(res, 403, "DEVICE_LIMIT_REACHED", "Device limit reached", { limit: 2, active_devices: [{ device_name: "Chrome · Windows", last_seen_at: now() }, { device_name: "Safari · iOS", last_seen_at: now() }] });
    if (b.identifier === TWOFA_USER.email) {
      if (b.password !== "User12345!") return err(res, 401, "INVALID_CREDENTIALS", "Invalid credentials");
      if (!b.totp_code) return err(res, 401, "TOTP_REQUIRED", "TOTP code required");
      if (b.totp_code !== "123456") return err(res, 401, "INVALID_TOTP", "Invalid code");
      return json(res, 200, { access_token: "access-token-2fa", refresh_token: "refresh-2fa", token_type: "bearer", expires_in: 900, user: TWOFA_USER });
    }
    if (b.identifier === ADMIN.email && b.password === "Admin12345!") { sessions.push({ id: randomUUID(), user: ADMIN.id, device: b.device_name }); return json(res, 200, { access_token: "access-token-admin", refresh_token: "refresh-a", token_type: "bearer", expires_in: 900, user: ADMIN }); }
    if (b.identifier === USER.email && b.password === "User12345!") { sessions.push({ id: randomUUID(), user: USER.id, device: b.device_name }); return json(res, 200, { access_token: "access-token-1", refresh_token: "refresh-1", token_type: "bearer", expires_in: 900, user: USER }); }
    return err(res, 401, "INVALID_CREDENTIALS", "Invalid credentials");
  }
  if (m === "POST" && path === "/auth/register") {
    const b = await readBody(req);
    if (!b.password) return err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ type: "missing", loc: ["body", "password"], msg: "Field required" }]);
    if (b.email === USER.email) return err(res, 409, "ALREADY_EXISTS", "User exists");
    const u = { ...USER, id: randomUUID(), email: b.email ?? null, phone: b.phone ?? null, full_name: b.full_name ?? null };
    users.push(u); TOKENS["access-token-new"] = u;
    return json(res, 201, u);
  }
  if (m === "POST" && path === "/auth/refresh") {
    const b = await readBody(req);
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
  const me = TOKENS[rawTok] ?? (auth === "Bearer access-token-new" ? users.at(-1) : undefined);
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
    if (!hasAccess(me.id, bid)) return err(res, 403, "BOOK_ACCESS_DENIED", "Access to this book has not been granted");
    if (what === "cover") return err(res, 404, "COVER_NOT_FOUND", "No cover");
    if (q.get("size") && !/^(original|thumb|medium)$/.test(q.get("size"))) return err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ loc: ["query", "size"], msg: "String should match pattern '^(original|thumb|medium)$'" }]);
    return json(res, 200, articles.filter((a) => a.book_id === bid).sort((a, b) => a.order_index - b.order_index).map((a) => { const p = getProg(me.id, a.id); return { article_id: a.id, title: a.title, order_index: a.order_index, page_count: a.page_count, processing_status: a.processing_status, reading_percentage: p.percentage, current_page: p.current_page, is_read: p.is_read }; }));
  }
  const ra = /^\/reader\/articles\/([^/]+)(\/content|\/watermark)?$/.exec(path);
  if (ra) {
    const [, aid, sub] = ra;
    const a = articles.find((x) => x.id === aid);
    if (!a) return err(res, 404, "ARTICLE_NOT_FOUND", "Article not found");
    if (!hasAccess(me.id, a.book_id)) return err(res, 403, "BOOK_ACCESS_DENIED", "Access to this book has not been granted");
    if (!sub) { const p = getProg(me.id, aid); return json(res, 200, { article_id: aid, book_id: a.book_id, title: a.title, format: a.format, mime_type: a.mime_type, page_count: a.page_count, processing_status: a.processing_status, text_extractable: a.text_extractable, file_version: a.file_version, content_updated_at: null, reading_percentage: p.percentage, current_page: p.current_page, features: { can_read: a.processing_status === "READY", can_download: false, can_print: false, can_search: a.text_extractable, has_toc: aid === ART_ID, watermark: true } }); }
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
    if (!hasAccess(me.id, a.book_id)) return err(res, 403, "BOOK_ACCESS_DENIED", "Access to this book has not been granted");
    const key = progKey(me.id, aid);
    if (what === "progress") {
      if (m === "PUT") { const b = await readBody(req); progress[key] = { ...getProg(me.id, aid), current_page: b.current_page, current_location: b.current_location ?? null, percentage: b.percentage ?? 0, updated_at: now() }; }
      return json(res, 200, getProg(me.id, aid));
    }
    if (what === "reading-heartbeat") { const b = await readBody(req); const p = getProg(me.id, aid); progress[key] = { ...p, reading_seconds: p.reading_seconds + (b.seconds ?? 0), current_page: b.current_page ?? p.current_page, last_read_at: now(), updated_at: now() }; return json(res, 200, progress[key]); }
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

  // ---- orders / notifications
  if (path === "/orders" && m === "GET") return json(res, 200, orders.filter((o) => o.user_id === me.id).map(withNames));
  if (path === "/orders" && m === "POST") { const b = await readBody(req); const bk = books.find((x) => x.id === b.book_id); if (!bk) return err(res, 404, "BOOK_NOT_FOUND", "Book not found"); if (hasAccess(me.id, bk.id)) return err(res, 409, "ALREADY_EXISTS", "Access already granted"); const o = { id: randomUUID(), user_id: me.id, book_id: bk.id, amount: bk.price, status: "PENDING", receipt_note: null, reviewed_by_admin_id: null, reviewed_at: null, reject_reason: null, created_at: now(), updated_at: now() }; orders.unshift(o); return json(res, 201, o); }
  const om = /^\/orders\/([^/]+)\/receipt$/.exec(path);
  if (om && m === "POST") { const o = orders.find((x) => x.id === om[1] && x.user_id === me.id); if (!o) return err(res, 404, "ORDER_NOT_FOUND", "Not found"); const b = await readBody(req); Object.assign(o, { status: "AWAITING_REVIEW", receipt_note: b.receipt_note ?? null, updated_at: now() }); return json(res, 200, o); }
  if (path === "/notifications" && m === "GET") { const mine = notifications.filter((n) => n._user === me.id).filter((n) => q.get("unread_only") !== "true" || !n.is_read).map(({ _user, ...n }) => n); return json(res, 200, paged(mine, Number(q.get("page") ?? 1), Number(q.get("page_size") ?? 20))); }
  if (path === "/notifications/unread-count") return json(res, 200, { unread: notifications.filter((n) => n._user === me.id && !n.is_read).length });
  if (path === "/notifications/read-all" && m === "POST") { notifications.forEach((n) => { if (n._user === me.id) n.is_read = true; }); return json(res, 200, { message: "ok" }); }
  const nm = /^\/notifications\/([^/]+)\/read$/.exec(path);
  if (nm && m === "POST") { const n = notifications.find((x) => x.id === nm[1]); if (n) n.is_read = true; return json(res, 200, { message: "ok" }); }

  // ---- admin
  if (path.startsWith("/admin/")) {
    if (me.role !== "ADMIN") return err(res, 403, "PERMISSION_DENIED", "Admin only");
    if (path === "/admin/stats") return json(res, 200, { users: { total: users.length, by_status: { ACTIVE: users.length }, by_role: { USER: users.length - 1, ADMIN: 1 } }, books: { total: books.length, by_status: { ACTIVE: books.length } }, articles: { total: articles.length, by_processing: { READY: articles.filter((a) => a.processing_status === "READY").length, PROCESSING: articles.filter((a) => a.processing_status === "PROCESSING").length } }, categories: categories.length, access: { total: access.length, by_status: { ACTIVE: access.filter((a) => a.status === "ACTIVE").length } }, annotations: annotations.length, active_sessions: 3 });
    if (path === "/admin/audit-logs") { if (audit500 || q.get("boom")) return err(res, 500, "INTERNAL_ERROR", "boom"); return json(res, 200, paged([{ id: "l1", admin_id: ADMIN.id, action: "BOOK_ACCESS_GRANTED", entity_type: "book_access", entity_id: "acc-1", meta: { book_id: BOOK_ID, user_id: USER.id }, ip_address: "127.0.0.1", created_at: now() }, { id: "l2", admin_id: null, action: "SUSPICIOUS_ACTIVITY", entity_type: "user", entity_id: USER.id, meta: {}, ip_address: null, created_at: now() }].filter((l) => !q.get("action") || l.action === q.get("action")))); }
    if (path === "/admin/categories" && m === "GET") return json(res, 200, paged(categories.filter((c) => !q.get("status") || c.status === q.get("status"))));
    if (path === "/admin/categories" && m === "POST") { const b = await readBody(req); if (categories.some((c) => c.name === b.name)) return err(res, 409, "ALREADY_EXISTS", "Category exists"); const c = { id: randomUUID(), name: b.name, slug: b.slug ?? b.name.toLowerCase().replace(/\s+/g, "-"), description: b.description ?? null, status: "ACTIVE", created_at: now(), updated_at: now() }; categories.push(c); return json(res, 201, c); }
    const cm = /^\/admin\/categories\/([^/]+)$/.exec(path);
    if (cm && m === "PATCH") { const c = categories.find((x) => x.id === cm[1]); if (!c) return err(res, 404, "CATEGORY_NOT_FOUND", "Not found"); const b = await readBody(req); Object.assign(c, Object.fromEntries(Object.entries(b).filter(([, v]) => v !== null && v !== undefined)), { updated_at: now() }); return json(res, 200, c); }
    if (path === "/admin/users" && m === "GET") { const s = (q.get("search") ?? "").toLowerCase(); return json(res, 200, paged(users.filter((u) => !s || (u.email ?? "").includes(s) || (u.full_name ?? "").toLowerCase().includes(s)).filter((u) => !q.get("status") || u.status === q.get("status")), Number(q.get("page") ?? 1), Number(q.get("page_size") ?? 20))); }
    if (path === "/admin/users" && m === "POST") { const b = await readBody(req); if (!b.password) return err(res, 422, "VALIDATION_ERROR", "Validation failed", [{ loc: ["body", "password"], msg: "Field required" }]); const u = { id: randomUUID(), email: b.email ?? null, phone: b.phone ?? null, full_name: b.full_name ?? null, role: "USER", status: "ACTIVE", created_at: now(), updated_at: now() }; users.push(u); return json(res, 201, u); }
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
    if (path === "/admin/books" && m === "GET") { const s = (q.get("search") ?? "").toLowerCase(); return json(res, 200, paged(books.filter((b) => !s || b.title.toLowerCase().includes(s)).filter((b) => !q.get("status") || b.status === q.get("status")), Number(q.get("page") ?? 1), Number(q.get("page_size") ?? 20))); }
    if (path === "/admin/books" && m === "POST") { const b = await readBody(req); const cat = categories.find((c) => c.id === b.category_id) ?? null; const bk = { id: randomUUID(), title: b.title, author: b.author ?? null, description: b.description ?? null, price: Number(b.price ?? 0).toFixed(2), status: "INACTIVE", category_id: cat?.id ?? null, category: cat, book_metadata: b.book_metadata ?? {}, created_at: now(), updated_at: now(), has_cover: false }; books.unshift(bk); return json(res, 201, bk); }
    const bm = /^\/admin\/books\/([^/]+)(?:\/(cover|articles))?(?:\/([^/]+))?(?:\/(file|toc))?$/.exec(path);
    if (bm) {
      const [, bid, sub, aid, sub2] = bm;
      const bk = books.find((x) => x.id === bid);
      if (!bk) return err(res, 404, "BOOK_NOT_FOUND", "Not found");
      if (!sub) { if (m === "PATCH") { const b = await readBody(req); if (b.status === "ACTIVE" && !articles.some((a) => a.book_id === bid && a.processing_status === "READY")) return err(res, 409, "BOOK_NOT_READY", "No READY articles"); Object.assign(bk, Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)), { updated_at: now() }); if (b.price != null) bk.price = Number(b.price).toFixed(2); if ("category_id" in b) bk.category = categories.find((c) => c.id === b.category_id) ?? null; } return json(res, 200, bk); }
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
    const aom = /^\/admin\/orders\/([^/]+)\/(approve|reject)$/.exec(path);
    if (aom && m === "POST") { const o = orders.find((x) => x.id === aom[1]); if (!o) return err(res, 404, "ORDER_NOT_FOUND", "Not found"); if (aom[2] === "approve") { Object.assign(o, { status: "APPROVED", reviewed_by_admin_id: me.id, reviewed_at: now(), updated_at: now() }); access.push({ id: randomUUID(), user_id: o.user_id, book_id: o.book_id, status: "ACTIVE", granted_at: now(), granted_by_admin_id: me.id, revoked_at: null, revoked_by_admin_id: null, created_at: now(), updated_at: now() }); notifications.unshift({ id: randomUUID(), type: "ORDER_APPROVED", title: "Buyurtma tasdiqlandi", body: null, is_read: false, meta: { order_id: o.id }, created_at: now(), _user: o.user_id }); } else { const b = await readBody(req); Object.assign(o, { status: "REJECTED", reject_reason: b.reason ?? null, reviewed_by_admin_id: me.id, reviewed_at: now(), updated_at: now() }); notifications.unshift({ id: randomUUID(), type: "ORDER_REJECTED", title: "Buyurtma rad etildi", body: b.reason ?? null, is_read: false, meta: { order_id: o.id }, created_at: now(), _user: o.user_id }); } return json(res, 200, o); }
    if (path === "/admin/export/users" || path === "/admin/export/audit-logs") { res.writeHead(200, { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${path.split("/").pop()}.xlsx"` }); return res.end(Buffer.from("PK\x03\x04fake-xlsx")); }
    return err(res, 404, "NOT_FOUND", `No admin route ${m} ${path}`);
  }
  return err(res, 404, "NOT_FOUND", "Not Found");
}).listen(PORT, () => console.log(`mock backend (OpenAPI 2026-09-21) on :${PORT}`));
