"use client";

/**
 * 78: chap pastki karta — "Buy Real Books": Uzum Market'dagi do'konimizga (yangi oynada) olib boradi. Rasm o'rniga
 * kitoblarimiz muqovalari 3D halqada aylanib turadi (reduced-motion — harakatsiz).
 * 86: muqovalar — login sahifasidagi "365" jurnallarimiz (o'sha fotolardan kesilgan tekis muqovalar,
 * `public/covers/mag-1…7.webp`; `/books` — himoyalangan yo'l (proxy), shuning uchun alohida papka); halqaning o'zi 3D — shuning uchun tekis variant (burchakdan olingani ikki marta qiyshayardi).
 */
import * as I from "@/components/ui/icons";
import { useShopUrl } from "@/providers/appearance-provider";
import { useT } from "@/i18n";

const COVERS = Array.from({ length: 7 }, (_, i) => `/covers/mag-${i + 1}.webp`);

export function BuyRealBooks({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useT();
  const { url } = useShopUrl();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onNavigate}
      className="buy-books"
      aria-label={`${t("client.buyBooksTitle")} — ${t("client.buyBooksSub")}`}
      data-testid="buy-books"
    >
      <span className="bb-stage" aria-hidden>
        <span
          className="bb-ring"
          style={{ ["--n" as string]: COVERS.length }}
          data-testid="buy-books-ring"
        >
          {COVERS.map((src, i) => (
            <span
              key={src}
              className="bb-item"
              style={{ ["--i" as string]: i }}
              data-testid="buy-books-cover"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- dekorativ, kichik statik WebP */}
              <img
                src={src}
                alt=""
                className="bb-cover"
                draggable={false}
                decoding="async"
              />
            </span>
          ))}
        </span>
      </span>
      <span className="bb-title">{t("client.buyBooksTitle")}</span>
      <span className="bb-sub">{t("client.buyBooksSub")}</span>
      <span className="bb-uzum">
        <span className="bb-uzum-dot" aria-hidden />
        Uzum Market
        <I.ArrowUpRight size={14} />
      </span>
    </a>
  );
}
