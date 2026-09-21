/**
 * Backend javob tiplari — manba: `https://articles.api.cognilabs.org/openapi.json` (2026-09-21).
 * Nomlar OpenAPI sxemalariga mos (`API.md` eskirgan). Sana — ISO-8601 (UTC).
 */

export type UUID = string;

export type Role = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";
export type BookStatus = "ACTIVE" | "INACTIVE";
export type CategoryStatus = "ACTIVE" | "INACTIVE";
export type ProcessingStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
export type AccessStatus = "ACTIVE" | "REVOKED";
export type AnnotationType = "HIGHLIGHT" | "BOOKMARK" | "NOTE";
export type OrderStatus = "PENDING" | "AWAITING_REVIEW" | "APPROVED" | "REJECTED";
export type NotificationType = "ACCESS_GRANTED" | "ACCESS_REVOKED" | "ORDER_CREATED" | "ORDER_APPROVED" | "ORDER_REJECTED" | "GENERAL";
export type AuditAction =
  | "BOOK_CREATED"
  | "BOOK_UPDATED"
  | "BOOK_ACTIVATED"
  | "BOOK_DEACTIVATED"
  | "BOOK_FILE_UPLOADED"
  | "BOOK_COVER_UPLOADED"
  | "CATEGORY_CREATED"
  | "CATEGORY_UPDATED"
  | "USER_ACTIVATED"
  | "USER_DEACTIVATED"
  | "USER_BLOCKED"
  | "BOOK_ACCESS_GRANTED"
  | "BOOK_ACCESS_REVOKED"
  | "SESSION_REVOKED"
  | "USER_CREATED"
  | "PASSWORD_RESET"
  | "ORDER_APPROVED"
  | "ORDER_REJECTED"
  | "SUSPICIOUS_ACTIVITY";

export const AUDIT_ACTIONS: readonly AuditAction[] = [
  "BOOK_CREATED",
  "BOOK_UPDATED",
  "BOOK_ACTIVATED",
  "BOOK_DEACTIVATED",
  "BOOK_FILE_UPLOADED",
  "BOOK_COVER_UPLOADED",
  "CATEGORY_CREATED",
  "CATEGORY_UPDATED",
  "USER_ACTIVATED",
  "USER_DEACTIVATED",
  "USER_BLOCKED",
  "BOOK_ACCESS_GRANTED",
  "BOOK_ACCESS_REVOKED",
  "SESSION_REVOKED",
  "USER_CREATED",
  "PASSWORD_RESET",
  "ORDER_APPROVED",
  "ORDER_REJECTED",
  "SUSPICIOUS_ACTIVITY",
];

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

export interface MessageResponse {
  message: string;
}

/* ---------- Auth / users ---------- */

