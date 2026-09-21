"use client";

/**
 * `BookAccessResponse`/`OrderResponse` da user/book nomlari yo'q (B5) — id bo'yicha
 * `GET /admin/users/{id}` / `GET /admin/books/{id}` orqali olinadi, modul darajasida keshlanadi.
 */
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";

const userCache = new Map<string, Promise<string>>();
const bookCache = new Map<string, Promise<string>>();

function resolve(cache: Map<string, Promise<string>>, id: string, fetcher: () => Promise<string>): Promise<string> {
  let p = cache.get(id);
  if (!p) {
    p = fetcher().catch(() => id.slice(0, 8));
    cache.set(id, p);
  }
  return p;
}

export function useEntityNames(userIds: string[], bookIds: string[] = []): { users: Record<string, string>; books: Record<string, string> } {
  const [users, setUsers] = useState<Record<string, string>>({});
  const [books, setBooks] = useState<Record<string, string>>({});
  const uKey = [...new Set(userIds)].sort().join(",");
  const bKey = [...new Set(bookIds)].sort().join(",");

  useEffect(() => {
    let alive = true;
    const ids = uKey ? uKey.split(",") : [];
    Promise.all(ids.map((id) => resolve(userCache, id, () => adminApi.user(id).then((u) => u.full_name || u.email || u.phone || id.slice(0, 8))).then((n) => [id, n] as const))).then((pairs) => {
      if (alive && pairs.length) setUsers((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => {
      alive = false;
    };
  }, [uKey]);

  useEffect(() => {
    let alive = true;
    const ids = bKey ? bKey.split(",") : [];
    Promise.all(ids.map((id) => resolve(bookCache, id, () => adminApi.book(id).then((b) => b.title)).then((n) => [id, n] as const))).then((pairs) => {
      if (alive && pairs.length) setBooks((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => {
      alive = false;
    };
  }, [bKey]);

  return { users, books };
}

/** Brauzerda blob'ni fayl sifatida yuklab olish (eksport — B6: backend Content-Disposition bermaydi). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
