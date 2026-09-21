"use client";

import { Badge } from "@/components/ui";
import { useT, type DictKey } from "@/i18n";
import type { OrderStatus } from "@/lib/api";

const TONE: Record<OrderStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PENDING: "warning",
  AWAITING_REVIEW: "info",
  APPROVED: "success",
  REJECTED: "danger",
};
const KEY: Record<OrderStatus, DictKey> = {
  PENDING: "orders.status.PENDING",
  AWAITING_REVIEW: "orders.status.AWAITING_REVIEW",
  APPROVED: "orders.status.APPROVED",
  REJECTED: "orders.status.REJECTED",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useT();
  return <Badge tone={TONE[status] ?? "neutral"}>{KEY[status] ? t(KEY[status]) : status}</Badge>;
}
