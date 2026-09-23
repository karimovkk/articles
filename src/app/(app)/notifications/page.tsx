"use client";

/** Bildirishnomalar (FE-7.3): ro'yxat, o'qildi / barchasini o'qildi; turga qarab havola. */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, RoundPagination, Spinner, Switch, cn, formatDate } from "@/components/ui";
import * as I from "@/components/ui/icons";
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

/** Bildirishnoma turi va `meta` bo'yicha ochiladigan sahifa (buyurtma oqimi v1.0: tasdiq → kitob, rad → qayta urinish). */
function linkFor(n: Notification): string | null {
  const bookId = typeof n.meta?.book_id === "string" ? n.meta.book_id : null;
  switch (n.type) {
    case "ACCESS_GRANTED":
    case "ORDER_APPROVED":
      return bookId ? `/books/${bookId}` : "/library";
    case "ACCESS_REVOKED":
      return bookId ? `/catalog/${bookId}` : null;
    case "ORDER_REJECTED":
      return bookId ? `/catalog/${bookId}` : "/profile";
    case "ORDER_CREATED":
      return "/profile";
    default:
      return null;
  }
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
        eyebrow={t("client.nav")}
        title={t("notifications.title")}
        icon={<I.Bell size={26} />}
        actions={
          <>
            <Switch
              checked={unreadOnly}
              onChange={(v) => {
                setPage(1);
                setUnreadOnly(v);
              }}
              label={t("notifications.unreadOnly")}
              data-testid="unread-only"
            />
            <Button variant="secondary" onClick={() => void readAll()} disabled={!items.some((n) => !n.is_read)} icon={<I.CheckCircle size={16} />}>
              {t("notifications.readAll")}
            </Button>
          </>
        }
      />
      {(error ?? loadError) && <Alert className="mb-4">{error ?? loadError}</Alert>}
      {loading && !data ? (
        <div className="flex justify-center py-16 text-muted">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={t("notifications.empty")} icon={<I.Bell size={22} />} />
      ) : (
        <Card className="tracklist overflow-hidden">
          {items.map((n) => {
            const href = linkFor(n);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => void open(n)}
                className={cn("track w-full text-left hover:bg-hover", !n.is_read && "bg-[var(--accent-softer)]")}
                style={{ gridTemplateColumns: "36px minmax(0,1fr) auto" }}
                data-unread={!n.is_read || undefined}
              >
                <span className={cn("track-num", !n.is_read && "bg-accent text-accent-fg")} aria-hidden>
                  <I.Bell size={14} />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn("user-text text-sm", n.is_read ? "font-semibold text-text-2" : "font-extrabold text-text")}>{n.title}</span>
                    <Badge>{t(TYPE_KEY[n.type] ?? "notifications.type.GENERAL")}</Badge>
                  </span>
                  {n.body && <span className="user-text mt-0.5 block text-sm text-muted">{n.body}</span>}
                  <span className="track-sub">
                    {formatDate(n.created_at)}
                    {href && (
                      <>
                        {" · "}
                        <Link href={href} className="font-bold text-accent-ink hover:underline" onClick={(e) => e.stopPropagation()}>
                          {t("notifications.open")} →
                        </Link>
                      </>
                    )}
                  </span>
                </span>
                <I.ChevronRight size={16} className="text-muted" />
              </button>
            );
          })}
        </Card>
      )}
      {data && data.pages > 1 && (
        <div className="mt-4">
          <RoundPagination page={data.page} pages={data.pages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
