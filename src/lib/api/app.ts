/** 44.8: global ilova sozlamalari — public `GET /app-settings` (login sahifasi ham o'qiydi; sir saqlanmaydi) */
import { api } from "./client";

export interface AppSettings {
  /** Erkin JSON; frontend sxemasi — `src/lib/appearance.ts` (`appearance` kaliti) */
  settings: Record<string, unknown>;
}

export const appApi = {
  settings(): Promise<AppSettings> {
    return api<AppSettings>("/app-settings", { auth: false });
  },
};
