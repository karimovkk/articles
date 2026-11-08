"use client";

/**
 * Qurilma tekshiruvi: yangi qurilma tizimiga o'tishda migratsiya taxmin qilmagan qurilmalar (`needs_review`).
 * Admin "bog'langan qoldirish" yoki "olib tashlash"ni tanlaydi; sabab majburiy, backend audit yozadi.
 */
import { useState } from "react";
import { Alert, Badge, Button, Field, Modal, Textarea } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { adminApi, errorMessage, type AdminDevice } from "@/lib/api";
import { shortAgent } from "@/lib/agent";
import { hasKey, useT } from "@/i18n";

export type ReviewAction = "keep" | "remove";

export function deviceLabel(d: AdminDevice, unknown: string): string {
  return d.name || shortAgent(d.user_agent) || unknown;
}

/** Tekshiruv sababi — tarjima; noma'lum — o'zi. */
export function useReviewReasonText() {
  const { t } = useT();
  return (reason: string | null | undefined) => {
    if (!reason) return "";
    const key = `admin.devices.reviewReason.${reason}`;
    return hasKey(key) ? t(key) : reason;
  };
}

/** Qurilma holati belgilari: Telegram, slot, cookie kaliti, faol sessiya, tekshiruv. */
export function DeviceBadges({ device }: { device: AdminDevice }) {
  const { t } = useT();
  return (
    <>
      {device.kind === "telegram" && (
        <Badge tone="info" className="shrink-0">
          {t("admin.devices.telegram")}
        </Badge>
      )}
      {!device.removed_at && device.slot_no != null && (
        <Badge tone="neutral" className="shrink-0">
          {t("admin.devices.slot", { n: device.slot_no })}
        </Badge>
      )}
      {!device.removed_at && device.identity_confirmed === false && (
        <span title={t("admin.devices.unconfirmedHint")} data-testid="device-unconfirmed">
          <Badge tone="warning" className="shrink-0">
            {t("admin.devices.unconfirmed")}
          </Badge>
        </span>
      )}
      {device.has_active_session && (
        <Badge tone="success" className="shrink-0">
          {t("admin.devices.activeSession")}
        </Badge>
      )}
      {device.needs_review && (
        <span data-testid="device-needs-review">
          <Badge tone="danger" className="shrink-0">
            {t("admin.devices.review")}
          </Badge>
        </span>
      )}
    </>
  );
}

/** keep / remove tugmalari (faqat `needs_review` qurilmalarda). */
export function ReviewButtons({ onPick }: { onPick: (action: ReviewAction) => void }) {
  const { t } = useT();
  return (
    <span className="flex shrink-0 gap-2">
      <Button size="sm" variant="secondary" onClick={() => onPick("keep")} data-testid="device-review-keep">
        {t("admin.devices.keep")}
      </Button>
      <Button size="sm" variant="danger-ghost" onClick={() => onPick("remove")} data-testid="device-review-remove">
        {t("admin.devices.reviewRemove")}
      </Button>
    </span>
  );
}

export function DeviceReviewModal({
  userId,
  device,
  action,
  onClose,
  onDone,
}: {
  userId: string;
  device: AdminDevice | null;
  action: ReviewAction;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useT();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = device ? deviceLabel(device, t("devices.unknown")) : "";
  const close = () => {
    setReason("");
    setError(null);
    onClose();
  };

  async function submit() {
    if (!device || !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.resolveDeviceReview(userId, device.id, action, reason.trim());
      setReason("");
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const title = action === "keep" ? t("admin.devices.keep") : t("admin.devices.reviewRemove");
  return (
    <Modal open={!!device} onClose={close} title={title} size="sm" icon={<I.ShieldCheck size={18} />} data-testid="device-review-modal">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        {error && <Alert>{error}</Alert>}
        <p className="text-sm text-text-2">
          {action === "keep" ? t("admin.devices.keepConfirm", { name }) : t("admin.devices.reviewRemoveConfirm", { name })}
        </p>
        <Field label={t("admin.devices.reason")}>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={500} data-testid="device-review-reason" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant={action === "keep" ? "primary" : "danger"} loading={busy} disabled={!reason.trim()} data-testid="device-review-submit">
            {title}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
