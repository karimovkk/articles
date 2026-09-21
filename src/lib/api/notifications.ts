import { api } from "./client";
import type { MessageResponse, Notification, Paginated } from "./types";

export const notificationsApi = {
  list(q: { page?: number; page_size?: number; unread_only?: boolean } = {}): Promise<Paginated<Notification>> {
    return api<Paginated<Notification>>("/notifications", { query: { page: 1, page_size: 20, ...q } });
  },
  async unreadCount(): Promise<number> {
    const r = await api<{ unread?: number }>("/notifications/unread-count");
    return r.unread ?? 0;
  },
  markRead(id: string): Promise<MessageResponse> {
    return api<MessageResponse>(`/notifications/${id}/read`, { method: "POST" });
  },
  markAllRead(): Promise<MessageResponse> {
    return api<MessageResponse>("/notifications/read-all", { method: "POST" });
  },
};
