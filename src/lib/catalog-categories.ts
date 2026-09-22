"use client";

/**
 * Faol kategoriyalar + har biridagi kitoblar soni (sidebar va katalog chip'lari uchun, bitta kesh).
 * `GET /categories` da son yo'q (B26) — har kategoriya uchun `GET /catalog?category_id=…&page_size=1` ning `total` i.
 * Xato bo'lsa kesh tozalanadi (keyingi safar qayta so'raladi); son olinmasa `count: null`.
 */
import { useEffect, useState } from "react";
import { catalogApi, type Category } from "@/lib/api";

export interface CategoryWithCount extends Category {
  count: number | null;
}

let cache: Promise<CategoryWithCount[]> | null = null;

export function loadCatalogCategories(): Promise<CategoryWithCount[]> {
  cache ??= catalogApi
    .categories()
    .then((cats) => Promise.all(cats.map((c) => catalogApi.list({ category_id: c.id, page_size: 1 }).then((r) => ({ ...c, count: r.total }), () => ({ ...c, count: null })))))
    .catch((e: unknown) => {
      cache = null;
      throw e;
    });
  return cache;
}

/** `undefined` — yuklanmoqda, `[]` — kategoriya yo'q yoki xato. */
export function useCatalogCategories(): CategoryWithCount[] | undefined {
  const [cats, setCats] = useState<CategoryWithCount[] | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    loadCatalogCategories().then(
      (c) => alive && setCats(c),
      () => alive && setCats([]),
    );
    return () => {
      alive = false;
    };
  }, []);
  return cats;
}
