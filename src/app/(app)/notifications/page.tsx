"use client";

/** Bildirishnomalar (FE-7.3): ro'yxat, o'qildi / barchasini o'qildi; turga qarab havola. */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, EmptyState, PageHeader, Pagination, Spinner, cn, formatDate } from "@/components/ui";
import { emitNotificationsChanged } from "@/components/notifications/bell";
import { errorMessage, notificationsApi, type Notification } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { useT, type DictKey } from "@/i18n";

const TYPE_KEY: Record<Notification["type"], DictKey> = {
  ACCESS_GRANTED: "notifications.type.ACCESS_GRANTED",
  ACCESS_REVOKED: "notifications.type.ACCESS_REVOKED",
  ORDER_CREATED: "notifications.type.ORDER_CREATED",
  ORDER_APPROVED: "notifications.type.ORDER_APPROVED",
  ORDER_REJECTED: "notifications.type.ORDER_REJECTED",
  GENERAL: "notifications.type.GENERAL",
};

/** Bildirishnoma turi va `meta` bo'yicha ochiladigan sahifa. */
function linkFor(n: Notification): string | null {
  const bookId = typeof n.meta?.book_id === "string" ? n.meta.book_id : null;
  if (n.type === "ACCESS_GRANTED" && bookId) return `/books/${bookId}`;
  if (n.type === "ACCESS_REVOKED" && bookId) return `/catalog/${bookId}`;
  if (n.type.startsWith("ORDER_")) return "/profile";
  return null;
}

export default function NotificationsPage() {
  const { t } = useT();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data, loading, error: loadError, reload, setData } = useAsync(() => notificationsApi.list({ page, page_size: 20, unread_only: unreadOnly }), [page, unreadOnly]);

  async function open(n: Notification) {
    if (!n.is_read) {
      setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) } : d));
      notificationsApi
        .markRead(n.id)
        .then(emitNotificationsChanged)
        .catch((e) => setError(errorMessage(e)));
    }
    const href = linkFor(n);
    if (href) router.push(href);
  }

  async function readAll() {
    try {
      await notificationsApi.markAllRead();
      emitNotificationsChanged();
      reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const items = data?.items ?? [];
  return (
    <div>
      <PageHeader
        title={t("notifications.title")}
        actions={
          <>
            <label className="flex items-center gap-1.5 text-sm text-muted">
              <input type="checkbox" checked={unreadOnly} onChange={(e) => { setPage(1); setUnreadOnly(e.target.checked); }} />
              {t("notifications.unreadOnly")}
            </label>
            <Button size="sm" variant="secondary" onClick={() => void readAll()} disabled={!items.some((n) => !n.is_read)}>
              {t("notifications.readAll")}
            </Button>
          </>
        }
      />
      {(error ?? loadError) && (
        <div className="mb-4">
          <Alert>{error ?? loadError}</Alert>
        </div>
      )}
      {loading && !data ? (
        <div className="flex justify-center py-16 text-muted">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={t("notifications.empty")} />
      ) : (
        <Card className="divide-y divide-border">
          {items.map((n) => {
            const href = linkFor(n);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => void open(n)}
                className={cn("flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-bg/60", !n.is_read && "bg-accent/5")}
                data-unread={!n.is_read || undefined}
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.is_read ? "bg-transparent" : "bg-accent")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-sm", n.is_read ? "text-text" : "font-semibold text-text")}>{n.title}</span>
                    <span className="text-[11px] text-muted">{t(TYPE_KEY[n.type] ?? "notifications.type.GENERAL")}</span>
                  </span>
                  {n.body && <span className="mt-0.5 block text-sm text-muted">{n.body}</span>}
                  <span className="mt-1 block text-xs text-muted">
                    {formatDate(n.created_at)}
                    {href && (
                      <>
                        {" · "}
                        <Link href={href} className="text-accent hover:underline" onClick={(e) => e.stopPropagation()}>
                          {t("notifications.open")} →
                        </Link>
                      </>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </Card>
      )}
      {data && data.pages > 1 && (
        <div className="mt-4">
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
