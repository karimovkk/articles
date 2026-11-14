"use client";

/**
 * 126: Dashboard "oltin tahririyat" vidjetlari (uslublar — admin.css):
 *  - Meter     — holatlar ulushi segmentli chiziq (stat plitka ichida);
 *  - Timeline  — so'nggi admin amallari: oltin o'q, holat rangidagi tugunlar, kunlar bo'yicha guruh, "N daq. oldin";
 *  - Shelf     — tezkor o'tish: javondagi kitob umurtqalari (hover — kitob javondan chiqadi);
 *  - RoleArc   — foydalanuvchilar rollar bo'yicha yarim halqa.
 */
import { Fragment, useState, type ReactNode } from "react";
import Link from "next/link";
import { cn, formatDate, statusTone } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { formatDateTime, formatNumber, useT, type DictKey } from "@/i18n";
import type { AuditLog } from "@/lib/api";
import { auditActionLabel, auditEntityLabel } from "@/lib/admin-names";
import { codeLabel } from "@/lib/status-label";

/* ---------- Meter ---------- */

export function Meter({ parts }: { parts: Record<string, number> }) {
  const entries = Object.entries(parts).filter(([, v]) => v > 0);
  const sum = entries.reduce((a, [, v]) => a + v, 0);
  return (
    <span className="adm-meter" aria-hidden>
      {sum === 0 ? (
        <i className="zero" />
      ) : (
        entries.map(([k, v]) => (
          <i key={k} className={statusTone(k)} style={{ flexGrow: v }} />
        ))
      )}
    </span>
  );
}

/* ---------- Timeline ---------- */

