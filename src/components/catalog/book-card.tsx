"use client";

/**
 * Gorizontal kitob kartasi (16.3, katalog va kutubxona): chapda muqova, o'ngda teglar, nom, tavsif, meta, narx yoki
 * progress va pastda asosiy tugma. Butun karta `href` ga olib boradi (stretched link), tugma — o'z manziliga.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { buttonClass, cn } from "@/components/ui";

export function BookCardH({
  bookId,
  title,
  hasCover,
  coverSource,
  href,
  onOpen,
  tags,
  description,
  meta,
  footer,
  cta,
  className,
}: {
  bookId: string;
  title: string;
  hasCover: boolean;
  coverSource?: "reader" | "catalog" | "auto";
  href: string;
  onOpen?: () => void;
  tags?: ReactNode;
  description?: string | null;
  meta?: ReactNode;
  /** Narx yoki progress qatori */
  footer?: ReactNode;
  cta: { href: string; label: ReactNode; icon?: ReactNode; variant?: "primary" | "secondary" };
  className?: string;
}) {
  return (
    <article className={cn("bcard", className)} data-testid="book-card">
      <BookCover bookId={bookId} title={title} hasCover={hasCover} source={coverSource} />
      <div className="bcard-body">
        {tags && <div className="bcard-tags">{tags}</div>}
        <h3 className="bcard-title">
          <Link href={href} prefetch={false} onClick={onOpen} className="bcard-link">
            {title}
          </Link>
        </h3>
        {description && <p className="bcard-desc">{description}</p>}
        {meta && <div className="bcard-meta">{meta}</div>}
        {footer}
        <div className="bcard-cta">
          <Link href={cta.href} prefetch={false} onClick={onOpen} className={buttonClass(cta.variant ?? "primary", "sm")} {...(cta.href === href ? { tabIndex: -1, "aria-hidden": true } : {})}>
            {cta.icon}
            {cta.label}
          </Link>
        </div>
      </div>
    </article>
  );
}
