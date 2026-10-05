"use client";

/** 45: "Pullik kitoblar" — faqat pullik kitoblar (eski `/catalog` havolalari shu yerga) */
import { CatalogView } from "@/components/catalog/catalog-view";

export default function CatalogPage() {
  return <CatalogView kind="paid" />;
}
