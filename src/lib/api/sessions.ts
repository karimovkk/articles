import { api } from "./client";
import type { Paginated, Session } from "./types";

export const sessionsApi = {
  async list(): Promise<Session[]> {
    const raw = await api<Session[] | Paginated<Session>>("/sessions");
    return Array.isArray(raw) ? raw : (raw.items ?? []);
  },
  revoke(id: string): Promise<void> {
    return api<void>(`/sessions/${id}`, { method: "DELETE" });
  },
};
