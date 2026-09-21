"use client";

import { useState, type ReactNode } from "react";
import { useAsync } from "@/lib/use-async";
import { Alert, Pagination, Spinner } from "@/components/ui";
import type { Paginated } from "@/lib/api";
import { useT } from "@/i18n";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  loading,
  error,
  onPage,
  empty,
}: {
  data: Paginated<T> | null;
  columns: Column<T>[];
  loading: boolean;
  error: string | null;
  onPage: (p: number) => void;
  empty?: string;
}) {
  const { t } = useT();
  empty ??= t("common.noData");
  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 font-medium ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-muted">
                  <Spinner className="mx-auto size-5" />
                </td>
              </tr>
            ) : !data || data.items.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-muted">
                  {empty}
                </td>
              </tr>
            ) : (
              data.items.map((row) => (
                <tr key={row.id} className="hover:bg-bg/60">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2 align-top text-text ${c.className ?? ""}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {data && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            {t("common.total")}: {data.total}
          </span>
          <Pagination page={data.page} pages={data.pages} onChange={onPage} />
        </div>
      )}
    </div>
  );
}


/** Ro'yxat yuklash uchun umumiy hook: filtr (`deps`) o'zgarsa 1-sahifaga qaytadi. */
export function usePaged<T>(fetcher: (page: number) => Promise<Paginated<T>>, deps: readonly unknown[]) {
  const depsKey = JSON.stringify(deps);
  const [pageState, setPageState] = useState({ page: 1, depsKey });
  const page = pageState.depsKey === depsKey ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ page: p, depsKey });

  const { data, loading, error, reload } = useAsync(() => fetcher(page), [page, depsKey]);
  return { page, setPage, data, loading, error, reload };
}
