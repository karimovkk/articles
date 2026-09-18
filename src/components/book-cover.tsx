"use client";

import { useEffect, useState } from "react";
import { readerApi } from "@/lib/api";
import { cn } from "@/components/ui";

/**
 * Muqova — himoyalangan endpoint (/reader/{id}/cover) orqali Bearer bilan
 * yuklanadi va blob URL sifatida ko'rsatiladi. <img src="..."> to'g'ridan-to'g'ri
 * ishlamaydi, chunki brauzer Authorization sarlavhasini yubormaydi.
 */
export function BookCover({ bookId, title, className, hasCover = true }: { bookId: string; title: string; className?: string; hasCover?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasCover) return;
    const ac = new AbortController();
    let objectUrl: string | null = null;
    readerApi
      .coverUrl(bookId, ac.signal)
      .then((u) => {
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => setUrl(null));
    return () => {
      ac.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [bookId, hasCover]);

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
