/**
 * Auth (OpenAPI): POST /auth/login {identifier, password, device_name?, totp_code?} → LoginResponse;
 * POST /auth/register {email|phone, password, full_name?} → UserResponse (token YO'Q → keyin login);
 * POST /auth/logout {refresh_token}; GET /auth/me; PATCH /me; POST /me/password; /me/2fa/*.
 */
import { api, emitAuthChanged } from "./client";
import { tokenStore } from "./token-store";
import { shortAgent } from "@/lib/agent";
import type { LoginResponse, MessageResponse, TwoFactorSetup, User } from "./types";

/** Email yoki telefon ekanini aniqlab, backend kutgan maydonlarga ajratadi (register uchun). */
export function splitIdentifier(identifier: string): { email?: string; phone?: string } {
  const v = identifier.trim();
  if (v.includes("@")) return { email: v.toLowerCase() };
  return { phone: v.replace(/[\s-]/g, "") };
}

/** Sessiyalar ro'yxatida ko'rinadigan qisqa qurilma nomi (brauzer · OS). */
export function deviceName(): string {
  if (typeof navigator === "undefined") return "web";
  return (shortAgent(navigator.userAgent) || "Browser").slice(0, 100);
}

export interface RegisterInput {
  identifier: string;
  password: string;
  full_name?: string;
}

export const authApi = {
  async login(identifier: string, password: string, totpCode?: string): Promise<LoginResponse> {
    const data = await api<LoginResponse>("/auth/login", {
      method: "POST",
      auth: false,
      body: { identifier: identifier.trim(), password, device_name: deviceName(), ...(totpCode ? { totp_code: totpCode } : {}) },
    });
    if (!data.access_token) throw new Error("Backend access_token qaytarmadi");
    tokenStore.set(data.access_token, data.refresh_token);
    emitAuthChanged("login");
    return data;
  },

  /** Ro'yxatdan o'tish token qaytarmaydi — darhol login qilinadi. */
  async register(input: RegisterInput): Promise<LoginResponse> {
    await api<User>("/auth/register", {
      method: "POST",
      auth: false,
      body: { ...splitIdentifier(input.identifier), password: input.password, full_name: input.full_name || null },
    });
    return authApi.login(input.identifier, input.password);
  },

  async logout(): Promise<void> {
    const refresh = tokenStore.getRefresh();
    try {
      await api<MessageResponse>("/auth/logout", { method: "POST", noRefresh: true, body: { refresh_token: refresh } });
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

  updateProfile(patch: { full_name: string | null }): Promise<User> {
    return api<User>("/me", { method: "PATCH", body: patch });
  },

  changePassword(oldPassword: string, newPassword: string): Promise<MessageResponse> {
    return api<MessageResponse>("/me/password", { method: "POST", body: { old_password: oldPassword, new_password: newPassword } });
  },

  // ---- 2FA (TOTP)
  twoFactorSetup(): Promise<TwoFactorSetup> {
    return api<TwoFactorSetup>("/me/2fa/setup", { method: "POST" });
  },
  twoFactorEnable(code: string): Promise<MessageResponse> {
    return api<MessageResponse>("/me/2fa/enable", { method: "POST", body: { code } });
  },
  twoFactorDisable(code: string): Promise<MessageResponse> {
    return api<MessageResponse>("/me/2fa/disable", { method: "POST", body: { code } });
  },
};
