import { BookPage } from "@/components/library/book-page";

/** Kutubxonadagi kitob: maqolalar ro'yxati va o'qish holati. */
export default async function LibraryBookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return <BookPage bookId={bookId} />;
}
