"use client";

/**
 * Qurilmalar tekshiruvi (`GET /admin/users/device-reviews/pending`): yangi qurilma tizimiga o'tishda migratsiya
 * aniq hal qila olmagan qurilmalar. Tizim oxirgi faollik bo'yicha taxmin qilmaydi — admin qaror qiladi.
 */
import Link from "next/link";
import { useState } from "react";
import { Alert, Card, PageHeader, Spinner, buttonClass, formatDate } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { DeviceBadges, DeviceReviewModal, ReviewButtons, deviceLabel, useReviewReasonText, type ReviewAction } from "@/components/admin/device-review";
import { adminApi, type DeviceReview } from "@/lib/api";
import { useEntityNames } from "@/lib/admin-names";
import { useAsync } from "@/lib/use-async";
import { useT } from "@/i18n";

export default function AdminDeviceReviewsPage() {
  const { t } = useT();
  const { data, error, reload } = useAsync(() => adminApi.deviceReviews(), []);
  const [review, setReview] = useState<{ device: DeviceReview; action: ReviewAction } | null>(null);
  const reviewReason = useReviewReasonText();
  const { users: names } = useEntityNames([...new Set((data ?? []).map((d) => d.user_id))]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.deviceReviews.title")} description={t("admin.deviceReviews.description")} icon={<I.ShieldCheck size={26} />} />
      {error && <Alert>{error}</Alert>}
      <Card padded={false}>
        <div data-testid="device-reviews">
          {!data && !error ? (
            <div className="p-5">
              <Spinner />
            </div>
          ) : !data?.length ? (
            <p className="p-5 text-sm text-muted" data-testid="device-reviews-empty">
              {t("admin.deviceReviews.empty")}
            </p>
          ) : (
            <ul className="tracklist">
              {data.map((d) => (
                <li key={d.id} className="track" data-testid="device-review-row">
                  <span className="track-num">{d.kind === "telegram" || /mobile|android|iphone|ipad/i.test(`${d.name} ${d.user_agent}`) ? <I.Smartphone size={15} /> : <I.Monitor size={15} />}</span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="track-title min-w-0" title={d.user_agent ?? undefined}>
                        {deviceLabel(d, t("devices.unknown"))}
                      </span>
                      <DeviceBadges device={d} />
                    </span>
                    <span className="track-sub">
                      {t("admin.deviceReviews.user")}: {names[d.user_id] ?? d.user_id.slice(0, 8)} · {t("devices.bound", { date: formatDate(d.bound_at) })}
                      {d.removed_at ? ` · ${t("admin.devices.removedAt", { date: formatDate(d.removed_at) })}` : ""}
                    </span>
                    <span className="track-sub text-danger">{reviewReason(d.review_reason)}</span>
                  </span>
                  <span className="flex shrink-0 flex-wrap justify-end gap-2">
                    <Link href={`/admin/users/${d.user_id}`} className={buttonClass("ghost", "sm")}>
                      {t("admin.deviceReviews.openUser")}
                    </Link>
                    <ReviewButtons onPick={(action) => setReview({ device: d, action })} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
      <DeviceReviewModal
        userId={review?.device.user_id ?? ""}
        device={review?.device ?? null}
        action={review?.action ?? "keep"}
        onClose={() => setReview(null)}
        onDone={() => {
          setReview(null);
          reload();
        }}
      />
    </div>
  );
}
