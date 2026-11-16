import type { Metadata } from "next";
import { ReadRedirect } from "@/components/library/read-redirect";

export const metadata: Metadata = { title: "Reader" };

/**
 * `/reader/book/{bookId}` — kartadagi "O'qish" tugmasi: to'g'ridan-to'g'ri davom ettiriladigan maqolaga.
 * `?from=catalog` — maqolalar ochilmasa katalogdagi kitob sahifasiga, aks holda kutubxonadagi kitob sahifasiga qaytadi.
 */
export default async function ReadBookPage({ params, searchParams }: { params: Promise<{ bookId: string }>; searchParams: Promise<{ from?: string }> }) {
  const { bookId } = await params;
  const { from } = await searchParams;
  const fallback = from === "catalog" ? `/catalog/${bookId}` : `/books/${bookId}`;
  return <ReadRedirect bookId={bookId} fallback={fallback} />;
}
