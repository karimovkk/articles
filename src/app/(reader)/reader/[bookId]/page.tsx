import type { Metadata } from "next";
import { ReaderView } from "@/components/reader/reader-view";

export const metadata: Metadata = { title: "Reader" };

/** Next.js 16: `params` — Promise. */
export default async function ReaderPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return <ReaderView bookId={bookId} />;
}
