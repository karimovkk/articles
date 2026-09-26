/** Admin API — barcha yo'llar ADMIN rolini talab qiladi (server tomonda tekshiriladi). Manba: OpenAPI 2026-09-21. */
import { api, apiErrorFrom, apiRaw, apiUpload, type UploadOptions } from "./client";
import type {
  AdminDevice,
  AdminStats,
  Article,
  AuditAction,
  AuditLog,
  Book,
  BookAccess,
  BookStatus,
  Category,
  CategoryStatus,
  MessageResponse,
  Order,
  OrderStatus,
  Paginated,
  Session,
  TocEntry,
  User,
  UserStatus,
} from "./types";

type Page = { page?: number; page_size?: number };

export interface BookInput {
  title: string;
  author?: string | null;
  description?: string | null;
  category_id?: string | null;
  /** decimal — string ("30000.00") yoki number */
  price?: string | number | null;
  /** 37: tekin kitob — narx 0 bilan yuboriladi (backend `is_free` ni qo'shguncha e'tiborsiz qoldirishi mumkin) */
  is_free?: boolean;
  book_metadata?: Record<string, unknown>;
}

export const adminApi = {
  // ---- Stats (FE-6.9)
  stats() {
    return api<AdminStats>("/admin/stats");
  },

  // ---- Users
  users(q: Page & { search?: string; status?: UserStatus | "" } = {}) {
    return api<Paginated<User>>("/admin/users", { query: { page: 1, page_size: 20, ...q } });
  },
  user(id: string) {
    return api<User>(`/admin/users/${id}`);
  },
  /** PM Q1: admin foydalanuvchi yaratadi (kontakt ixtiyoriy, parol majburiy). */
  createUser(input: { email?: string | null; phone?: string | null; full_name?: string | null; password: string }) {
    return api<User>("/admin/users", { method: "POST", body: input });
  },
  setUserStatus(id: string, status: UserStatus) {
    return api<User>(`/admin/users/${id}/status`, { method: "PATCH", body: { status } });
  },
  /** S-12: parolni faqat admin tiklaydi. */
  resetPassword(id: string, newPassword: string) {
    return api<MessageResponse>(`/admin/users/${id}/reset-password`, { method: "POST", body: { new_password: newPassword } });
  },
  userBooks(id: string): Promise<BookAccess[]> {
    return api<BookAccess[]>(`/admin/users/${id}/books`);
  },
  userSessions(id: string): Promise<Session[]> {
    return api<Session[]>(`/admin/users/${id}/sessions`);
  },
  revokeAllSessions(userId: string) {
    return api<MessageResponse>(`/admin/users/${userId}/sessions`, { method: "DELETE" });
  },
  revokeSession(sessionId: string) {
    return api<MessageResponse>(`/admin/sessions/${sessionId}`, { method: "DELETE" });
  },

  // ---- 38: bog'langan qurilmalar (foydalanuvchi faqat 2 ta; bo'shatish faqat admin, sabab majburiy)
  userDevices(userId: string): Promise<AdminDevice[]> {
    return api<AdminDevice[]>(`/admin/users/${userId}/devices`);
  },
  removeDevice(userId: string, deviceId: string, reason: string) {
    return api<MessageResponse>(`/admin/users/${userId}/devices/${deviceId}`, { method: "DELETE", body: { reason } });
  },
  removeAllDevices(userId: string, reason: string) {
    return api<MessageResponse>(`/admin/users/${userId}/devices`, { method: "DELETE", body: { reason } });
  },

  // ---- Books
  books(q: Page & { search?: string; status?: BookStatus | ""; category_id?: string } = {}) {
    return api<Paginated<Book>>("/admin/books", { query: { page: 1, page_size: 20, ...q } });
  },
  book(id: string) {
    return api<Book>(`/admin/books/${id}`);
  },
  createBook(input: BookInput) {
    return api<Book>("/admin/books", { method: "POST", body: input });
  },
  updateBook(id: string, patch: Partial<BookInput> & { status?: BookStatus }) {
    return api<Book>(`/admin/books/${id}`, { method: "PATCH", body: patch });
  },
  uploadCover(id: string, file: File, opts?: UploadOptions) {
    const fd = new FormData();
    fd.append("file", file, file.name);
    return apiUpload<Book>(`/admin/books/${id}/cover`, fd, opts);
  },

  // ---- Articles (kitob ichidagi maqolalar — fayl har biriga alohida)
  articles(bookId: string): Promise<Article[]> {
    return api<Article[]>(`/admin/books/${bookId}/articles`);
  },
  createArticle(bookId: string, input: { title: string; order_index?: number }) {
    return api<Article>(`/admin/books/${bookId}/articles`, { method: "POST", body: input });
  },
  updateArticle(bookId: string, articleId: string, patch: { title?: string | null; order_index?: number | null }) {
    return api<Article>(`/admin/books/${bookId}/articles/${articleId}`, { method: "PATCH", body: patch });
  },
  deleteArticle(bookId: string, articleId: string) {
    return api<MessageResponse>(`/admin/books/${bookId}/articles/${articleId}`, { method: "DELETE" });
  },
  /** PDF yuklash — progress bilan (XHR). Klient tekshiruvi: `lib/uploads.ts`. */
  uploadArticleFile(bookId: string, articleId: string, file: File, opts?: UploadOptions) {
    const fd = new FormData();
    fd.append("file", file, file.name);
    return apiUpload<Article>(`/admin/books/${bookId}/articles/${articleId}/file`, fd, opts);
  },
  /** Qo'lda mundarija (T1-24 / FE-6.10). */
  setArticleToc(bookId: string, articleId: string, entries: Array<Pick<TocEntry, "title" | "page"> & { level?: number }>) {
    return api<Article>(`/admin/books/${bookId}/articles/${articleId}/toc`, { method: "PUT", body: { entries } });
  },

  // ---- Categories
  categories(q: Page & { search?: string; status?: CategoryStatus | "" } = {}) {
    return api<Paginated<Category>>("/admin/categories", { query: { page: 1, page_size: 100, ...q } });
  },
  createCategory(input: { name: string; slug?: string | null; description?: string | null }) {
    return api<Category>("/admin/categories", { method: "POST", body: input });
  },
  updateCategory(id: string, patch: { name?: string | null; description?: string | null; status?: CategoryStatus | null }) {
    return api<Category>(`/admin/categories/${id}`, { method: "PATCH", body: patch });
  },

  // ---- Book access
  access(q: Page & { user_id?: string; book_id?: string; status?: string } = {}) {
    return api<Paginated<BookAccess>>("/admin/book-access", { query: { page: 1, page_size: 20, ...q } });
  },
  grantAccess(input: { user_id: string; book_id: string }) {
    return api<BookAccess>("/admin/book-access", { method: "POST", body: input });
  },
  revokeAccess(accessId: string) {
    return api<BookAccess>(`/admin/book-access/${accessId}/revoke`, { method: "POST" });
  },

  // ---- Orders (PM S-16)
  orders(q: Page & { status?: OrderStatus | "" } = {}) {
    return api<Paginated<Order>>("/admin/orders", { query: { page: 1, page_size: 20, ...q } });
  },
  approveOrder(id: string) {
    return api<Order>(`/admin/orders/${id}/approve`, { method: "POST" });
  },
  /** Rad etish — sabab majburiy (bo'sh → 422), foydalanuvchiga ko'rsatiladi */
  rejectOrder(id: string, reason: string) {
    return api<Order>(`/admin/orders/${id}/reject`, { method: "POST", body: { reason } });
  },

  // ---- Audit
  auditLogs(q: Page & { admin_id?: string; action?: AuditAction | ""; entity_type?: string } = {}) {
    return api<Paginated<AuditLog>>("/admin/audit-logs", { query: { page: 1, page_size: 30, ...q } });
  },

  // ---- Export (XLSX; fayl nomi `Content-Disposition` dan, bo'lmasa FE default)
  /** Chek fayli (rasm yoki PDF) — blob; yo'q bo'lsa 404 `RECEIPT_NOT_FOUND` (ApiError) */
  async orderReceipt(id: string, signal?: AbortSignal): Promise<Blob> {
    const res = await apiRaw(`/admin/orders/${id}/receipt`, { headers: { Accept: "image/*, application/pdf" }, signal });
    if (!res.ok) throw await apiErrorFrom(res);
    return res.blob();
  },
  async exportBlob(kind: "users" | "audit-logs"): Promise<{ blob: Blob; filename: string | null }> {
    const res = await apiRaw(`/admin/export/${kind}`, { headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, */*" } });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const cd = res.headers.get("Content-Disposition") ?? "";
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    return { blob: await res.blob(), filename: m ? decodeURIComponent(m[1]) : null };
  },
};
