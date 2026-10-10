"use client";

/**
 * 57: admin "Integratsiya" — Telegram bot (token 🔒, username, webhook kaliti 🔒, admin chat, buyurtmalar guruhi) va to'lov
 * (karta, qabul qiluvchi, ko'rsatma): `GET/PUT /admin/integration-settings`, o'zgarish darhol kuchga kiradi.
 * Maxfiy kalitlar hech qachon ko'rsatilmaydi — faqat `preview` ("••••1234"); "O'zgartirish" → yangi qiymat (parol
 * maydoni). Faqat o'zgargan kalitlar yuboriladi; "Tozalash" → `""` (admin qiymati o'chadi, server qiymatiga qaytadi).
 * Bot token o'zgarsa — "Webhook'ni yangilash" (`POST …/telegram/set-webhook`).
 */
import { useState, type ReactNode } from "react";
import { Alert, Badge, Button, Card, Input, PageHeader, Spinner, Textarea, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { adminApi, errorMessage, type IntegrationSetting } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { DEFAULT_SHOP_URL, SHOP_SETTING_KEY, isShopUrl } from "@/lib/shop";
import { useShopUrl } from "@/providers/appearance-provider";
import { useT, type DictKey } from "@/i18n";

interface FieldDef {
  key: string;
  /** Yo'q bo'lsa (backend yangi kalit qo'shgan) — kalitning o'zi */
  label?: DictKey;
  hint?: DictKey;
  placeholder?: string;
  multiline?: boolean;
  /** ID / raqam — monospace */
  mono?: boolean;
}
const GROUPS: Array<{ id: string; title: DictKey; icon: ReactNode; fields: FieldDef[] }> = [
  {
    id: "telegram",
    title: "integrations.telegram",
    icon: <I.Send size={16} />,
    fields: [
      { key: "telegram.bot_token", label: "integrations.botToken", hint: "integrations.botTokenHint" },
      { key: "telegram.bot_username", label: "integrations.botUsername", placeholder: "articles365_bot", mono: true },
      { key: "telegram.webhook_secret", label: "integrations.webhookSecret" },
      { key: "telegram.admin_chat_id", label: "integrations.adminChat", placeholder: "123456789", mono: true },
      { key: "telegram.order_group_id", label: "integrations.orderGroup", hint: "integrations.orderGroupHint", placeholder: "-1001234567890", mono: true },
    ],
  },
  {
    id: "payment",
    title: "integrations.payment",
    icon: <I.Wallet size={16} />,
    fields: [
      { key: "payment.card_number", label: "integrations.card", placeholder: "8600 0000 0000 0000", mono: true },
      { key: "payment.recipient", label: "integrations.recipient" },
      { key: "payment.instructions", label: "integrations.instructions", multiline: true },
    ],
  },
];
const KNOWN = new Set(GROUPS.flatMap((g) => g.fields.map((f) => f.key)));

export default function AdminIntegrationsPage() {
  const { t } = useT();
  const { data, error, setData } = useAsync(() => adminApi.integrationSettings(), []);
  /** Yuboriladigan o'zgarishlar: kalit → yangi qiymat (`""` — tozalash) */
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);
  const [tokenChanged, setTokenChanged] = useState(false);
  const [hook, setHook] = useState<{ busy: boolean; res: { tone: "success" | "danger"; text: string } | null }>({ busy: false, res: null });

  const settings = data?.settings ?? {};
  const extra = Object.keys(settings).filter((k) => !KNOWN.has(k));
  const groups = extra.length ? [...GROUPS, { id: "other", title: "integrations.other" as DictKey, icon: <I.Settings size={16} />, fields: extra.map((k) => ({ key: k })) }] : GROUPS;
  const count = Object.keys(changes).length;

  const setChange = (key: string, value: string | undefined) =>
    setChanges((c) => {
      const next = { ...c };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  const stopEdit = (key: string) => {
    setEditing((s) => {
      const n = new Set(s);
      n.delete(key);
      return n;
    });
    setChange(key, undefined);
  };

  async function save() {
    if (!count) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminApi.saveIntegrationSettings(changes);
      setData(() => res);
      if (changes["telegram.bot_token"]) setTokenChanged(true);
      setChanges({});
      setEditing(new Set());
      setMsg({ tone: "success", text: t("integrations.saved") });
    } catch (e) {
      setMsg({ tone: "danger", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function setWebhook() {
    setHook({ busy: true, res: null });
    try {
      const r = await adminApi.setTelegramWebhook();
      const url = typeof r.url === "string" ? r.url : null;
      setHook({ busy: false, res: { tone: "success", text: url ? t("integrations.webhookOkUrl", { url }) : t("integrations.webhookOk") } });
      setTokenChanged(false);
    } catch (e) {
      setHook({ busy: false, res: { tone: "danger", text: errorMessage(e) } });
    }
  }

  const header = <PageHeader title={t("integrations.title")} description={t("integrations.sub")} icon={<I.Settings size={24} />} />;
  if (!data)
    return (
      <div>
        {header}
        {error ? <Alert>{error}</Alert> : <Spinner />}
      </div>
    );

  return (
    <div className="space-y-5" data-testid="integrations-page">
      {header}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {groups.map((g) => (
        <Card
          key={g.id}
          title={
            <span className="inline-flex items-center gap-2">
              {g.icon}
              {t(g.title)}
            </span>
          }
        >
          <div className="card-body divide-y divide-border !py-0">
            {g.fields.map((f) => (
              <SettingRow
                key={f.key}
                def={f}
                setting={settings[f.key]}
                change={changes[f.key]}
                editing={editing.has(f.key)}
                onEdit={() => setEditing((s) => new Set(s).add(f.key))}
                onChange={(v) => setChange(f.key, v)}
                onUndo={() => stopEdit(f.key)}
              />
            ))}
            {g.id === "telegram" && (
              <div className="space-y-2 py-4" data-testid="webhook-block">
                {tokenChanged && <Alert tone="info">{t("integrations.tokenChanged")}</Alert>}
                {hook.res && <Alert tone={hook.res.tone}>{hook.res.text}</Alert>}
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" variant={tokenChanged ? "primary" : "secondary"} loading={hook.busy} onClick={() => void setWebhook()} icon={<I.Refresh size={14} />} data-testid="set-webhook">
                    {t("integrations.setWebhook")}
                  </Button>
                  <span className="text-xs text-muted">{t("integrations.setWebhookHint")}</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      ))}
      <ShopCard />
      {/* Saqlanmagan o'zgarish bo'lsa — panel ekran pastida yopishib turadi */}
      <div className={cn("integrations-bar", count > 0 && "dirty")}>
        <Button onClick={() => void save()} loading={busy} disabled={!count} icon={<I.Check size={16} />} data-testid="integrations-save">
          {count ? t("integrations.saveN", { n: count }) : t("integrations.save")}
        </Button>
        {count > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              setChanges({});
              setEditing(new Set());
            }}
            disabled={busy}
          >
            {t("common.cancel")}
          </Button>
        )}
        <span className="text-xs text-muted">{t("integrations.instant")}</span>
      </div>
    </div>
  );
}

/** 78: "Buy Real Books" kartasi havolasi — Uzum Market'dagi do'kon (app-settings `shop.uzum_url`, hamma ko'radi) */
function ShopCard() {
  const { t } = useT();
  const { custom, reload } = useShopUrl();
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const shown = value ?? custom ?? "";
  const dirty = value !== null && value.trim() !== (custom ?? "");
  const invalid = !!shown.trim() && !isShopUrl(shown.trim());

  async function run(fn: () => Promise<unknown>, ok: DictKey) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await reload();
      setValue(null);
      setMsg({ tone: "success", text: t(ok) });
    } catch (e) {
      setMsg({ tone: "danger", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <I.ShoppingBag size={16} />
          {t("integrations.shop.title")}
        </span>
      }
    >
      <div className="card-body space-y-3" data-testid="shop-card">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <p className="text-sm text-text-2">{t("integrations.shop.hint")}</p>
        <Input value={shown} onChange={(e) => setValue(e.target.value)} placeholder={DEFAULT_SHOP_URL} inputMode="url" aria-label={t("integrations.shop.title")} aria-invalid={invalid || undefined} data-testid="shop-url" />
        {invalid && <p className="text-xs font-semibold text-danger" data-testid="shop-url-invalid">{t("integrations.shop.invalid")}</p>}
        <p className="text-xs text-muted">{custom ? t("integrations.shop.current") : t("integrations.shop.default", { url: DEFAULT_SHOP_URL })}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            loading={busy}
            disabled={!dirty || invalid || !shown.trim()}
            icon={<I.Check size={14} />}
            onClick={() => void run(() => adminApi.saveAppSettings({ [SHOP_SETTING_KEY]: { uzum_url: shown.trim() } }), "integrations.shop.saved")}
            data-testid="shop-save"
          >
            {t("integrations.save")}
          </Button>
          {custom && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => adminApi.deleteAppSetting(SHOP_SETTING_KEY), "integrations.shop.resetDone")} data-testid="shop-reset">
              {t("integrations.shop.reset")}
            </Button>
          )}
          <a href={custom ?? DEFAULT_SHOP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink underline">
            {t("integrations.shop.open")}
            <I.ArrowUpRight size={12} />
          </a>
        </div>
      </div>
    </Card>
  );
}

function SettingRow({
  def,
  setting,
  change,
  editing,
  onEdit,
  onChange,
  onUndo,
}: {
  def: FieldDef;
  setting: IntegrationSetting | undefined;
  /** undefined — o'zgarmagan; "" — tozalanadi */
  change: string | undefined;
  editing: boolean;
  onEdit: () => void;
  onChange: (v: string | undefined) => void;
  onUndo: () => void;
}) {
  const { t } = useT();
  const secret = !!setting?.is_secret;
  const original = setting?.value ?? "";
  const cleared = change === "";
  const id = `int-${def.key.replace(/\W/g, "-")}`;
  const source = !setting?.is_set ? "unset" : setting.source === "db" ? "db" : setting.source === "env" ? "env" : "other";
  const label = def.label ? t(def.label) : def.key;

  let control: ReactNode;
  if (cleared) {
    control = (
      <p className="text-sm text-muted" data-testid={`${id}-cleared`}>
        {t("integrations.willClear")}
      </p>
    );
  } else if (secret && !editing) {
    control = (
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("int-preview", !setting?.is_set && "empty")} data-testid={`${id}-preview`}>
          {setting?.is_set ? (setting.preview ?? "••••") : t("integrations.notSet")}
        </span>
        <Button size="sm" variant="secondary" onClick={onEdit} icon={<I.Pencil size={13} />} data-testid={`${id}-edit`}>
          {t("integrations.change")}
        </Button>
      </div>
    );
  } else if (def.multiline) {
    control = <Textarea id={id} rows={3} value={change ?? original} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value === original ? undefined : e.target.value)} data-testid={id} />;
  } else {
    control = (
      <Input
        id={id}
        type={secret ? "password" : "text"}
        autoComplete={secret ? "new-password" : "off"}
        value={secret ? (change ?? "") : (change ?? original)}
        placeholder={secret ? t("integrations.newValue") : def.placeholder}
        onChange={(e) => onChange(secret ? e.target.value || undefined : e.target.value === original ? undefined : e.target.value)}
        className={cn((secret || def.mono) && "font-mono")}
        autoFocus={secret}
        data-testid={id}
      />
    );
  }

  return (
    <div className="int-row" data-testid="int-row" data-key={def.key}>
      <div className="min-w-0">
        <label htmlFor={id} className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
          {secret && <I.Lock size={13} className="text-muted" />}
          {label}
          <Badge tone={source === "db" ? "accent" : source === "unset" ? "warning" : "neutral"}>
            <span data-testid={`${id}-source`}>{t(`integrations.source.${source}` as DictKey)}</span>
          </Badge>
          {change !== undefined && <Badge tone="info">{t("integrations.changed")}</Badge>}
        </label>
        {def.hint && <p className="mt-1 text-xs text-muted">{t(def.hint)}</p>}
      </div>
      <div className="min-w-0 space-y-2">
        {control}
        <div className="flex flex-wrap gap-3 text-xs">
          {(change !== undefined || (secret && editing)) && (
            <button type="button" className="font-semibold text-muted hover:text-text" onClick={onUndo}>
              {t("integrations.undo")}
            </button>
          )}
          {setting?.source === "db" && !cleared && (
            <button type="button" className="font-semibold text-danger hover:underline" onClick={() => onChange("")} data-testid={`${id}-clear`}>
              {t("integrations.clear")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
