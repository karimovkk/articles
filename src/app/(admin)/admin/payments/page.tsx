"use client";

/**
 * 44.4: admin "To'lovlar" — `GET /admin/stats/payments`. Tushum = tasdiqlangan (APPROVED) buyurtmalar.
 * Ko'rsatkichlar (jami tushum, tasdiqlangan buyurtmalar, o'rtacha chek), holatlar bo'yicha buyurtmalar, oylik tushum
 * grafigi (+ jadval ko'rinishi) va kitoblar bo'yicha tushum.
 */
import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, EmptyState, PageHeader, Spinner, Stat } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { OrderStatusBadge } from "@/components/orders/order-status";
import { RevenueChart, monthLabel } from "@/components/admin/revenue-chart";
import { adminApi, type OrderStatus } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { formatNumber, useT } from "@/i18n";

const STATUS_ORDER: OrderStatus[] = ["APPROVED", "AWAITING_REVIEW", "PENDING", "REJECTED", "CANCELLED"];

export default function AdminPaymentsPage() {
  const { t, locale } = useT();
  const { data, error } = useAsync(() => adminApi.paymentStats(), []);
  const [asTable, setAsTable] = useState(false);
  const money = (n: number) => t("catalog.price", { price: formatNumber(Math.round(n), locale) });

  const header = <PageHeader title={t("admin.payments.title")} description={t("admin.payments.sub")} icon={<I.Wallet size={24} />} />;
  if (error && !data)
    return (
      <div>
        {header}
        <Alert>{error}</Alert>
      </div>
    );
  if (!data)
    return (
      <div>
        {header}
        <Spinner />
      </div>
    );

  const months = data.revenue_by_month ?? [];
  const books = data.revenue_by_book ?? [];
  const statuses = STATUS_ORDER.filter((s) => (data.orders_by_status?.[s] ?? 0) > 0);

  return (
    <div className="space-y-5" data-testid="payments-page">
      {header}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("admin.payments.total")} value={<span data-testid="pay-total">{money(data.total_revenue)}</span>} icon={<I.Wallet size={17} />} />
        <Stat label={t("admin.payments.approved")} value={<span data-testid="pay-approved">{formatNumber(data.approved_orders, locale)}</span>} icon={<I.CheckCircle size={17} />} />
        <Stat label={t("admin.payments.average")} value={<span data-testid="pay-average">{money(data.average_order_value)}</span>} icon={<I.ShoppingBag size={17} />} />
      </div>

      {statuses.length > 0 && (
        <Card title={t("admin.payments.byStatus")}>
          <ul className="pay-statuses" data-testid="pay-statuses">
            {statuses.map((s) => (
              <li key={s}>
                <OrderStatusBadge status={s} />
                <strong>{formatNumber(data.orders_by_status[s] ?? 0, locale)}</strong>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title={t("admin.payments.byMonth")}
        actions={
          months.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setAsTable((v) => !v)} icon={asTable ? <I.Activity size={15} /> : <I.List size={15} />} data-testid="pay-toggle-table">
              {asTable ? t("admin.payments.showChart") : t("admin.payments.showTable")}
            </Button>
          )
        }
      >
        <div className="card-body">
          {months.length === 0 ? (
            <EmptyState icon={<I.Wallet size={22} />} title={t("admin.payments.empty")} description={t("admin.payments.emptyHint")} />
          ) : asTable ? (
            <div className="table-wrap">
              <table className="table" data-testid="pay-month-table">
                <thead>
                  <tr>
                    <th>{t("admin.payments.month")}</th>
                    <th className="text-right">{t("admin.payments.orders")}</th>
                    <th className="text-right">{t("admin.payments.revenue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...months].reverse().map((m) => (
                    <tr key={m.month}>
                      <td>{monthLabel(m.month, t, true)}</td>
                      <td className="num text-right">{formatNumber(m.orders, locale)}</td>
                      <td className="num text-right">{money(m.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <RevenueChart data={months} money={money} />
          )}
        </div>
      </Card>

      <Card title={t("admin.payments.byBook")} padded={false}>
        {books.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t("admin.payments.empty")}</p>
        ) : (
          <div className="table-wrap">
            <table className="table" data-testid="pay-book-table">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>{t("admin.books.name")}</th>
                  <th className="text-right">{t("admin.payments.sold")}</th>
                  <th className="text-right">{t("admin.payments.revenue")}</th>
                  <th className="text-right">{t("admin.payments.share")}</th>
                </tr>
              </thead>
              <tbody>
                {books.map((b, i) => (
                  <tr key={b.book_id}>
                    <td className="num muted">{i + 1}</td>
                    <td>
                      <Link href={`/admin/books/${b.book_id}`} className="name user-text hover:underline">
                        {b.title || b.book_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="num text-right">{formatNumber(b.sold, locale)}</td>
                    <td className="num text-right">{money(b.revenue)}</td>
                    <td className="num muted text-right">{data.total_revenue > 0 ? `${Math.round((b.revenue / data.total_revenue) * 100)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
