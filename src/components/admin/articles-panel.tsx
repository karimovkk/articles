"use client";

/**
 * Kitob maqolalari (admin): yaratish, nomini/tartibini o'zgartirish, o'chirish, PDF yuklash (progress),
 * qo'lda mundarija (FE-6.10, `PUT .../toc`). PROCESSING holatida ro'yxat avtomatik yangilanadi.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Select,
  statusTone,
} from "@/components/ui";
import { adminApi, errorMessage, type Article } from "@/lib/api";
import { formatMb, validatePdf } from "@/lib/uploads";
import { env } from "@/lib/env";
import { useT } from "@/i18n";

interface TocRow {
  level: number;
  title: string;
  page: string;
}

export function ArticlesPanel({
  bookId,
  articles,
  onChanged,
}: {
  bookId: string;
  articles: Article[];
  onChanged: () => void;
}) {
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [renaming, setRenaming] = useState<Article | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [tocFor, setTocFor] = useState<Article | null>(null);
  const [tocRows, setTocRows] = useState<TocRow[]>([]);
  const [upload, setUpload] = useState<{
    id: string;
    loaded: number;
    total: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<string | null>(null);

  const sorted = articles.slice().sort((a, b) => a.order_index - b.order_index);
  const processing = sorted.some(
    (a) =>
      a.processing_status === "PROCESSING" ||
      a.processing_status === "UPLOADING",
  );
  useEffect(() => {
    if (!processing) return;
    const timer = window.setInterval(onChanged, 3000);
    return () => window.clearInterval(timer);
  }, [processing, onChanged]);

  async function run(id: string | null, fn: () => Promise<unknown>) {
    setBusyId(id ?? "new");
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  function create(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    void run(null, async () => {
      await adminApi.createArticle(bookId, {
        title: newTitle.trim(),
        order_index: sorted.length,
      });
      setNewTitle("");
    });
  }

  function move(a: Article, dir: -1 | 1) {
    const i = sorted.findIndex((x) => x.id === a.id);
    const other = sorted[i + dir];
    if (!other) return;
    void run(a.id, () =>
      Promise.all([
        adminApi.updateArticle(bookId, a.id, {
          order_index: other.order_index,
        }),
        adminApi.updateArticle(bookId, other.id, {
          order_index: a.order_index,
        }),
      ]),
    );
  }

  async function onFile(file: File) {
    const id = uploadTarget.current;
    if (!id) return;
    setError(null);
    const problem = await validatePdf(file);
    if (problem) return setError(problem);
    setUpload({ id, loaded: 0, total: file.size });
    await run(id, () =>
      adminApi.uploadArticleFile(bookId, id, file, {
        onProgress: (loaded, total) => setUpload({ id, loaded, total }),
      }),
    );
    setUpload(null);
  }

  function openToc(a: Article) {
    const existing =
      (a.article_metadata?.toc as
        | Array<{ level?: number; title: string; page?: number | null }>
        | undefined) ?? [];
    setTocRows(
      existing.length
        ? existing.map((e) => ({
            level: e.level ?? 1,
            title: e.title,
            page: e.page == null ? "" : String(e.page),
          }))
        : [{ level: 1, title: "", page: "" }],
    );
    setTocFor(a);
  }
  function saveToc(e: FormEvent) {
    e.preventDefault();
    if (!tocFor) return;
    const entries = tocRows
      .filter((r) => r.title.trim())
      .map((r) => ({
        level: r.level,
        title: r.title.trim(),
        page: r.page.trim() === "" ? null : Number(r.page),
      }));
    void run(tocFor.id, async () => {
      await adminApi.setArticleToc(bookId, tocFor.id, entries);
      setTocFor(null);
    });
  }

  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
      {sorted.length === 0 ? (
        <p className="text-sm text-muted">{t("admin.articles.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-1">#</th>
                <th className="py-1">{t("admin.books.name")}</th>
                <th className="py-1">{t("common.status")}</th>
                <th className="py-1">{t("admin.books.pages")}</th>
                <th className="py-1">{t("admin.books.file")}</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((a, i) => (
                <tr key={a.id} data-article={a.id}>
                  <td className="py-2 align-top text-muted">
                    <span className="inline-flex items-center gap-0.5">
                      {i + 1}
                      <button
                        className="px-1 text-xs hover:text-text disabled:opacity-30"
                        disabled={i === 0 || !!busyId}
                        onClick={() => move(a, -1)}
                        title={t("admin.articles.up")}
                        aria-label={t("admin.articles.up")}
                      >
                        ↑
                      </button>
                      <button
                        className="px-1 text-xs hover:text-text disabled:opacity-30"
                        disabled={i === sorted.length - 1 || !!busyId}
                        onClick={() => move(a, 1)}
                        title={t("admin.articles.down")}
                        aria-label={t("admin.articles.down")}
                      >
                        ↓
                      </button>
                    </span>
                  </td>
                  <td className="py-2 align-top text-text">{a.title}</td>
                  <td className="py-2 align-top">
                    <Badge tone={statusTone(a.processing_status)}>
                      {a.processing_status}
                    </Badge>
                    {a.processing_error && (
                      <p className="mt-1 text-xs text-red-500">
                        {a.processing_error}
                      </p>
                    )}
                  </td>
                  <td className="py-2 align-top text-muted">
                    {a.page_count ?? "—"}
                  </td>
                  <td className="py-2 align-top text-xs text-muted">
                    {a.has_source_file
                      ? `${t("admin.books.pdfYes")}${a.file_size ? ` · ${formatMb(a.file_size)}` : ""}${a.file_version > 1 ? ` · v${a.file_version}` : ""}`
                      : t("common.none")}
                    {upload?.id === a.id && (
                      <div
                        className="mt-1 w-40"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(
                          (upload.loaded / upload.total) * 100,
                        )}
                      >
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
                          <div
                            className="h-full rounded-full bg-accent transition-[width]"
                            style={{
                              width: `${Math.min(100, (upload.loaded / upload.total) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="py-2 text-right align-top">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyId === a.id}
                        onClick={() => {
                          uploadTarget.current = a.id;
                          fileRef.current?.click();
                        }}
                      >
                        {a.has_source_file
                          ? t("admin.books.replacePdf")
                          : t("admin.books.uploadPdf")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openToc(a)}
                      >
                        {t("admin.articles.toc")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRenaming(a);
                          setRenameTitle(a.title);
                        }}
                      >
                        {t("common.edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={busyId === a.id}
                        onClick={() => {
                          if (
                            confirm(
                              t("admin.articles.deleteConfirm", {
                                title: a.title,
                              }),
                            )
                          )
                            void run(a.id, () =>
                              adminApi.deleteArticle(bookId, a.id),
                            );
                        }}
                      >
                        {t("common.delete")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={create} className="flex flex-wrap items-end gap-2">
        <Field label={t("admin.articles.newTitle")}>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t("admin.articles.newPlaceholder")}
            className="min-w-[260px]"
          />
        </Field>
        <Button
          type="submit"
          loading={busyId === "new"}
          disabled={!newTitle.trim()}
        >
          {t("admin.articles.add")}
        </Button>
        <p className="w-full text-xs text-muted">
          {t("admin.articles.hint", { pdf: env.maxPdfMb })}
        </p>
      </form>

      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title={t("admin.articles.rename")}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!renaming) return;
            void run(renaming.id, async () => {
              await adminApi.updateArticle(bookId, renaming.id, {
                title: renameTitle.trim(),
              });
              setRenaming(null);
            });
          }}
          className="space-y-3"
        >
          <Field label={t("admin.books.name")}>
            <Input
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRenaming(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              loading={!!renaming && busyId === renaming.id}
            >
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!tocFor}
        onClose={() => setTocFor(null)}
        title={`${t("admin.articles.toc")}: ${tocFor?.title ?? ""}`}
      >
        <form onSubmit={saveToc} className="space-y-3">
          <p className="text-xs text-muted">{t("admin.articles.tocHint")}</p>
          <div className="max-h-80 space-y-2 overflow-auto">
            {tocRows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={r.level}
                  onChange={(e) =>
                    setTocRows((rows) =>
                      rows.map((x, j) =>
                        j === i ? { ...x, level: Number(e.target.value) } : x,
                      ),
                    )
                  }
                  className="w-20"
                  aria-label="level"
                >
                  {[1, 2, 3].map((l) => (
                    <option key={l} value={l}>
                      H{l}
                    </option>
                  ))}
                </Select>
                <Input
                  value={r.title}
                  onChange={(e) =>
                    setTocRows((rows) =>
                      rows.map((x, j) =>
                        j === i ? { ...x, title: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder={t("admin.articles.tocTitle")}
                  className="flex-1"
                />
                <Input
                  value={r.page}
                  onChange={(e) =>
                    setTocRows((rows) =>
                      rows.map((x, j) =>
                        j === i ? { ...x, page: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder={t("common.page")}
                  inputMode="numeric"
                  className="w-20"
                />
                <button
                  type="button"
                  className="text-muted hover:text-red-500"
                  onClick={() =>
                    setTocRows((rows) => rows.filter((_, j) => j !== i))
                  }
                  aria-label={t("common.delete")}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              setTocRows((rows) => [...rows, { level: 1, title: "", page: "" }])
            }
          >
            + {t("admin.articles.tocAddRow")}
          </Button>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setTocFor(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={!!tocFor && busyId === tocFor.id}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
