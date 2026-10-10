"use client";

/**
 * 85: ko'p kitob chegirma pog'onalari — admin istalgan vaqt sozlaydi: "N ta va undan ko'p kitob olinsa — har biri X so'm".
 * `min_quantity` — pog'ona boshlanadigan son, `unit_price` — o'sha pog'onada har kitob narxi (yuqori chegara: arzonroq
 * kitob o'z narxida qoladi; eng katta mos pog'ona qo'llanadi). Saqlash — butun jadval bir urinishda (`PUT`).
 * O'ngda — mijozga qanday ko'rinishi va misol hisob (yakuniy summa baribir serverda: `POST /orders/quote`).
 */
import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  PageHeader,
  Spinner,
  Switch,
  cn,
} from "@/components/ui";
import * as I from "@/components/ui/icons";
import { adminApi, errorMessage, type AdminPricingTier } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { formatNumber, useT } from "@/i18n";

interface Row {
  key: string;
  min: string;
  price: string;
  active: boolean;
}
const toRows = (list: AdminPricingTier[]): Row[] =>
  list
    .slice()
    .sort((a, b) => a.min_quantity - b.min_quantity)
    .map((t) => ({
      key: t.id,
      min: String(t.min_quantity),
      price: String(Math.round(Number(t.unit_price))),
      active: t.is_active !== false,
    }));
const same = (a: Row[], b: Row[]) =>
  JSON.stringify(a.map(({ min, price, active }) => [min, price, active])) ===
  JSON.stringify(b.map(({ min, price, active }) => [min, price, active]));
let seq = 0;

