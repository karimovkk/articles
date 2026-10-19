"use client";

/**
 * 113: bog'lanish — o'ng pastki burchakda suzuvchi Telegram tugmasi; bosilganda karta: administrator, `@I365_admin`
 * (nusxa olish) va "Telegram'da yozish" (`https://t.me/I365_admin`, yangi oynada; telefonda Telegram ilovasi ochiladi).
 * Escape / tashqariga bosish — yopiladi. Telegram Mini App ichida — chat Telegram'ning o'zida (`openTelegramLink`),
 * Mini App yopiladi (aks holda chat uning ortida qoladi).
 */
import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import * as I from "@/components/ui/icons";
import { cn } from "@/components/ui";
import { openInTelegram, telegramLinker } from "@/lib/telegram";
import { useT } from "@/i18n";

export const CONTACT_TELEGRAM = "I365_admin";
const CONTACT_URL = `https://t.me/${CONTACT_TELEGRAM}`;

/** Telegram belgisi (qog'oz samolyot) — brend shakli, rang `currentColor` */
function TelegramGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M21.94 4.3 18.7 19.6c-.24 1.08-.88 1.35-1.78.84l-4.94-3.64-2.38 2.3c-.26.26-.48.48-.99.48l.35-5.02 9.14-8.26c.4-.35-.09-.55-.62-.2L6.18 13.2 1.3 11.68c-1.06-.33-1.08-1.06.22-1.57L20.6 2.75c.88-.33 1.65.2 1.34 1.55Z" />
    </svg>
  );
}

export function ContactWidget() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const writeRef = useRef<HTMLAnchorElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    writeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`@${CONTACT_TELEGRAM}`);
      setCopied(true);
    } catch {
      /* ruxsat yo'q — foydalanuvchi o'zi belgilab oladi */
    }
  };

  const write = (e: MouseEvent) => {
    const tg = telegramLinker(); // 118: SDK `initData` siz bo'lsa ham
    if (!tg) return; // oddiy brauzer — havola o'zi (yangi oyna)
    e.preventDefault();
    openInTelegram(tg, CONTACT_URL); // 116: close() taymersiz; 119: yopilmasa — "Botni ochish"
  };

  return (
    <div ref={rootRef} className={cn("contact", open && "open")} data-testid="contact">
      <div id={panelId} role="dialog" aria-modal="false" aria-label={t("contact.title")} className="contact-card" hidden={!open} data-testid="contact-card">
        <div className="contact-head">
          <span className="contact-avatar" aria-hidden>
            365
            <i className="contact-online" />
          </span>
          <span className="min-w-0">
            <span className="contact-name">{t("contact.admin")}</span>
            <span className="contact-status">{t("contact.status")}</span>
          </span>
          <button type="button" className="contact-close" onClick={() => setOpen(false)} aria-label={t("common.close")}>
            <I.X size={16} />
          </button>
        </div>
        <div className="contact-body">
          <p className="contact-title">{t("contact.title")}</p>
          <p className="contact-sub">{t("contact.sub")}</p>
          <div className="contact-handle">
            <TelegramGlyph size={16} />
            <span className="contact-handle-text" data-testid="contact-handle">
              @{CONTACT_TELEGRAM}
            </span>
            <button type="button" className="contact-copy" onClick={() => void copy()} aria-label={t("contact.copy")} title={t("contact.copy")} data-testid="contact-copy">
              {copied ? <I.Check size={15} /> : <I.Copy size={15} />}
              <span>{copied ? t("contact.copied") : t("contact.copy")}</span>
            </button>
          </div>
          <a ref={writeRef} href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className="contact-write" onClick={write} data-testid="contact-write">
            <TelegramGlyph size={18} />
            {t("contact.write")}
            <I.ArrowUpRight size={16} className="contact-write-arrow" />
          </a>
        </div>
      </div>
      <button
        type="button"
        className="contact-fab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t("common.close") : t("contact.fab")}
        title={t("contact.fab")}
        data-testid="contact-fab"
      >
        <span className="contact-fab-icon">{open ? <I.X size={22} /> : <TelegramGlyph size={24} />}</span>
      </button>
    </div>
  );
}
