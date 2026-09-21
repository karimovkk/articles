"use client";

/** Header qo'ng'irog'i: o'qilmagan soni (`/notifications/unread-count`, 60 s + fokusda yangilanadi). */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { notificationsApi } from "@/lib/api";
import { useT } from "@/i18n";
import { cn } from "@/components/ui";
import * as I from "@/components/ui/icons";

const POLL_MS = 60_000;

export function NotificationBell({ className }: { className?: string }) {
  const { user } = useAuth();
  const { t } = useT();
  const pathname = usePathname();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () => notificationsApi.unreadCount().then((n) => alive && setCount(n)).catch(() => undefined);
    load();
    const timer = window.setInterval(load, POLL_MS);
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("a365:notifications-changed", load);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("a365:notifications-changed", load);
    };
  }, [user, pathname]);

  if (!user) return null;
  const active = pathname === "/notifications";
  return (
    <Link
      href="/notifications"
      className={cn("icon-btn plain", active && "bg-surface-2 text-text", className)}
      title={t("notifications.title")}
      aria-label={count ? t("notifications.unreadN", { n: count }) : t("notifications.title")}
      aria-current={active ? "page" : undefined}
    >
      <I.Bell size={18} />
      {!!count && (
        <span className="dot" data-testid="unread-count">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

/** Ro'yxat o'qilgan deb belgilangach qo'ng'iroqni yangilash. */
export function emitNotificationsChanged() {
  window.dispatchEvent(new Event("a365:notifications-changed"));
}
