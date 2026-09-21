import { api } from "./client";
import type { MessageResponse, Session } from "./types";

export const sessionsApi = {
  list(): Promise<Session[]> {
    return api<Session[]>("/sessions");
  },
  revoke(id: string): Promise<MessageResponse> {
    return api<MessageResponse>(`/sessions/${id}`, { method: "DELETE" });
  },
};
