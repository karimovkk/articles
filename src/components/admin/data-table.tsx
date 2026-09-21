"use client";

import { useState, type ReactNode } from "react";
import { useAsync } from "@/lib/use-async";
import { Alert, Pagination, Spinner, cn } from "@/components/ui";
import type { Paginated } from "@/lib/api";
import { useT } from "@/i18n";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** Raqamli ustun — o'ngga tekislanadi, tabular raqamlar */
  num?: boolean;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  loading,
  error,
  onPage,
  empty,
  onRowClick,
  minWidth,
}: {
  data: Paginated<T> | null;
  columns: Column<T>[];
  loading: boolean;
  error: string | null;
  onPage: (p: number) => void;
  empty?: string;
  onRowClick?: (row: T) => void;
  /** Kichik ekranlarda gorizontal aylantirish uchun minimal kenglik */
  minWidth?: number;
}) {
  const { t } = useT();
  empty ??= t("common.noData");
  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      <div className={cn("table-wrap", loading && data && "is-loading")} aria-busy={loading}>
        <div className="table-scroll">
          <table className="table" style={minWidth ? { minWidth } : undefined}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={cn(c.num && "text-right", c.className)}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={columns.length} className="empty-cell">
                    <Spinner className="mx-auto size-5" />
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="empty-cell">
                    {empty}
                  </td>
                </tr>
              ) : (
                data.items.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(onRowClick && "clickable")}
                    onClick={
                      onRowClick
                        ? (e) => {
                            // Qator ichidagi havola/tugma o'z ishini qiladi — ikki marta navigatsiya bo'lmasin
                            if ((e.target as HTMLElement).closest("a, button, [role='combobox'], input, label")) return;
                            onRowClick(row);
                          }
                        : undefined
                    }
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={cn(c.num && "num text-right", c.className)}>
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={onPage} />}
    </div>
  );
}

/** Jadval ustidagi filtr paneli (`.table-toolbar`): forma sifatida — Enter qidiradi. */
export function Toolbar({ children, onSubmit, meta, className, busy }: { children: ReactNode; onSubmit?: () => void; meta?: ReactNode; className?: string; busy?: boolean }) {
  return (
    <form
      className={cn("table-toolbar", className)}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      role="search"
    >
      {children}
      {busy && <Spinner className="size-4 text-muted" />}
      {meta && <div className="toolbar-meta">{meta}</div>}
    </form>
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
