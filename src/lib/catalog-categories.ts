"use client";

/**
 * Faol kategoriyalar + har biridagi kitoblar soni (sidebar va katalog chip'lari uchun).
 * 26.4 tezlik: ro'yxat darhol ko'rsatiladi, kitoblar soni esa brauzer bo'sh turganda qo'shimcha so'rovlar bilan
 * olinadi (asosiy `/catalog` so'roviga xalaqit bermaydi) va sessiya keshiga yoziladi — keyingi sahifalarda
 * qayta so'ralmaydi. `GET /categories` da son yo'q (B26).
 */
import { useEffect, useState } from "react";
import { catalogApi, type Category } from "@/lib/api";
import { sessionGet, sessionSet, whenIdle } from "@/lib/session-cache";

export interface CategoryWithCount extends Category {
  count: number | null;
}

const KEY = "a365.categories";
const TTL = 10 * 60 * 1000;

let state: CategoryWithCount[] | undefined;
let started = false;
const listeners = new Set<() => void>();

function publish(v: CategoryWithCount[], cache = true) {
  state = v;
  if (cache) sessionSet(KEY, v);
  listeners.forEach((l) => l());
}

function start() {
  if (started) return;
  started = true;
  const cached = sessionGet<CategoryWithCount[]>(KEY, TTL);
  if (cached) {
    publish(cached, false);
    return;
  }
  catalogApi.categories().then(
    (cats) => {
      // 1-bosqich: ro'yxat darhol (sonlarsiz)
      publish(
        cats.map((c) => ({ ...c, count: null })),
        false,
      );
      // 2-bosqich: sonlar — bo'sh vaqtda
      whenIdle(() => {
        void Promise.all(cats.map((c) => catalogApi.list({ category_id: c.id, page_size: 1 }).then((r) => ({ ...c, count: r.total }), () => ({ ...c, count: null })))).then((withCounts) => publish(withCounts));
      });
    },
    () => publish([], false),
  );
}

/** `undefined` — hali yuklanmadi, `[]` — kategoriya yo'q yoki xato. */
export function useCatalogCategories(): CategoryWithCount[] | undefined {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    start();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}
