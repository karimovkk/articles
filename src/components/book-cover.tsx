"use client";

import { useEffect, useState, type ReactNode } from "react";
import { catalogApi, readerApi, type CoverSize } from "@/lib/api";
import { cn } from "@/components/ui";

/**
 * Muqova blob URL sifatida ko'rsatiladi:
 *  - `source="reader"` — `/reader/books/{id}/cover` (Bearer + ruxsat; kutubxona);
 *  - `source="catalog"` — `/catalog/{id}/cover` (public; katalog, mehmonlar uchun ham);
 *  - `source="auto"` — avval reader, bo'lmasa catalog (admin: ruxsatsiz/INACTIVE kitoblar).
 * <img src="..."> to'g'ridan-to'g'ri ishlamaydi, chunki brauzer Authorization sarlavhasini yubormaydi.
 * Muqova yo'q bo'lsa — nom yozilgan "placeholder" (`.book-cover .ph`).
 */
export function BookCover({
  bookId,
  title,
  className,
  hasCover = true,
  size = "thumb",
  source = "reader",
  children,
}: {
  bookId: string;
  title: string;
  className?: string;
  hasCover?: boolean;
  /** `thumb|medium` — WebP rendition (T1-05), `original` — asl fayl */
  size?: CoverSize;
  source?: "reader" | "catalog" | "auto";
  /** Muqova ustidagi belgilar (`.badge-tl` / `.badge-tr`) */
  children?: ReactNode;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasCover) return;
    const ac = new AbortController();
    let objectUrl: string | null = null;
    const load = async () => {
      if (source === "catalog") return catalogApi.coverUrl(bookId, size, ac.signal);
      const u = await readerApi.coverUrl(bookId, size, ac.signal).catch(() => null);
      if (u || source === "reader") return u;
      return catalogApi.coverUrl(bookId, size, ac.signal);
    };
    load()
      .then((u) => {
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => setUrl(null));
    return () => {
      ac.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [bookId, hasCover, size, source]);

  return (
    <div className={cn("book-cover", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob URL, next/image optimallashtira olmaydi
        <img src={url} alt={title} draggable={false} />
      ) : (
        <div className="ph">
          <span>{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}
