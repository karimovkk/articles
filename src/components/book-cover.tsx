"use client";

import { useEffect, useState } from "react";
import { catalogApi, readerApi, type CoverSize } from "@/lib/api";
import { cn } from "@/components/ui";

/**
 * Muqova blob URL sifatida ko'rsatiladi:
 *  - `source="reader"` — `/reader/books/{id}/cover` (Bearer + ruxsat; kutubxona);
 *  - `source="catalog"` — `/catalog/{id}/cover` (public; katalog, mehmonlar uchun ham).
 * <img src="..."> to'g'ridan-to'g'ri ishlamaydi, chunki brauzer Authorization sarlavhasini yubormaydi.
 */
export function BookCover({
  bookId,
  title,
  className,
  hasCover = true,
  size = "thumb",
  source = "reader",
}: {
  bookId: string;
  title: string;
  className?: string;
  hasCover?: boolean;
  /** `thumb|medium` — WebP rendition (T1-05), `original` — asl fayl */
  size?: CoverSize;
  source?: "reader" | "catalog";
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasCover) return;
    const ac = new AbortController();
    let objectUrl: string | null = null;
    (source === "catalog" ? catalogApi.coverUrl(bookId, size, ac.signal) : readerApi.coverUrl(bookId, size, ac.signal))
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
    <div className={cn("relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-border bg-bg", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob URL, next/image optimallashtira olmaydi
        <img src={url} alt={title} className="size-full object-cover" draggable={false} />
      ) : (
        <div className="flex size-full items-center justify-center p-3 text-center text-xs text-muted">{title}</div>
      )}
    </div>
  );
}
