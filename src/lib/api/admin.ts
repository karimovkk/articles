/** Admin API — barcha yo'llar ADMIN rolini talab qiladi (server tomonda tekshiriladi). */
import { api, apiUpload, type UploadOptions } from "./client";
import type { AdminStats, AuditLog, Book, BookAccess, Category, Paginated, Session, User, UserStatus } from "./types";

type Page = { page?: number; page_size?: number };

function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  return ((raw as { items?: T[] } | null)?.items) ?? [];
}

export interface BookInput {
  title: string;
  author?: string | null;
  description?: string | null;
  category_id?: string | null;
  language?: string | null;
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
  setUserStatus(id: string, status: UserStatus) {
    return api<User>(`/admin/users/${id}/status`, { method: "PATCH", body: { status } });
  },
  async userBooks(id: string): Promise<BookAccess[]> {
    return asList<BookAccess>(await api(`/admin/users/${id}/books`, { query: { page_size: 100 } }));
  },
  async userSessions(id: string): Promise<Session[]> {
    return asList<Session>(await api(`/admin/users/${id}/sessions`));
  },
  revokeSession(sessionId: string) {
    return api<void>(`/admin/sessions/${sessionId}`, { method: "DELETE" });
  },

  // ---- Books
  books(q: Page & { search?: string; status?: string; category_id?: string } = {}) {
    return api<Paginated<Book>>("/admin/books", { query: { page: 1, page_size: 20, ...q } });
  },
  book(id: string) {
    return api<Book>(`/admin/books/${id}`);
  },
  createBook(input: BookInput) {
    return api<Book>("/admin/books", { method: "POST", body: input });
  },
  updateBook(id: string, patch: Partial<BookInput> & { status?: string }) {
    return api<Book>(`/admin/books/${id}`, { method: "PATCH", body: patch });
  },
  /** PDF yuklash — progress bilan (XHR). Klient tekshiruvi: `lib/uploads.ts`. */
  uploadBookFile(id: string, file: File, opts?: UploadOptions) {
    const fd = new FormData();
    fd.append("file", file, file.name);
    return apiUpload<Book>(`/admin/books/${id}/file`, fd, opts);
  },
  uploadCover(id: string, file: File, opts?: UploadOptions) {
    const fd = new FormData();
    fd.append("file", file, file.name);
    return apiUpload<Book>(`/admin/books/${id}/cover`, fd, opts);
  },

  // ---- Categories
  async categories(): Promise<Category[]> {
    return asList<Category>(await api("/admin/categories", { query: { page_size: 100 } }));
  },
  createCategory(input: { name: string; slug?: string; description?: string }) {
    return api<Category>("/admin/categories", { method: "POST", body: input });
  },
  updateCategory(id: string, patch: { name?: string; slug?: string; description?: string; is_active?: boolean }) {
    return api<Category>(`/admin/categories/${id}`, { method: "PATCH", body: patch });
  },

  // ---- Book access
  access(q: Page & { user_id?: string; book_id?: string; status?: string } = {}) {
    return api<Paginated<BookAccess>>("/admin/book-access", { query: { page: 1, page_size: 20, ...q } });
  },
  grantAccess(input: { user_id: string; book_id: string; note?: string }) {
    return api<BookAccess>("/admin/book-access", { method: "POST", body: input });
  },
  revokeAccess(accessId: string) {
    return api<BookAccess>(`/admin/book-access/${accessId}/revoke`, { method: "POST" });
  },

  // ---- Audit
  auditLogs(q: Page & { admin_id?: string; action?: string; entity_type?: string } = {}) {
    return api<Paginated<AuditLog>>("/admin/audit-logs", { query: { page: 1, page_size: 30, ...q } });
  },
};
