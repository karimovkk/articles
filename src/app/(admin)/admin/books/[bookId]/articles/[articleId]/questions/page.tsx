import { ArticleQuestionsPage } from "@/components/admin/article-questions";

/** 87: maqolaning IELTS savollari — alohida sahifa (avvalgi modal o'rniga) */
export default async function AdminArticleQuestionsPage({ params }: { params: Promise<{ bookId: string; articleId: string }> }) {
  const { bookId, articleId } = await params;
  return <ArticleQuestionsPage bookId={bookId} articleId={articleId} />;
}
