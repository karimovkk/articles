import { api, emitAuthChanged } from "./client";
import { tokenStore } from "./token-store";
import type { LoginResponse, User } from "./types";

/** Email yoki telefon ekanini aniqlab, backend kutgan maydonlarga ajratadi. */
export function splitIdentifier(identifier: string): { email?: string; phone?: string } {
  const v = identifier.trim();
  if (v.includes("@")) return { email: v.toLowerCase() };
  return { phone: v.replace(/[\s-]/g, "") };
}

export interface RegisterInput {
  identifier: string;
  password: string;
  full_name?: string;
}

/** Turli javob shakllarini ({access_token,...,user} yoki {tokens:{...},user}) yagona ko'rinishga keltiradi. */
function normalizeLogin(raw: unknown): LoginResponse {
  const r = (raw ?? {}) as Record<string, unknown>;
  const tokens = (r.tokens as Record<string, unknown> | undefined) ?? r;
  return {
    access_token: String(tokens.access_token ?? ""),
    refresh_token: String(tokens.refresh_token ?? ""),
    token_type: tokens.token_type as string | undefined,
    expires_in: tokens.expires_in as number | undefined,
    user: r.user as User | undefined,
  };
}

export const authApi = {
  async register(input: RegisterInput): Promise<LoginResponse> {
    const raw = await api("/auth/register", {
      method: "POST",
      auth: false,
      body: { ...splitIdentifier(input.identifier), password: input.password, full_name: input.full_name || undefined },
    });
    const data = normalizeLogin(raw);
    // Ba'zi backendlar ro'yxatdan o'tishda token qaytarmaydi — u holda login qilinadi
    if (!data.access_token) return authApi.login(input.identifier, input.password);
    tokenStore.set(data.access_token, data.refresh_token);
    emitAuthChanged("login");
    return data;
  },

  async login(identifier: string, password: string): Promise<LoginResponse> {
    const raw = await api("/auth/login", {
      method: "POST",
      auth: false,
      body: { ...splitIdentifier(identifier), identifier: identifier.trim(), password },
    });
    const data = normalizeLogin(raw);
    if (!data.access_token) throw new Error("Backend access_token qaytarmadi");
    tokenStore.set(data.access_token, data.refresh_token);
    emitAuthChanged("login");
    return data;
  },

  async logout(): Promise<void> {
    const refresh = tokenStore.getRefresh();
    try {
      await api("/auth/logout", { method: "POST", noRefresh: true, body: refresh ? { refresh_token: refresh } : undefined });
    } catch {
      /* token allaqachon bekor qilingan bo'lishi mumkin */
    } finally {
      tokenStore.clear();
      emitAuthChanged("logout");
    }
  },

  me(): Promise<User> {
    return api<User>("/auth/me");
  },

  updateProfile(patch: { full_name: string }): Promise<User> {
    return api<User>("/me", { method: "PATCH", body: patch });
  },
};
