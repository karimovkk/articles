"use client";

/** Header qo'ng'irog'i: o'qilmagan soni (umumiy store — `useUnreadCount`; marshrut o'zgarganda ham yangilanadi). */
import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useT } from "@/i18n";
import { cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { refreshUnreadCount, useUnreadCount } from "./use-unread-count";

export function NotificationBell({ className }: { className?: string }) {
  const { user } = useAuth();
  const { t } = useT();
  const pathname = usePathname();
  const count = useUnreadCount(!!user);

  // Marshrut o'zgarganda qayta so'rash (birinchi so'rovni store o'zi yuboradi)
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    refreshUnreadCount();
  }, [pathname]);

  if (!user) return null;
  const active = pathname === "/notifications";
  return (
    <Link
      href="/notifications"
      className={cn("icon-btn plain", !!count && "has-unread", active && "bg-surface-2 text-text", className)}
      title={t("notifications.title")}
      aria-label={count ? t("notifications.unreadN", { n: count }) : t("notifications.title")}
      aria-current={active ? "page" : undefined}
    >
      {/* `key` — soni o'zgarganda animatsiya qaytadan o'ynaydi */}
      <span className="bell-ic" key={count ?? 0}>
        <I.Bell size={18} />
      </span>
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
