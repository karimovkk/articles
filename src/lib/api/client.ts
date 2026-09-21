/**
 * HTTP klient — API.md konvensiyalari va FE registri 0-bo'lim kelishuvi:
 *  - Authorization: Bearer <access_token>
 *  - 401 → POST /auth/refresh (rotatsiya) → so'rovni bir marta qayta yuborish
 *  - Xatolik konverti: { error: { code, message, details } } → ApiError
 *  - X-Device-Id sarlavhasi sessiyani qurilmaga bog'laydi
 *  - ngrok-skip-browser-warning: 1 — dev'da ngrok orqali ulanganda ogohlantirish sahifasi o'rniga API
 */
import { API_PREFIX, env } from "@/lib/env";
import { t } from "@/i18n";
import { messageForCode } from "./error-codes";
import { tokenStore } from "./token-store";
import type { ApiErrorBody, AuthTokens } from "./types";

/** Har so'rovga qo'shiladigan umumiy sarlavhalar (brauzerda). */
function baseHeaders(): Record<string, string> {
  const h: Record<string, string> = { "ngrok-skip-browser-warning": "1" };
  if (typeof window !== "undefined") h["X-Device-Id"] = tokenStore.getDeviceId();
  return h;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
  get isAuth() {
    return this.status === 401;
  }
}

export const AUTH_EVENT = "a365:auth-changed";
export type AuthChangeReason = "login" | "logout" | "expired";
export function emitAuthChanged(reason: AuthChangeReason) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<AuthChangeReason>(AUTH_EVENT, { detail: reason }));
  }
}

export type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  /** false → Authorization qo'shilmaydi (login/register/refresh) */
  auth?: boolean;
  /** 401 da refresh urinilmasin */
  noRefresh?: boolean;
  signal?: AbortSignal;
  /** Sahifa yopilayotganda (pagehide) ham yetib borsin — brauzer so'rovni bekor qilmaydi (body ≤ 64 KB) */
  keepalive?: boolean;
}

export function apiUrl(path: string, query?: Query): string {
  const base = `${env.apiBaseUrl}${API_PREFIX}`;
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${url}${url.includes("?") ? "&" : "?"}${s}` : url;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    /* JSON emas */
  }
  const err = body?.error;
  return new ApiError(
    res.status,
    err?.code ?? (res.status === 401 ? "AUTHENTICATION_REQUIRED" : `HTTP_${res.status}`),
    err?.message ?? res.statusText ?? t("api.requestFailed"),
    err?.details,
  );
}

/** Bir vaqtda faqat bitta refresh (single-flight) — rotatsiya buzilmasligi uchun. */
let refreshInFlight: Promise<boolean> | null = null;

export async function refreshTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refresh = tokenStore.getRefresh();
    if (!refresh) return false;
    try {
      const res = await fetch(apiUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...baseHeaders() },
        body: JSON.stringify({ refresh_token: refresh }),
        cache: "no-store",
      });
      if (!res.ok) return false;
      const data = (await res.json()) as AuthTokens;
      if (!data.access_token) return false;
      tokenStore.set(data.access_token, data.refresh_token ?? refresh);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Xom Response qaytaradi (Range/stream so'rovlar uchun). Auth + refresh mantiqi bir xil. */
export async function apiRaw(path: string, opts: RequestOptions = {}): Promise<Response> {
  const { method = "GET", body, query, auth = true, noRefresh = false, signal, keepalive } = opts;
  const headers: Record<string, string> = { Accept: "application/json, */*", ...baseHeaders(), ...opts.headers };
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";

  const doFetch = () => {
    const h = { ...headers };
    if (auth) {
      const token = tokenStore.getAccess();
      if (token) h.Authorization = `Bearer ${token}`;
    }
    return fetch(apiUrl(path, query), {
      method,
      headers: h,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal,
      keepalive,
      cache: "no-store",
    });
  };

  let res = await doFetch();
  if (res.status === 401 && auth && !noRefresh) {
    const ok = await refreshTokens();
    if (ok) {
      res = await doFetch();
    } else {
      tokenStore.clear();
      emitAuthChanged("expired");
    }
  }
  return res;
}

/** JSON so'rov: muvaffaqiyatda T, aks holda ApiError tashlaydi. */
export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await apiRaw(path, opts);
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("json")) return (await res.text()) as unknown as T;
  return (await res.json()) as T;
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/**
 * Foydalanuvchiga ko'rsatiladigan xabar (FE-0.5):
 *  VALIDATION_ERROR details → maydon xatolari; ma'lum kod → ERROR_MESSAGES; aks holda backend message.
 */
export function errorMessage(e: unknown, fallback?: string): string {
  fallback ??= t("common.unknownError");
  if (isApiError(e)) {
    if (e.code === "VALIDATION_ERROR" && Array.isArray(e.details)) {
      const parts = (e.details as Array<{ loc?: unknown[]; msg?: string; message?: string }>)
        .map((d) => `${Array.isArray(d.loc) ? String(d.loc.at(-1)) + ": " : ""}${d.msg ?? d.message ?? ""}`)
        .filter(Boolean);
      if (parts.length) return parts.join("; ");
    }
    return messageForCode(e.code, e.status) ?? e.message ?? e.code;
  }
  if (isNetworkError(e)) return messageForCode("NETWORK_ERROR")!;
  if (e instanceof Error) return e.message || fallback;
  return fallback;
}

/** fetch tarmoq xatosi (server yo'q / CORS / offline) — brauzerlar TypeError tashlaydi. */
export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError && /fetch|network|load failed/i.test(e.message);
}

/* ------------------------------------------------------------------ */
/* Fayl yuklash (FE-6.5): XHR — fetch'da upload progress yo'q.        */

export interface UploadOptions {
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}

function xhrOnce(url: string, form: FormData, opts: UploadOptions): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Accept", "application/json");
    for (const [k, v] of Object.entries(baseHeaders())) xhr.setRequestHeader(k, v);
    const token = tokenStore.getAccess();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) opts.onProgress?.(ev.loaded, ev.total);
    };
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new TypeError("Failed to fetch"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    opts.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

/** Multipart yuklash: Bearer + 401 → refresh → bir marta qayta; xato konverti → ApiError. */
export async function apiUpload<T = unknown>(path: string, form: FormData, opts: UploadOptions = {}): Promise<T> {
  const url = apiUrl(path);
  let res = await xhrOnce(url, form, opts);
  if (res.status === 401) {
    const ok = await refreshTokens();
    if (ok) {
      res = await xhrOnce(url, form, opts);
    } else {
      tokenStore.clear();
      emitAuthChanged("expired");
    }
  }
  if (res.status >= 200 && res.status < 300) {
    if (!res.body) return undefined as T;
    try {
      return JSON.parse(res.body) as T;
    } catch {
      return res.body as unknown as T;
    }
  }
  let err: ApiErrorBody["error"] | undefined;
  try {
    err = (JSON.parse(res.body) as ApiErrorBody).error;
  } catch {
    /* JSON emas */
  }
  throw new ApiError(res.status, err?.code ?? (res.status === 413 ? "PAYLOAD_TOO_LARGE" : `HTTP_${res.status}`), err?.message ?? t("api.uploadFailed"), err?.details);
}
