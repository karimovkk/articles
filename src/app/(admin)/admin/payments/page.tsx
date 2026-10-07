"use client";

/**
 * 44.4: admin "To'lovlar" — `GET /admin/stats/payments`. Tushum = tasdiqlangan (APPROVED) buyurtmalar.
 * 64/70: filtr — faqat oraliq (tayyor yoki ikki sana → `date_from`/`date_to`); davr (`group_by`: soat / kun / oy / yil)
 * oraliqdan avtomatik. Hamma narsa (kartalar, holatlar, grafik, kitoblar) shu oraliqqa bo'ysunadi. Grafik
 * `revenue_by_period` bo'yicha (bo'sh davrlar 0 bilan); qayta so'rovda eski ko'rinish xira holda qoladi.
 * Holatlar — donut + legend (60), kitoblar bo'yicha tushum jadvali.
 */
import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, DatePicker, EmptyState, PageHeader, Select, Spinner, Stat, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { StatusDonut } from "@/components/admin/status-donut";
import { adminApi, type OrderStatus } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { RANGE_PRESETS, fillPeriods, granularityFor, periodLabel, presetRange, type RangePreset } from "@/lib/payment-periods";
import { formatNumber, useT } from "@/i18n";

const STATUS_ORDER: OrderStatus[] = ["APPROVED", "AWAITING_REVIEW", "PENDING", "REJECTED", "CANCELLED"];

