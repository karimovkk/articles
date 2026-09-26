"use client";

/**
 * 38: "Qurilmalarim" — akkaunt bog'langan qurilmalar (`GET /me/devices`). Faqat ko'rish: qurilmani bo'shatish
 * faqat administrator orqali (tizimdan chiqish joy bo'shatmaydi). Backend endpointi bo'lmasa — karta ko'rinmaydi.
 */
import { Badge, Card, Spinner, formatDate } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { authApi } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { useT } from "@/i18n";

export function MyDevicesCard() {
  const { t } = useT();
  const { data, error } = useAsync(() => authApi.devices(), []);
  if (error) return null;

  return (
    <Card title={t("devices.title")} padded={false}>
      <div data-testid="my-devices">
        <p className="px-5 pt-4 text-xs text-muted">{t("devices.hint", { n: data?.limit ?? 2 })}</p>
        {!data ? (
          <div className="p-5">
            <Spinner />
          </div>
        ) : data.items.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t("devices.empty")}</p>
        ) : (
          <ul className="tracklist mt-3">
            {data.items.map((d) => (
              <li key={d.id} className="track" data-testid="my-device">
                <span className="track-num">{/mobile|android|iphone|ipad/i.test(d.name ?? "") ? <I.Smartphone size={15} /> : <I.Monitor size={15} />}</span>
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="track-title min-w-0">{d.name || t("devices.unknown")}</span>
                    {d.is_current && (
                      <Badge tone="success" className="shrink-0">
                        {t("devices.current")}
                      </Badge>
                    )}
                  </span>
                  <span className="track-sub">
                    {t("devices.bound", { date: formatDate(d.bound_at) })} · {t("devices.lastSeen", { date: formatDate(d.last_seen_at) })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
