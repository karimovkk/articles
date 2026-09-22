"use client";

/** Admin: buyurtmalar (PM S-16) — ro'yxat, holat filtri, tasdiqlash / rad etish (sabab). */
import { useState } from "react";
import Link from "next/link";
import { DataTable, Toolbar, usePaged, type Column } from "@/components/admin/data-table";
import * as I from "@/components/ui/icons";
import { OrderStatusBadge } from "@/components/orders/order-status";
import { Price } from "@/components/catalog/price";
import { Alert, Button, Field, Modal, PageHeader, Select, Textarea, formatDate } from "@/components/ui";
import { adminApi, errorMessage, type Order, type OrderStatus } from "@/lib/api";
import { useEntityNames } from "@/lib/admin-names";
import { useT } from "@/i18n";

const STATUSES: OrderStatus[] = ["PENDING", "AWAITING_REVIEW", "APPROVED", "REJECTED"];

export default function AdminOrdersPage() {
  const { t } = useT();
  const [status, setStatus] = useState<OrderStatus | "">(""); // default — barchasi
  const [rejecting, setRejecting] = useState<Order | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const { data, loading, error, setPage, reload } = usePaged<Order>((page) => adminApi.orders({ page, status: status || undefined }), [status]);
  // B5: backend nomlarni qo'shib beradi; eski javobda bo'lmasa — id bo'yicha resolve
  const names = useEntityNames(
    data?.items.filter((o) => !o.user_full_name && !o.user_email).map((o) => o.user_id) ?? [],
    data?.items.filter((o) => !o.book_title).map((o) => o.book_id) ?? [],
  );

  async function act(o: Order, fn: () => Promise<unknown>) {
    setBusy(o.id);
    setActionErr(null);
    try {
      await fn();
      setRejecting(null);
      setReason("");
      reload();
    } catch (e) {
      setActionErr(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const columns: Column<Order>[] = [
    { key: "created", header: t("admin.audit.time"), render: (o) => <span className="muted whitespace-nowrap">{formatDate(o.created_at)}</span> },
    {
      key: "user",
      header: t("common.user"),
      render: (o) => (
        <Link href={`/admin/users/${o.user_id}`} className="name hover:text-accent-ink">
          {o.user_full_name || o.user_email || names.users[o.user_id] || o.user_id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: "book",
      header: t("admin.book"),
      render: (o) => (
        <Link href={`/admin/books/${o.book_id}`} className="font-semibold hover:text-accent-ink">
          {o.book_title || names.books[o.book_id] || o.book_id.slice(0, 8)}
        </Link>
      ),
    },
    { key: "amount", header: t("admin.books.price"), num: true, render: (o) => <Price value={o.amount} /> },
    { key: "status", header: t("common.status"), render: (o) => <OrderStatusBadge status={o.status} /> },
    {
      key: "note",
      header: t("admin.orders.receipt"),
      render: (o) => (
        <span className="block max-w-[260px] truncate text-xs text-muted" title={o.receipt_note ?? undefined}>
          {o.receipt_note ?? "—"}
          {o.reject_reason && <span className="block truncate text-danger">{o.reject_reason}</span>}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (o) =>
        o.status === "PENDING" || o.status === "AWAITING_REVIEW" ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" loading={busy === o.id} onClick={() => act(o, () => adminApi.approveOrder(o.id))} icon={<I.Check size={14} />}>
              {t("admin.orders.approve")}
            </Button>
            <Button size="sm" variant="danger-ghost" loading={busy === o.id} onClick={() => setRejecting(o)}>
              {t("admin.orders.reject")}
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader eyebrow={t("admin.nav.people")} title={t("admin.orders.title")} description={t("admin.orders.description")} icon={<I.ShoppingBag size={26} />} />
      <Toolbar meta={data ? `${t("common.total")}: ${data.total}` : undefined}>
        <Select
          value={status}
          onChange={(v) => setStatus(v as OrderStatus | "")}
          options={[{ value: "", label: t("admin.allStatuses") }, ...STATUSES.map((s) => ({ value: s, label: t(`orders.status.${s}`) }))]}
          className="w-56"
          aria-label={t("common.status")}
          data-testid="filter-status"
        />
      </Toolbar>
      {actionErr && <Alert className="mb-4">{actionErr}</Alert>}
      <DataTable data={data} columns={columns} loading={loading} error={error} onPage={setPage} minWidth={900} />

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title={t("admin.orders.rejectTitle")} icon={<I.XCircle size={18} />} size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Sabab majburiy (oqim v1.0): foydalanuvchiga ko'rsatiladi
            if (rejecting && reason.trim()) void act(rejecting, () => adminApi.rejectOrder(rejecting.id, reason.trim()));
          }}
          className="space-y-3"
        >
          <Field label={t("orders.rejectReason")}>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("admin.orders.reasonPlaceholder")} required maxLength={500} autoFocus data-testid="reject-reason-input" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRejecting(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="danger" loading={!!rejecting && busy === rejecting.id} disabled={!reason.trim()}>
              {t("admin.orders.reject")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
