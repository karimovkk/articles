import type { Metadata } from "next";
import { ReaderView } from "@/components/reader/reader-view";

export const metadata: Metadata = { title: "Reader" };

/** Reader — maqola bo'yicha (`/reader/articles/{article_id}`). Next.js 16: `params` — Promise. */
export default async function ReaderPage({ params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  return <ReaderView articleId={articleId} />;
}
