/**
 * Auth (OpenAPI): POST /auth/login {identifier, password, device_name?, totp_code?} → LoginResponse;
 * POST /auth/register {phone, password, full_name?} → UserResponse (44.1: faqat telefon; token YO'Q → keyin login);
 * POST /auth/logout {refresh_token}; GET /auth/me; PATCH /me; POST /me/password; /me/2fa/*; GET /me/devices (38).
 */
import { api, emitAuthChanged, resetSessionEndReason } from "./client";
import { tokenStore } from "./token-store";
import { shortAgent } from "@/lib/agent";
import type { LoginResponse, MessageResponse, MyDevicesResponse, TwoFactorSetup, User } from "./types";

/**
 * 44.1: telefon → E.164 (`+998901234567`). Qabul qilinadi: "90 123 45 67", "998901234567", "+998 (90) 123-45-67",
 * "00998…" va boshqa davlat raqamlari (`+…`, 10–15 raqam). Noto'g'ri bo'lsa — `null`.
 */
export function normalizePhone(raw: string): string | null {
  const v = raw.trim().replace(/[\s\-().]/g, "");
  let d = v.startsWith("+") ? v.slice(1) : v.startsWith("00") ? v.slice(2) : v;
  if (!/^\d+$/.test(d)) return null;
  if (d.length === 9) d = `998${d}`; // mahalliy: 90 123 45 67
  if (d.startsWith("998") && d.length !== 12) return null;
  if (d.length < 10 || d.length > 15) return null;
  return `+${d}`;
}

/** Login identifikatori: email bo'lsa — o'zi; telefon bo'lsa — E.164 ga keltiriladi (backend shu ko'rinishda saqlaydi) */
export function loginIdentifier(identifier: string): string {
  const v = identifier.trim();
  if (v.includes("@")) return v.toLowerCase();
  return normalizePhone(v) ?? v;
}

/** Sessiyalar ro'yxatida ko'rinadigan qisqa qurilma nomi (brauzer · OS). */
export function deviceName(): string {
  if (typeof navigator === "undefined") return "web";
  return (shortAgent(navigator.userAgent) || "Browser").slice(0, 100);
}

/** 44.1: ro'yxatdan faqat telefon bilan (email shart emas) */
export interface RegisterInput {
  /** E.164 (`normalizePhone` natijasi) */
  phone: string;
  password: string;
  full_name?: string;
}

export const authApi = {
  async login(identifier: string, password: string, totpCode?: string): Promise<LoginResponse> {
    // 38: bog'langan qurilma o'z sirini ko'rsatadi (nusxalangan X-Device-Id bilan begona kompyuter kira olmaydi)
    const secret = tokenStore.getDeviceSecret();
    const data = await api<LoginResponse>("/auth/login", {
      method: "POST",
      auth: false,
      headers: secret ? { "X-Device-Secret": secret } : undefined,
      body: { identifier: loginIdentifier(identifier), password, device_name: deviceName(), ...(totpCode ? { totp_code: totpCode } : {}) },
    });
    if (!data.access_token) throw new Error("Backend access_token qaytarmadi");
    if (data.device_secret) tokenStore.setDeviceSecret(data.device_secret);
    tokenStore.set(data.access_token, data.refresh_token);
    resetSessionEndReason();
    emitAuthChanged("login");
    return data;
  },

  /** Ro'yxatdan o'tish token qaytarmaydi — darhol login qilinadi. */
  async register(input: RegisterInput): Promise<LoginResponse> {
    await api<User>("/auth/register", {
      method: "POST",
      auth: false,
      body: { phone: input.phone, password: input.password, full_name: input.full_name?.trim() || null },
    });
    return authApi.login(input.phone, input.password);
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

  // ---- 38: bog'langan qurilmalar (faqat ko'rish)
  devices(): Promise<MyDevicesResponse> {
    return api<MyDevicesResponse>("/me/devices");
  },
};
