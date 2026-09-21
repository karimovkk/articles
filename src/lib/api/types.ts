/**
 * Backend (API.md) javob tiplari. Aniq sxema /docs (Swagger) da; bu yerda
 * hujjatlardan kelib chiqqan minimal, moslashuvchan tiplar.
 */

export type UUID = string;

export type Role = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";
export type BookStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | "ACTIVE" | "INACTIVE" | "DRAFT" | string;
export type AccessStatus = "ACTIVE" | "REVOKED" | string;
export type AnnotationType = "HIGHLIGHT" | "BOOKMARK" | "NOTE";

export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  pages: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface User {
  id: UUID;
  email?: string | null;
  phone?: string | null;
  full_name?: string | null;
  role: Role;
  status: UserStatus;
  created_at?: string;
  last_login_at?: string | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
}

export interface LoginResponse extends AuthTokens {
  user?: User;
}

export interface Category {
  id: UUID;
  name: string;
  slug?: string;
  description?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export interface ReadingProgress {
  book_id?: UUID;
  current_page: number;
  total_pages?: number | null;
  percent?: number | null;
  location?: Record<string, unknown> | null;
  updated_at?: string;
}

export interface Book {
  id: UUID;
  title: string;
  author?: string | null;
  description?: string | null;
  summary?: string | null;
  category_id?: UUID | null;
  category?: Category | null;
  status?: BookStatus;
  page_count?: number | null;
  language?: string | null;
  has_source_file?: boolean;
  has_cover?: boolean;
  text_available?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** GET /library elementi — backend `book` ichida yoki tekis qaytarishi mumkin (normalize qilinadi). */
export interface LibraryItem {
  id: UUID;
  book: Book;
  progress?: ReadingProgress | null;
  granted_at?: string | null;
  access_status?: AccessStatus;
}

export interface ReaderMeta {
  book_id: UUID;
  title: string;
  author?: string | null;
  page_count: number;
  progress?: ReadingProgress | null;
  features?: { search?: boolean; toc?: boolean; text_available?: boolean; [k: string]: unknown };
  text_available?: boolean;
  file_size?: number | null;
}

export interface WatermarkPayload {
  label: string;
  signature?: string;
  trace_id?: string;
  user_ref?: string;
  issued_at?: string;
  [k: string]: unknown;
}

export interface Annotation {
  id: UUID;
  book_id: UUID;
  type: AnnotationType;
  page: number;
  text?: string | null;
  note?: string | null;
  color?: string | null;
  /** Belgi joyi (backend: opaque JSON, ≤ 32 KB). Highlight: `{ page, rects: [[x,y,w,h], …] }` */
  location_data?: Record<string, unknown> | null;
  /** @deprecated eski nom — faqat o'qishda qabul qilinadi */
  location?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface SearchHit {
  page: number;
  snippet: string;
  rank?: number;
}

export interface SearchResponse {
  query?: string;
  text_available: boolean;
  items?: SearchHit[];
  results?: SearchHit[];
  total?: number;
}

export interface TocEntry {
  title: string;
  page: number;
  level?: number;
  children?: TocEntry[];
}

export interface Session {
  id: UUID;
  device_id?: string | null;
  device_name?: string | null;
  user_agent?: string | null;
  ip?: string | null;
  ip_address?: string | null;
  created_at?: string;
  last_seen_at?: string | null;
  expires_at?: string | null;
  is_current?: boolean;
  revoked_at?: string | null;
}

export interface BookAccess {
  id: UUID;
  user_id: UUID;
  book_id: UUID;
  status: AccessStatus;
  granted_at?: string;
  granted_by?: UUID | null;
  revoked_at?: string | null;
  revoked_by?: UUID | null;
  user?: User;
  book?: Book;
}

export interface AuditLog {
  id: UUID;
  admin_id: UUID;
  action: string;
  entity_type?: string | null;
  entity_id?: UUID | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  ip_address?: string | null;
  created_at: string;
}

/** GET /admin/stats (backend, 2026-09-21) — taqsimotlar `by_*` ixtiyoriy. */
export interface AdminStats {
  users: { total: number; by_status?: Record<string, number>; by_role?: Record<string, number> };
  books: { total: number; by_status?: Record<string, number> };
  articles?: { total: number; by_processing?: Record<string, number> };
  categories: number;
  access: { total: number; by_status?: Record<string, number> };
  annotations: number;
  active_sessions: number;
}

/** GET /catalog elementi — public sotuv ro'yxati (kontent himoyalangan). */
export interface CatalogItem {
  book_id: UUID;
  title: string;
  author?: string | null;
  description?: string | null;
  category_name?: string | null;
  price?: number | string | null;
  has_cover?: boolean;
  article_count?: number | null;
}
