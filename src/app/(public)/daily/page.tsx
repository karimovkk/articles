"use client";

/** 45: "Kunlik kitoblar" — faqat tekin kitoblar (ro'yxatdan o'tmasdan ham o'qiladi) */
import { CatalogView } from "@/components/catalog/catalog-view";

export default function DailyBooksPage() {
  return <CatalogView kind="free" />;
}