export type ActionTone = "success" | "danger" | "warning" | "accent";
export function actionTone(a: string): ActionTone {
  if (
    /REVOKED|REJECTED|BLOCKED|DEACTIVATED|REMOVED|SUSPICIOUS|MISMATCH/.test(a)
  )
    return "danger";
  if (/FLAGGED|RESET/.test(a)) return "warning";
  if (/GRANTED|APPROVED|CREATED|ACTIVATED|RESOLVED|RESTORED/.test(a))
    return "success";
  return "accent";
}
export function actionIcon(a: string): ReactNode {
  const p = { size: 15 };
  if (/SUSPICIOUS|MISMATCH/.test(a)) return <I.AlertTriangle {...p} />;
  if (/ACCESS/.test(a)) return <I.Key {...p} />;
  if (/ORDER/.test(a)) return <I.ShoppingBag {...p} />;
  if (/COVER/.test(a)) return <I.Image {...p} />;
  if (/FILE/.test(a)) return <I.Upload {...p} />;
  if (/^BOOK/.test(a)) return <I.Book {...p} />;
  if (/CATEGORY/.test(a)) return <I.Tag {...p} />;
  if (/DEVICE/.test(a)) return <I.Smartphone {...p} />;
  if (/SESSION|PASSWORD/.test(a)) return <I.Lock {...p} />;
  if (/USER/.test(a)) return <I.User {...p} />;
  return <I.Activity {...p} />;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function Timeline({ logs }: { logs: AuditLog[] }) {
  const { t, locale } = useT();
  const [now] = useState(() => Date.now());
  const today = dayKey(new Date(now));
  const yesterday = dayKey(new Date(now - 864e5));
  const ago = (ms: number) => {
    const m = Math.floor((now - ms) / 6e4);
    if (m < 1) return t("admin.ago.now");
    if (m < 60) return t("admin.ago.min", { n: m });
    if (m < 60 * 24) return t("admin.ago.hour", { n: Math.floor(m / 60) });
    return t("admin.ago.day", { n: Math.floor(m / 1440) });
  };
  return (
    <ol className="adm-tl" data-testid="admin-timeline">
      {logs.map((l, i) => {
        const d = new Date(l.created_at);
        const k = dayKey(d);
        const head = i === 0 || k !== dayKey(new Date(logs[i - 1].created_at));
        const tone = actionTone(l.action);
        return (
          <Fragment key={l.id}>
            {head && (
              <li className="adm-tl-day">
                <span>
                  {k === today
                    ? t("admin.tl.today")
                    : k === yesterday
                      ? t("admin.tl.yesterday")
                      : formatDateTime(d, locale).split(",")[0]}
                </span>
              </li>
            )}
            <li
              className="adm-tl-item"
              data-tone={tone}
              style={{ animationDelay: `${120 + i * 55}ms` }}
            >
              <span className="adm-tl-node">{actionIcon(l.action)}</span>
              <span className="adm-tl-body">
                <span className="adm-tl-title">
                  {auditActionLabel(l.action)}
                </span>
                <span className="adm-tl-meta">
                  <span className="adm-tl-tag">
                    {auditEntityLabel(l.entity_type)}
                  </span>
                  {l.entity_id && (
                    <span className="adm-tl-id">
                      #{l.entity_id.slice(0, 8)}
                    </span>
                  )}
                </span>
              </span>
              <time
                className="adm-tl-time"
                dateTime={l.created_at}
                title={formatDate(l.created_at)}
              >
                {ago(d.getTime())}
              </time>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

/* ---------- Shelf ---------- */

const SHELF: Array<{
  href: string;
  label: DictKey;
  icon: (p: { size?: number }) => ReactNode;
  h: number;
  tone: number;
}> = [
  {
    href: "/admin/books",
    label: "nav.admin.books",
    icon: I.Book,
    h: 100,
    tone: 0,
  },
  {
    href: "/admin/orders",
    label: "nav.admin.orders",
    icon: I.ShoppingBag,
    h: 88,
    tone: 1,
  },
  {
    href: "/admin/users",
    label: "nav.admin.users",
    icon: I.Users,
    h: 94,
    tone: 2,
  },
  {
    href: "/admin/payments",
    label: "nav.admin.payments",
    icon: I.Wallet,
    h: 82,
    tone: 3,
  },
  {
    href: "/admin/broadcast",
    label: "nav.admin.broadcast",
    icon: I.Send,
    h: 97,
    tone: 1,
  },
  {
    href: "/admin/access",
    label: "nav.admin.access",
    icon: I.Key,
    h: 86,
    tone: 0,
  },
  {
    href: "/admin/appearance",
    label: "nav.admin.appearance",
    icon: I.Sparkles,
    h: 91,
    tone: 2,
  },
];

export function Shelf({ badge }: { badge?: number }) {
  const { t } = useT();
  return (
    <div className="adm-shelf" data-testid="admin-shelf">
      <div className="adm-shelf-row">
        {SHELF.map((b, i) => (
          <Link
            key={b.href}
            href={b.href}
            className="adm-spine"
            data-tone={b.tone}
            style={{ height: `${b.h}%`, animationDelay: `${200 + i * 60}ms` }}
            title={t(b.label)}
          >
            <span className="adm-spine-cap">
              <b.icon size={14} />
            </span>
            <span className="adm-spine-title">{t(b.label)}</span>
            {b.href === "/admin/orders" && !!badge && (
              <span className="adm-spine-badge">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        ))}
        <span className="adm-bookend" aria-hidden />
      </div>
      <span className="adm-shelf-board" aria-hidden />
    </div>
  );
}

/* ---------- RoleArc ---------- */

const R = 80;
const HALF = Math.PI * R;

export function RoleArc({ roles }: { roles: Record<string, number> }) {
  const { t } = useT();
  const entries = Object.entries(roles).sort((a, b) => b[1] - a[1]);
  const sum = entries.reduce((a, [, v]) => a + v, 0) || 1;
  const GAP = entries.length > 1 ? 6 : 0;
  // Har bo'lak boshlanishi — oldingi ulushlar yig'indisi
  const starts = entries.map((_, i) =>
    entries.slice(0, i).reduce((a, [, v]) => a + (v / sum) * HALF, 0),
  );
  return (
    <div className="adm-roles" data-testid="admin-roles">
      <div className="adm-roles-arc">
        <svg viewBox="0 0 200 110" aria-hidden>
          <path className="ticks" d="M6,100 A94,94 0 0 1 194,100" />
          <path
            className="track"
            d={`M20,100 A${R},${R} 0 0 1 180,100`}
            pathLength={HALF}
          />
          {entries.map(([k, v], i) => {
            const len = Math.max(0, (v / sum) * HALF - GAP);
            return (
              <path
                key={k}
                className={cn("seg", `s${i % 4}`)}
                d={`M20,100 A${R},${R} 0 0 1 180,100`}
                pathLength={HALF}
                strokeDasharray={`${len} ${HALF}`}
                strokeDashoffset={-starts[i]}
                style={{ animationDelay: `${300 + i * 160}ms` }}
              />
            );
          })}
        </svg>
        <span className="adm-roles-total">
          <b>{formatNumber(entries.length ? sum : 0)}</b>
          <span>{t("admin.roles.total")}</span>
        </span>
      </div>
      <ul className="adm-roles-legend">
        {entries.map(([k, v], i) => (
          <li key={k}>
            <i className={`s${i % 4}`} />
            <span>{codeLabel(k)}</span>
            <b>{formatNumber(v)}</b>
            <em>{Math.round((v / sum) * 100)}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
