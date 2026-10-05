/** 44.8: global ilova sozlamalari — public `GET /app-settings` (login sahifasi ham o'qiydi; sir saqlanmaydi) */
import { api } from "./client";

export type AppImageTheme = "light" | "dark";

export interface AppSettings {
  /** Erkin JSON; frontend sxemasi — `src/lib/appearance.ts` (`appearance` kaliti) */
  settings: Record<string, unknown>;
  /** 46: yuklangan rasmlar — `{ background: { light: url, dark: url } }`; URL'da `?v=` (almashtirilsa yangilanadi) */
  images?: Record<string, Partial<Record<AppImageTheme, string>>>;
}

export interface AppImage {
  name: string;
  theme: AppImageTheme;
  url: string;
}

export const appApi = {
  settings(): Promise<AppSettings> {
    return api<AppSettings>("/app-settings", { auth: false });
  },
};