export interface User {
  id: UUID;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  role: Role;
  status: UserStatus;
  /** 2FA holati (backend 2026-09-21, B13) */
  two_factor_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in: number;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

export interface TwoFactorSetup {
  secret: string;
  provisioning_uri: string;
}

export interface Session {
  id: UUID;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_active_at: string;
  expires_at: string;
  revoked_at: string | null;
  is_current: boolean;
}

/* ---------- Catalog / library ---------- */

export interface Category {
  id: UUID;
  name: string;
  slug: string;
  description: string | null;
  status: CategoryStatus;
  created_at: string;
  updated_at: string;
}

/** GET /catalog elementi — public sotuv ro'yxati (kontent himoyalangan). `price` — decimal string ("30000.00"). */
export interface CatalogItem {
  book_id: UUID;
  title: string;
  author: string | null;
  description: string | null;
  category_name: string | null;
  price: string;
  has_cover: boolean;
  article_count: number;
}

/** GET /library elementi — kitob darajasida; maqolalar `/reader/books/{id}/articles` da. */
export interface LibraryItem {
  book_id: UUID;
  title: string;
  author: string | null;
  description: string | null;
  category_id: UUID | null;
  category_name: string | null;
  has_cover: boolean;
  price: string;
  article_count: number;
  read_count: number;
  overall_percentage: number;
  last_read_at: string | null;
  access_granted_at: string;
}

/* ---------- Reader (maqola bo'yicha) ---------- */

/** GET /reader/books/{book_id}/articles elementi */
export interface ArticleListItem {
  article_id: UUID;
  title: string;
  order_index: number;
  page_count: number | null;
  processing_status: ProcessingStatus;
  reading_percentage: number;
  /** 0 — boshlanmagan; 1-based */
  current_page: number;
  is_read: boolean;
}

export interface ReaderFeatures {
  can_read?: boolean;
  can_download?: boolean;
  can_print?: boolean;
  can_search: boolean;
  has_toc: boolean;
  watermark?: boolean;
}

/** GET /reader/articles/{article_id} */
export interface ReaderMeta {
  article_id: UUID;
  book_id: UUID;
  title: string;
  format: string | null;
  mime_type: string | null;
  page_count: number | null;
  processing_status: ProcessingStatus;
  text_extractable: boolean;
  file_version: number;
  content_updated_at: string | null;
  reading_percentage: number;
  current_page: number;
  features: ReaderFeatures;
}

/** GET /reader/articles/{article_id}/watermark — HMAC imzolangan */
export interface WatermarkPayload {
  watermark_text: string;
  trace_id: string;
  user_ref: string;
  issued_at: number;
  signature: string;
}

export interface ReadingProgress {
  article_id: UUID;
  current_page: number;
  current_location: Record<string, unknown> | null;
  percentage: number;
  is_read: boolean;
  reading_seconds: number;
  last_read_at: string | null;
  updated_at: string | null;
}

export interface Annotation {
  id: UUID;
  article_id: UUID;
  type: AnnotationType;
  page: number | null;
  /** Belgi joyi (opaque JSON, ≤ 32 KB). Highlight: `{ page, rects: [[x,y,w,h], …] }` */
  location_data: Record<string, unknown> | null;
  selected_text: string | null;
  note_text: string | null;
  color: string | null;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchMatch {
  page: number;
  snippet: string;
}

export interface SearchResponse {
  article_id: UUID;
  query: string;
  text_available: boolean;
  total_matches: number;
  matches: SearchMatch[];
}

export interface TocEntry {
  level: number;
  title: string;
  page: number | null;
}

export interface TocResponse {
  article_id: UUID;
  entries: TocEntry[];
}

/* ---------- Orders / notifications ---------- */

export interface Order {
  id: UUID;
  user_id: UUID;
  book_id: UUID;
  amount: string;
  status: OrderStatus;
  receipt_note: string | null;
  reviewed_by_admin_id: UUID | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  /** Admin ro'yxatlari uchun (B5) — foydalanuvchi so'rovida bo'lmasligi mumkin */
  user_email?: string | null;
  user_full_name?: string | null;
  book_title?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: UUID;
  type: NotificationType;
  title: string;
  body: string | null;
  is_read: boolean;
  meta: Record<string, unknown>;
  created_at: string;
}

/* ---------- Admin ---------- */

export interface Book {
  id: UUID;
  title: string;
  author: string | null;
  description: string | null;
  /** decimal string ("30000.00") */
  price: string;
  status: BookStatus;
  category_id: UUID | null;
  category: Category | null;
  book_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  has_cover: boolean;
}

export interface Article {
  id: UUID;
  book_id: UUID;
  title: string;
  order_index: number;
  mime_type: string | null;
  file_size: number | null;
  format: string | null;
  page_count: number | null;
  processing_status: ProcessingStatus;
  processing_error: string | null;
  text_extractable: boolean;
  file_version: number;
  content_updated_at: string | null;
  article_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  has_source_file: boolean;
}

export interface BookAccess {
  id: UUID;
  user_id: UUID;
  book_id: UUID;
  status: AccessStatus;
  granted_at: string;
  granted_by_admin_id: UUID | null;
  revoked_at: string | null;
  revoked_by_admin_id: UUID | null;
  /** B5: N+1 o'rniga backend qo'shib beradi */
  user_email?: string | null;
  user_full_name?: string | null;
  book_title?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: UUID;
  admin_id: UUID | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  meta: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

/** GET /admin/stats — taqsimotlar `by_*` ixtiyoriy. */
export interface AdminStats {
  users: { total: number; by_status?: Record<string, number>; by_role?: Record<string, number> };
  books: { total: number; by_status?: Record<string, number> };
  articles?: { total: number; by_processing?: Record<string, number> };
  categories: number;
  access: { total: number; by_status?: Record<string, number> };
  annotations: number;
  active_sessions: number;
}
