import type { Metadata } from "next";
import { CatalogBookDetail } from "@/components/catalog/book-detail";

export const metadata: Metadata = { title: "Catalog" };

export default async function CatalogBookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return <CatalogBookDetail bookId={bookId} />;
}
