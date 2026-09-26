"use client";

/**
 * 38: foydalanuvchining bog'langan qurilmalari (akkaunt ko'pi bilan 2 ta qurilmada). Foydalanuvchi o'zi qurilmani
 * bo'shata olmaydi (chiqish ham bo'shatmaydi) — faqat admin, sabab bilan: sessiyalari yopiladi, bo'shagan joyni
 * yangi qurilma oladi. Olib tashlanganlar tarix uchun xira ko'rinadi. Backend endpointi bo'lmasa — karta yo'q.
 */
import { useState } from "react";
import { Alert, Badge, Button, Card, Field, Modal, Textarea, cn, formatDate } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { adminApi, errorMessage, type AdminDevice } from "@/lib/api";
import { shortAgent } from "@/lib/agent";
import { useAsync } from "@/lib/use-async";
import { useT } from "@/i18n";

export function UserDevicesCard({ userId }: { userId: string }) {
  const { t } = useT();
  const { data, error: loadError, reload } = useAsync(() => adminApi.userDevices(userId), [userId]);
  // null — oyna yopiq; "all" — barcha qurilmalar; aks holda bitta qurilma
  const [target, setTarget] = useState<AdminDevice | "all" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loadError && !data) return null;
  const active = data?.filter((d) => !d.removed_at) ?? [];
  const removed = data?.filter((d) => d.removed_at) ?? [];

  const close = () => {
    setTarget(null);
    setReason("");
    setError(null);
  };

  async function submit() {
    if (!target || !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (target === "all") await adminApi.removeAllDevices(userId, reason.trim());
      else await adminApi.removeDevice(userId, target.id, reason.trim());
      close();
      reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={t("admin.devices.title", { n: active.length })}
      actions={
        active.length > 1 && (
          <Button size="sm" variant="danger-ghost" onClick={() => setTarget("all")} data-testid="devices-remove-all">
            {t("admin.devices.removeAll")}
          </Button>
        )
      }
      padded={false}
    >
      <div data-testid="admin-devices">
        <p className="px-5 pt-4 text-xs text-muted">{t("admin.devices.hint")}</p>
        {!data ? null : data.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t("devices.empty")}</p>
        ) : (
          <ul className="tracklist mt-3">
            {[...active, ...removed].map((d) => (
              <li key={d.id} className={cn("track", d.removed_at && "opacity-60")} data-testid="admin-device">
                <span className="track-num">{/mobile|android|iphone|ipad/i.test(`${d.name} ${d.user_agent}`) ? <I.Smartphone size={15} /> : <I.Monitor size={15} />}</span>
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="track-title min-w-0" title={d.user_agent ?? undefined}>
                      {d.name || shortAgent(d.user_agent) || t("devices.unknown")}
                    </span>
                    {d.removed_at && (
                      <Badge tone="neutral" className="shrink-0">
                        {t("admin.devices.removed")}
                      </Badge>
                    )}
                  </span>
                  <span className="track-sub">
                    {d.removed_at
                      ? `${t("admin.devices.removedAt", { date: formatDate(d.removed_at) })}${d.remove_reason ? ` · ${d.remove_reason}` : ""}`
                      : `${t("devices.bound", { date: formatDate(d.bound_at) })} · ${t("devices.lastSeen", { date: formatDate(d.last_seen_at) })}`}
                  </span>
                </span>
                {!d.removed_at && (
                  <Button size="sm" variant="secondary" onClick={() => setTarget(d)} data-testid="device-remove">
                    {t("admin.devices.remove")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={!!target} onClose={close} title={target === "all" ? t("admin.devices.removeAll") : t("admin.devices.remove")} size="sm" icon={<I.Monitor size={18} />} data-testid="device-remove-modal">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          {error && <Alert>{error}</Alert>}
          <p className="text-sm text-text-2">
            {target === "all" ? t("admin.devices.removeAllConfirm") : t("admin.devices.removeConfirm", { name: (target && (target.name || shortAgent(target.user_agent))) || t("devices.unknown") })}
          </p>
          <Field label={t("admin.devices.reason")}>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={500} placeholder={t("admin.devices.reasonPlaceholder")} data-testid="device-remove-reason" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="danger" loading={busy} disabled={!reason.trim()} data-testid="device-remove-submit">
              {target === "all" ? t("admin.devices.removeAll") : t("admin.devices.remove")}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