export default function AdminPricingPage() {
  const { t, locale } = useT();
  const { data, error, setData } = useAsync(() => adminApi.pricingTiers(), []);
  const server = useMemo(() => (data ? toRows(data) : null), [data]);
  const [draft, setDraft] = useState<Row[] | null>(null);
  const rows = draft ?? server ?? [];
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);
  const [sample, setSample] = useState("45000");
  const money = (n: number) =>
    t("catalog.price", { price: formatNumber(Math.round(n), locale) });

  // Qator xatolari: son ≥ 1 (butun) va takrorlanmaydi, narx > 0
  const errors = rows.map((r) => {
    const m = Number(r.min);
    if (!Number.isInteger(m) || m < 1) return "min";
    if (rows.filter((o) => Number(o.min) === m).length > 1) return "dup";
    if (!(Number(r.price) > 0)) return "price";
    return null;
  });
  const dirty = !!server && !same(rows, server);
  const valid = errors.every((e) => !e);

  const set = (key: string, patch: Partial<Row>) => {
    setMsg(null);
    setDraft(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const add = () => {
    setMsg(null);
    const last = rows.reduce<Row | null>(
      (a, r) => (!a || Number(r.min) > Number(a.min) ? r : a),
      null,
    );
    const min = last ? Number(last.min) + 1 : 1;
    const price =
      last && Number(last.price) > 5000
        ? String(Number(last.price) - 5000)
        : "";
    setDraft([
      ...rows,
      { key: `new-${++seq}`, min: String(min), price, active: true },
    ]);
  };
  const remove = (key: string) => {
    setMsg(null);
    setDraft(rows.filter((r) => r.key !== key));
  };

  async function save() {
    if (!valid || !dirty) return;
    setBusy(true);
    setMsg(null);
    try {
      const sorted = rows.slice().sort((a, b) => Number(a.min) - Number(b.min));
      const res = await adminApi.savePricingTiers(
        sorted.map((r) => ({
          min_quantity: Number(r.min),
          unit_price: Number(r.price),
          is_active: r.active,
        })),
      );
      setData(() => res);
      setDraft(null);
      setMsg({ tone: "success", text: t("pricing.saved") });
    } catch (e) {
      setMsg({ tone: "danger", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  // Mijozga ko'rinishi — faqat faol va to'g'ri pog'onalar
  const live = rows
    .filter((r, i) => r.active && !errors[i])
    .map((r) => ({ min: Number(r.min), price: Number(r.price) }))
    .sort((a, b) => a.min - b.min);
  const base = Number(sample) > 0 ? Number(sample) : 0;
  const capFor = (q: number) =>
    live.filter((x) => x.min <= q).sort((a, b) => b.min - a.min)[0]?.price ??
    null;
  const maxMin = live.length ? live[live.length - 1].min : 1;
  const examples = Array.from(
    { length: Math.max(3, maxMin) },
    (_, i) => i + 1,
  ).map((q) => {
    const cap = capFor(q);
    const each = cap == null ? base : Math.min(base, cap);
    return { q, each, total: each * q, save: (base - each) * q };
  });

  const header = (
    <PageHeader
      title={t("pricing.title")}
      description={t("pricing.sub")}
      icon={<I.Percent size={24} />}
    />
  );
  if (!data)
    return (
      <div className="space-y-5">
        {header}
        {error ? <Alert>{error}</Alert> : <Spinner />}
      </div>
    );

  return (
    <div className="space-y-5" data-testid="pricing-page">
      {header}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="pricing-grid">
        <Card
          title={t("pricing.tiers")}
          actions={
            <Button
              size="sm"
              variant="secondary"
              icon={<I.Plus size={14} />}
              onClick={add}
              data-testid="tier-add"
            >
              {t("pricing.add")}
            </Button>
          }
        >
          <div className="space-y-3">
            {rows.length === 0 ? (
              <EmptyState
                icon={<I.Percent size={22} />}
                title={t("pricing.empty")}
                description={t("pricing.emptyHint")}
              />
            ) : (
              <>
                <div className="tier-head" aria-hidden>
                  <span>{t("pricing.from")}</span>
                  <span>{t("pricing.each")}</span>
                  <span>{t("pricing.active")}</span>
                  <span />
                </div>
                <ul className="space-y-2">
                  {rows.map((r, i) => (
                    <li
                      key={r.key}
                      className={cn(
                        "tier-row",
                        errors[i] && "invalid",
                        !r.active && "off",
                      )}
                      data-testid="tier-row"
                    >
                      <label className="tier-field">
                        <span className="sr-only">{t("pricing.from")}</span>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          value={r.min}
                          onChange={(e) => set(r.key, { min: e.target.value })}
                          aria-invalid={
                            errors[i] === "min" ||
                            errors[i] === "dup" ||
                            undefined
                          }
                          data-testid="tier-min"
                        />
                        <span className="tier-suffix">
                          {t("pricing.booksSuffix")}
                        </span>
                      </label>
                      <label className="tier-field">
                        <span className="sr-only">{t("pricing.each")}</span>
                        <Input
                          type="number"
                          min={1}
                          step="any"
                          inputMode="decimal"
                          value={r.price}
                          onChange={(e) =>
                            set(r.key, { price: e.target.value })
                          }
                          aria-invalid={errors[i] === "price" || undefined}
                          data-testid="tier-price"
                        />
                        <span className="tier-suffix">
                          {t("pricing.currency")}
                        </span>
                      </label>
                      <Switch
                        checked={r.active}
                        onChange={(v) => set(r.key, { active: v })}
                        aria-label={t("pricing.active")}
                        data-testid="tier-active"
                      />
                      <IconButton
                        size="sm"
                        variant="danger"
                        label={t("common.delete")}
                        onClick={() => remove(r.key)}
                        data-testid="tier-delete"
                      >
                        <I.Trash size={15} />
                      </IconButton>
                      {errors[i] && (
                        <p className="tier-error" data-testid="tier-error">
                          {t(
                            errors[i] === "dup"
                              ? "pricing.errDup"
                              : errors[i] === "min"
                                ? "pricing.errMin"
                                : "pricing.errPrice",
                          )}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="text-xs text-muted">{t("pricing.rule")}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                onClick={() => void save()}
                loading={busy}
                disabled={!dirty || !valid}
                icon={<I.Check size={16} />}
                data-testid="tier-save"
              >
                {t("common.save")}
              </Button>
              {dirty && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDraft(null);
                    setMsg(null);
                  }}
                  disabled={busy}
                >
                  {t("common.cancel")}
                </Button>
              )}
              {dirty && (
                <span className="text-xs font-semibold text-warning">
                  {t("pricing.unsaved")}
                </span>
              )}
            </div>
          </div>
        </Card>

        <Card title={t("pricing.preview")}>
          <div className="space-y-4" data-testid="tier-preview">
            <div className="tier-ladder">
              {!live.some((x) => x.min === 1) && (
                <div className="tier-step-chip">
                  <b>{t("pricing.one")}</b>
                  <span>{t("pricing.ownPrice")}</span>
                </div>
              )}
              {live.map((x, i) => (
                <div
                  key={x.min}
                  className={cn(
                    "tier-step-chip",
                    i === live.length - 1 && "best",
                  )}
                  data-testid="tier-preview-step"
                >
                  <b>
                    {i === live.length - 1
                      ? t("pricing.nPlus", { n: x.min })
                      : t("pricing.n", { n: x.min })}
                  </b>
                  <span>
                    {t("pricing.eachPrice", {
                      price: formatNumber(x.price, locale),
                    })}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-semibold text-text-2"
                htmlFor="tier-sample"
              >
                {t("pricing.sample")}
              </label>
              <Input
                id="tier-sample"
                type="number"
                min={1}
                inputMode="numeric"
                value={sample}
                onChange={(e) => setSample(e.target.value)}
                className="max-w-[180px]"
                data-testid="tier-sample"
              />
            </div>
            <div className="table-wrap">
              <div className="table-scroll">
                <table className="table text-sm" data-testid="tier-examples">
                  <thead>
                    <tr>
                      <th>{t("pricing.qty")}</th>
                      <th className="text-right">{t("pricing.each")}</th>
                      <th className="text-right">{t("pricing.total")}</th>
                      <th className="text-right">{t("pricing.saving")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examples.map((x) => (
                      <tr key={x.q}>
                        <td>{t("pricing.n", { n: x.q })}</td>
                        <td className="num whitespace-nowrap text-right">
                          {money(x.each)}
                        </td>
                        <td className="num whitespace-nowrap text-right font-semibold">
                          {money(x.total)}
                        </td>
                        <td
                          className={cn(
                            "num whitespace-nowrap text-right",
                            x.save > 0
                              ? "font-semibold text-success"
                              : "text-muted",
                          )}
                        >
                          {x.save > 0 ? `−${money(x.save)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-xs text-muted">{t("pricing.serverNote")}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
