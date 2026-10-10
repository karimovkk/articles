"use client";

/**
 * 76: ulashish — havolani nusxalash (✓ "Nusxalandi"), Telegram, WhatsApp, Facebook, X; Web Share API bo'lsa
 * (telefonlar) — tizimning "Ulashish" oynasi ham ("Boshqa ilovalar"). Ijtimoiy tarmoqlar yangi oynada ochiladi.
 * `url` — sayt ichidagi yo'l (`/catalog/…`) yoki to'liq havola; ulashishda to'liq havolaga aylantiriladi.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { Menu, MenuItem, MenuLabel, MenuSep, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { useT } from "@/i18n";

const absolute = (url: string) => (typeof window === "undefined" ? url : new URL(url, window.location.origin).href);
const enc = encodeURIComponent;

/** Ijtimoiy tarmoq havolalari (testlar ham shu ko'rinishni kutadi) */
export function shareLinks(url: string, text: string) {
  return {
    telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`,
    whatsapp: `https://wa.me/?text=${enc(`${text} ${url}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    x: `https://x.com/intent/post?url=${enc(url)}&text=${enc(text)}`,
  };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Eski brauzer / ruxsat yo'q — vaqtinchalik maydon orqali
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

const canNativeShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
const noop = () => () => {};

const Brand = {
  telegram: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="#229ED9">
      <path d="M21.9 4.6 18.7 19.7c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13.5l-4.7-1.5c-1-.3-1-1 .2-1.5L20.5 3.3c.9-.3 1.6.2 1.4 1.3Z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="#25D366">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="#1877F2">
      <path d="M13.5 21v-7.5H16l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8.1v3h2.5V21h2.9Z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden fill="currentColor">
      <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
    </svg>
  ),
};

export function ShareMenu({
  url,
  title,
  text,
  compact = false,
  className,
  testid = "share",
}: {
  url: string;
  title: string;
  /** Ijtimoiy tarmoqdagi matn (bo'lmasa — sarlavha) */
  text?: string;
  /** Faqat belgi (kartalar, o'quvchi paneli) */
  compact?: boolean;
  className?: string;
  testid?: string;
}) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  // Web Share API faqat brauzerda ma'lum (server render bilan farq bo'lmasin)
  const native = useSyncExternalStore(noop, canNativeShare, () => false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  const message = text ?? title;
  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer");
  const label = copied ? t("share.copied") : t("share.button");

  return (
    <span className={cn("share-wrap", className)}>
      <Menu
        align="end"
        minWidth={220}
        aria-label={t("share.button")}
        trigger={(p) => (
          <button
            {...p}
            type="button"
            className={cn(compact ? "icon-btn share-btn" : "btn secondary sm share-btn", copied && "is-copied")}
            title={label}
            aria-label={compact ? label : undefined}
            data-testid={testid}
          >
            {copied ? <I.Check size={16} /> : <I.Share size={16} />}
            {!compact && <span>{label}</span>}
          </button>
        )}
      >
        <MenuLabel>{t("share.title")}</MenuLabel>
        <MenuItem
          icon={<I.Copy size={16} />}
          data-testid={`${testid}-copy`}
          onSelect={() => {
            void copyText(absolute(url)).then((ok) => ok && setCopied(true));
          }}
        >
          {t("share.copy")}
        </MenuItem>
        <MenuSep />
        {(["telegram", "whatsapp", "facebook", "x"] as const).map((k) => (
          <MenuItem key={k} icon={Brand[k]} data-testid={`${testid}-${k}`} onSelect={() => open(shareLinks(absolute(url), message)[k])}>
            {t(`share.${k}`)}
          </MenuItem>
        ))}
        {native && (
          <>
            <MenuSep />
            <MenuItem
              icon={<I.Share size={16} />}
              data-testid={`${testid}-native`}
              onSelect={() => {
                void navigator.share({ title, text: message, url: absolute(url) }).catch(() => undefined);
              }}
            >
              {t("share.more")}
            </MenuItem>
          </>
        )}
      </Menu>
      <span className="sr-only" aria-live="polite">
        {copied ? t("share.copied") : ""}
      </span>
    </span>
  );
}
