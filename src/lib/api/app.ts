/** 44.8: global ilova sozlamalari — public `GET /app-settings` (login sahifasi ham o'qiydi; sir saqlanmaydi) */
import { api } from "./client";
import { backendUrl } from "@/lib/env";

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
  async settings(): Promise<AppSettings> {
    const r = await api<AppSettings>("/app-settings", { auth: false });
    // 50: rasm URL'lari nisbiy yo'l — backend manziliga ulanadi
    const images = Object.fromEntries(
      Object.entries(r.images ?? {}).map(([name, th]) => [name, Object.fromEntries(Object.entries(th).map(([k, u]) => [k, typeof u === "string" ? backendUrl(u) : u]))]),
    );
    return { ...r, images };
  },
};
