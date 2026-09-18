/**
 * HTTP klient — API.md konvensiyalari:
 *  - Authorization: Bearer <access_token>
 *  - 401 → POST /auth/refresh (rotatsiya) → so'rovni bir marta qayta yuborish
 *  - Xatolik konverti: { error: { code, message, details } } → ApiError
 *  - X-Device-Id sarlavhasi (ixtiyoriy) sessiyani qurilmaga bog'laydi
 */
import { API_PREFIX, env } from "@/lib/env";
import { tokenStore } from "./token-store";
import type { ApiErrorBody, AuthTokens } from "./types";

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
    err?.message ?? res.statusText ?? "So'rov bajarilmadi",
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
        headers: { "Content-Type": "application/json", "X-Device-Id": tokenStore.getDeviceId() },
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
  const { method = "GET", body, query, auth = true, noRefresh = false, signal } = opts;
  const headers: Record<string, string> = { Accept: "application/json, */*", ...opts.headers };
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (typeof window !== "undefined") headers["X-Device-Id"] = tokenStore.getDeviceId();

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

/** Foydalanuvchiga ko'rsatiladigan xabar (VALIDATION_ERROR details'ini ham ochadi). */
export function errorMessage(e: unknown, fallback = "Noma'lum xatolik"): string {
  if (isApiError(e)) {
    if (e.code === "VALIDATION_ERROR" && Array.isArray(e.details)) {
      const parts = (e.details as Array<{ loc?: unknown[]; msg?: string; message?: string }>)
        .map((d) => `${Array.isArray(d.loc) ? String(d.loc.at(-1)) + ": " : ""}${d.msg ?? d.message ?? ""}`)
        .filter(Boolean);
      if (parts.length) return parts.join("; ");
    }
    return e.message || e.code;
  }
  if (e instanceof Error) return e.message || fallback;
  return fallback;
}
