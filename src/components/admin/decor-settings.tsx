"use client";

/**
 * 125: admin "Ko'rinish" → "Bezaklar": mavsumiy effekt (o'chiq / avtomatik / qish / bahor / yoz / kuz) va sidebar'dagi
 * faol band yonidagi bestseller kitob. `PUT /admin/app-settings` (kalit `decor`) — hammaga darhol (keyingi yuklashda).
 */
import { useEffect, useState } from "react";
import { Alert, Button, Card, Field, Select, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { adminApi, catalogApi, errorMessage, type CatalogItem } from "@/lib/api";
import { DECOR_SETTING_KEY, SEASON_MODES, activeSeason, isBookId, type Decor, type SeasonMode } from "@/lib/decor";
import { useDecor } from "@/providers/appearance-provider";
import { useT, type DictKey } from "@/i18n";

export function DecorSettings() {
  const { t } = useT();
  const { decor, reload } = useDecor();
  const [draft, setDraft] = useState<Decor | null>(null);
  const [books, setBooks] = useState<CatalogItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const d = draft ?? decor;

  useEffect(() => {
    let alive = true;
    catalogApi
      .list({ page_size: 100 })
      .then((r) => alive && setBooks(r.items))
      .catch(() => alive && setBooks([]));
    return () => {
      alive = false;
    };
  }, []);

  const set = (patch: Partial<Decor>) => setDraft({ ...d, ...patch });
  const now = activeSeason("auto");

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await adminApi.saveAppSettings({ [DECOR_SETTING_KEY]: d });
      await reload();
      setDraft(null);
      setMsg({ tone: "success", text: t("decor.saved") });
    } catch (e) {
      setMsg({ tone: "danger", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const bookOptions = [
    { value: "default", label: t("decor.best.default") },
    { value: "off", label: t("decor.best.off") },
    ...(books ?? []).map((b) => ({ value: b.book_id, label: b.title, description: b.author ?? undefined })),
    // Tanlangan kitob ro'yxatda yo'q (nofaol / 100 dan keyin) — nomi bilan saqlanib qoladi
    ...(isBookId(d.bestseller) && books && !books.some((b) => b.book_id === d.bestseller) ? [{ value: d.bestseller, label: d.bestseller_title ?? d.bestseller }] : []),
  ];

  return (
    <Card title={t("decor.title")}>
      <div className="card-body space-y-5" data-testid="decor-settings">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Field label={t("decor.season")} hint={t("decor.seasonHint")} group>
          <div className="seg flex-wrap" role="group" aria-label={t("decor.season")} data-testid="decor-season">
            {SEASON_MODES.map((m: SeasonMode) => (
              <button key={m} type="button" className={cn(d.season === m && "active")} aria-pressed={d.season === m} onClick={() => set({ season: m })} data-id={m}>
                {m === "auto" && now ? t("decor.s.autoNow", { s: t(`decor.s.${now}` as DictKey) }) : t(`decor.s.${m}` as DictKey)}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("decor.best")} hint={t("decor.bestHint")} group>
          <Select
            value={d.bestseller}
            onChange={(v) => set({ bestseller: v, bestseller_title: books?.find((b) => b.book_id === v)?.title ?? (isBookId(v) ? d.bestseller_title : null) })}
            options={bookOptions}
            searchable
            aria-label={t("decor.best")}
            data-testid="decor-bestseller"
          />
        </Field>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button onClick={() => void save()} loading={busy} disabled={!draft} icon={<I.Check size={16} />} data-testid="decor-save">
            {t("appearance.save")}
          </Button>
          {draft && (
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={busy}>
              {t("common.cancel")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
