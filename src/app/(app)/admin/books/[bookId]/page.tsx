import { AdminBookDetail } from "@/components/admin/book-detail";

export default async function AdminBookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return <AdminBookDetail bookId={bookId} />;
}