export default function AdminPaymentsPage() {
  const { t, locale } = useT();
  const [preset, setPreset] = useState<RangePreset>("all");
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  // 70: davr (yil / oy / kun / soat) oraliqdan avtomatik — admin faqat oraliqni tanlaydi
  const g = granularityFor(range.from, range.to);
  const { data, error, loading } = useAsync(() => adminApi.paymentStats({ group_by: g, date_from: range.from, date_to: range.to }), [g, range.from, range.to]);
  const [asTable, setAsTable] = useState(false);
  const money = (n: number) => t("catalog.price", { price: formatNumber(Math.round(n), locale) });
  const label = (period: string, long: boolean) => periodLabel(period, g, t, long);

  const pickPreset = (p: RangePreset) => {
    setPreset(p);
    if (p === "custom") return; // sanalar tanlanadi
    const r = presetRange(p);
    setRange({ from: r.from, to: r.to });
  };

  const header = <PageHeader title={t("admin.payments.title")} description={t("admin.payments.sub")} icon={<I.Wallet size={24} />} />;
  const filters = (
    <div className="pay-filters" data-testid="pay-filters">
      <Select
        size="sm"
        value={preset}
        onChange={(v) => pickPreset(v as RangePreset)}
        options={RANGE_PRESETS.map((p) => ({ value: p, label: t(`admin.payments.range.${p}`) }))}
        matchWidth={false}
        className="w-44"
        aria-label={t("admin.payments.range")}
        data-testid="pay-range"
      />
      {preset === "custom" && (
        <div className="pay-dates">
          <DatePicker value={range.from ?? ""} max={range.to} onChange={(v) => setRange((r) => ({ ...r, from: v || undefined }))} placeholder={t("admin.payments.from")} aria-label={t("admin.payments.from")} data-testid="pay-from" />
          <span className="text-muted">—</span>
          <DatePicker value={range.to ?? ""} min={range.from} onChange={(v) => setRange((r) => ({ ...r, to: v || undefined }))} placeholder={t("admin.payments.to")} aria-label={t("admin.payments.to")} data-testid="pay-to" />
        </div>
      )}
      {loading && data && <Spinner className="size-4" />}
    </div>
  );

  if (error && !data)
    return (
      <div className="space-y-5">
        {header}
        {filters}
        <Alert>{error}</Alert>
      </div>
    );
  if (!data)
    return (
      <div className="space-y-5">
        {header}
        {filters}
        <Spinner />
      </div>
    );

  // Eski backend (faqat oylar) — `revenue_by_month` dan
  const rows = data.revenue_by_period ?? (data.revenue_by_month ?? []).map((m) => ({ period: m.month, revenue: m.revenue, orders: m.orders }));
  const points = fillPeriods(rows, g, range.from, range.to);
  const hasRevenue = rows.some((r) => r.revenue > 0);
  const books = data.revenue_by_book ?? [];
  const count = (s: OrderStatus) => data.orders_by_status?.[s] ?? 0;
  const allOrders = STATUS_ORDER.reduce((sum, s) => sum + count(s), 0);
  // 68: backend `orders_by_status` ni hali oraliqqa bo'ysundirmaydi — oraliq tanlanganda holatlardagi tasdiqlanganlar
  // kartadagidan ko'p bo'lsa, ular butun davr bo'yicha (izoh ko'rsatiladi; backend tuzatsa o'z-o'zidan yo'qoladi)
  const statusUnscoped = !!(range.from || range.to) && count("APPROVED") > data.approved_orders;

  return (
    <div className="space-y-5" data-testid="payments-page">
      {header}
      {filters}

      {/* Qayta so'rov paytida eski ko'rinish xira (sakrash yo'q) */}
      <div className={cn("space-y-5 transition-opacity", loading && "pointer-events-none opacity-60")} aria-busy={loading} data-testid="pay-content">
      {/* 69: telefonda ixcham — jami tushum to'liq kenglikda, qolgan ikkitasi yonma-yon */}
      <div className="pay-kpis grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <Stat className="col-span-2 sm:col-span-1" label={t("admin.payments.total")} value={<span data-testid="pay-total">{money(data.total_revenue)}</span>} icon={<I.Wallet size={17} />} />
        <Stat label={t("admin.payments.approved")} value={<span data-testid="pay-approved">{formatNumber(data.approved_orders, locale)}</span>} icon={<I.CheckCircle size={17} />} />
        <Stat label={t("admin.payments.average")} value={<span data-testid="pay-average">{money(data.average_order_value)}</span>} icon={<I.ShoppingBag size={17} />} />
      </div>

      {/* 69: tushum grafigi (~2/3) va holatlar donut'i (~1/3) yonma-yon, bir xil balandlikda; torda — ustun */}
      <div className={cn("pay-main", allOrders > 0 && "with-side")} data-testid="pay-main">
        <Card
          title={t(`admin.payments.by.${g}`)}
          actions={
            hasRevenue && (
              <Button size="sm" variant="ghost" onClick={() => setAsTable((v) => !v)} icon={asTable ? <I.Activity size={15} /> : <I.List size={15} />} data-testid="pay-toggle-table">
                {asTable ? t("admin.payments.showChart") : t("admin.payments.showTable")}
              </Button>
            )
          }
        >
          <div className="pay-chart-body">
            {!hasRevenue ? (
              <EmptyState icon={<I.Wallet size={22} />} title={t("admin.payments.empty")} description={range.from || range.to ? t("admin.payments.emptyRange") : t("admin.payments.emptyHint")} />
            ) : asTable ? (
              <div className="table-wrap">
                <table className="table" data-testid="pay-month-table">
                  <thead>
                    <tr>
                      <th>{t(`admin.payments.g.${g}`)}</th>
                      <th className="text-right">{t("admin.payments.orders")}</th>
                      <th className="text-right">{t("admin.payments.revenue")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows].sort((a, b) => b.period.localeCompare(a.period)).map((m) => (
                      <tr key={m.period}>
                        <td>{label(m.period, true)}</td>
                        <td className="num text-right">{formatNumber(m.orders, locale)}</td>
                        <td className="num text-right">{money(m.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <RevenueChart data={points} money={money} label={label} title={t(`admin.payments.by.${g}`)} height={allOrders > 0 ? "fill" : 260} animKey={`${g}|${range.from ?? ""}|${range.to ?? ""}`} />
            )}
          </div>
        </Card>
        {allOrders > 0 && (
          <Card title={t("admin.payments.byStatus")} className="pay-side">
            <div className="pay-side-body">
              <StatusDonut counts={data.orders_by_status ?? {}} />
              {statusUnscoped && (
                <p className="flex items-start gap-1.5 px-6 pb-5 text-xs text-muted" data-testid="status-unscoped">
                  <I.Info size={13} className="mt-0.5 shrink-0" />
                  {t("admin.payments.statusUnscoped")}
                </p>
              )}
            </div>
          </Card>
        )}
      </div>

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
                    <td className="num muted text-right">
                      {data.total_revenue > 0 ? (
                        <span className="pay-share">
                          <span className="pay-share-bar" aria-hidden>
                            <i style={{ width: `${Math.max(2, Math.round((b.revenue / data.total_revenue) * 100))}%` }} />
                          </span>
                          <span>{Math.round((b.revenue / data.total_revenue) * 100)}%</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </div>
    </div>
  );
}
