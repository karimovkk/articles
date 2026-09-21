"use client";

/**
 * Kitob maqolalari (admin): yaratish, nomini/tartibini o'zgartirish, o'chirish, PDF yuklash (progress),
 * qo'lda mundarija (FE-6.10, `PUT .../toc`). PROCESSING holatida ro'yxat avtomatik yangilanadi.
 * Amallar — qatorda asosiy tugma (PDF) + qo'lbola menyu (mundarija, tahrirlash, o'chirish).
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Badge, Button, Field, IconButton, Input, Menu, MenuItem, MenuSep, Modal, Select, statusTone, useConfirm } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { adminApi, errorMessage, type Article } from "@/lib/api";
import { formatMb, validatePdf } from "@/lib/uploads";
import { env } from "@/lib/env";
import { useT } from "@/i18n";

interface TocRow {
  level: number;
  title: string;
  page: string;
}

const LEVELS = [1, 2, 3].map((l) => ({ value: String(l), label: `H${l}` }));

export function ArticlesPanel({ bookId, articles, onChanged }: { bookId: string; articles: Article[]; onChanged: () => void }) {
  const { t } = useT();
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [renaming, setRenaming] = useState<Article | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [tocFor, setTocFor] = useState<Article | null>(null);
  const [tocRows, setTocRows] = useState<TocRow[]>([]);
  const [upload, setUpload] = useState<{ id: string; loaded: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<string | null>(null);

  const sorted = articles.slice().sort((a, b) => a.order_index - b.order_index);
  const processing = sorted.some((a) => a.processing_status === "PROCESSING" || a.processing_status === "UPLOADING");
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
      await adminApi.createArticle(bookId, { title: newTitle.trim(), order_index: sorted.length });
      setNewTitle("");
    });
  }

  function move(a: Article, dir: -1 | 1) {
    const i = sorted.findIndex((x) => x.id === a.id);
    const other = sorted[i + dir];
    if (!other) return;
    void run(a.id, () =>
      Promise.all([
        adminApi.updateArticle(bookId, a.id, { order_index: other.order_index }),
        adminApi.updateArticle(bookId, other.id, { order_index: a.order_index }),
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

  async function remove(a: Article) {
    const ok = await confirm({ title: t("common.delete"), message: t("admin.articles.deleteConfirm", { title: a.title }), confirmLabel: t("common.delete"), tone: "danger" });
    if (ok) void run(a.id, () => adminApi.deleteArticle(bookId, a.id));
  }

  function openToc(a: Article) {
    const existing = (a.article_metadata?.toc as Array<{ level?: number; title: string; page?: number | null }> | undefined) ?? [];
    setTocRows(existing.length ? existing.map((e) => ({ level: e.level ?? 1, title: e.title, page: e.page == null ? "" : String(e.page) })) : [{ level: 1, title: "", page: "" }]);
    setTocFor(a);
  }
  function saveToc(e: FormEvent) {
    e.preventDefault();
    if (!tocFor) return;
    const entries = tocRows.filter((r) => r.title.trim()).map((r) => ({ level: r.level, title: r.title.trim(), page: r.page.trim() === "" ? null : Number(r.page) }));
    void run(tocFor.id, async () => {
      await adminApi.setArticleToc(bookId, tocFor.id, entries);
      setTocFor(null);
    });
  }

  return (
    <div className="space-y-4">
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

      {/* Yangi maqola */}
      <form onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-[16px] bg-surface-2 p-3">
        <Field label={t("admin.articles.newTitle")} className="min-w-[260px] flex-1">
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t("admin.articles.newPlaceholder")} data-testid="new-article-title" />
        </Field>
        <Button type="submit" loading={busyId === "new"} disabled={!newTitle.trim()} icon={<I.Plus size={16} />}>
          {t("admin.articles.add")}
        </Button>
        <p className="w-full text-xs text-muted">{t("admin.articles.hint", { pdf: env.maxPdfMb })}</p>
      </form>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted">{t("admin.articles.empty")}</p>
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="table" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th className="w-24">#</th>
                  <th>{t("admin.books.name")}</th>
                  <th>{t("common.status")}</th>
                  <th className="text-right">{t("admin.books.pages")}</th>
                  <th>{t("admin.books.file")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((a, i) => (
                  <tr key={a.id} data-article={a.id}>
                    <td>
                      <span className="inline-flex items-center gap-1">
                        <span className="track-num">{i + 1}</span>
                        <span className="flex flex-col">
                          <button type="button" className="grid size-5 place-items-center rounded text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30" disabled={i === 0 || !!busyId} onClick={() => move(a, -1)} title={t("admin.articles.up")} aria-label={t("admin.articles.up")}>
                            <I.ChevronUp size={13} />
                          </button>
                          <button type="button" className="grid size-5 place-items-center rounded text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30" disabled={i === sorted.length - 1 || !!busyId} onClick={() => move(a, 1)} title={t("admin.articles.down")} aria-label={t("admin.articles.down")}>
                            <I.ChevronDown size={13} />
                          </button>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="name block max-w-[320px] truncate" title={a.title}>
                        {a.title}
                      </span>
                      {a.processing_error && <span className="block text-xs text-danger">{a.processing_error}</span>}
                    </td>
                    <td>
                      <Badge tone={statusTone(a.processing_status)} dot>
                        {a.processing_status}
                      </Badge>
                    </td>
                    <td className="num text-right">{a.page_count ?? "—"}</td>
                    <td className="muted text-xs">
                      {a.has_source_file ? `${t("admin.books.pdfYes")}${a.file_size ? ` · ${formatMb(a.file_size)}` : ""}${a.file_version > 1 ? ` · v${a.file_version}` : ""}` : t("common.none")}
                      {upload?.id === a.id && (
                        <div className="mt-1 w-40" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((upload.loaded / upload.total) * 100)}>
                          <div className="progress thin">
                            <i style={{ width: `${Math.min(100, (upload.loaded / upload.total) * 100)}%` }} />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busyId === a.id}
                          icon={<I.Upload size={14} />}
                          onClick={() => {
                            uploadTarget.current = a.id;
                            fileRef.current?.click();
                          }}
                        >
                          {a.has_source_file ? t("admin.books.replacePdf") : t("admin.books.uploadPdf")}
                        </Button>
                        <Menu
                          align="end"
                          aria-label={t("ui.menu.open")}
                          trigger={(p) => (
                            <IconButton {...p} size="sm" variant="plain" label={t("ui.menu.open")} data-testid="article-menu">
                              <I.MoreHorizontal size={16} />
                            </IconButton>
                          )}
                        >
                          <MenuItem icon={<I.List size={15} />} onSelect={() => openToc(a)}>
                            {t("admin.articles.toc")}
                          </MenuItem>
                          <MenuItem
                            icon={<I.Pencil size={15} />}
                            onSelect={() => {
                              setRenaming(a);
                              setRenameTitle(a.title);
                            }}
                          >
                            {t("common.edit")}
                          </MenuItem>
                          <MenuSep />
                          <MenuItem tone="danger" icon={<I.Trash size={15} />} onSelect={() => void remove(a)}>
                            {t("common.delete")}
                          </MenuItem>
                        </Menu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!renaming} onClose={() => setRenaming(null)} title={t("admin.articles.rename")} size="sm" icon={<I.Pencil size={18} />}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!renaming) return;
            void run(renaming.id, async () => {
              await adminApi.updateArticle(bookId, renaming.id, { title: renameTitle.trim() });
              setRenaming(null);
            });
          }}
          className="space-y-4"
        >
          <Field label={t("admin.books.name")}>
            <Input value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={!!renaming && busyId === renaming.id}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!tocFor} onClose={() => setTocFor(null)} title={`${t("admin.articles.toc")}: ${tocFor?.title ?? ""}`} size="lg" icon={<I.List size={18} />}>
        <form onSubmit={saveToc} className="space-y-4">
          <p className="text-xs text-muted">{t("admin.articles.tocHint")}</p>
          <div className="max-h-80 space-y-2 overflow-auto p-0.5">
            {tocRows.map((r, i) => (
              <div key={i} className="flex items-center gap-2" data-testid="toc-row">
                <Select value={String(r.level)} onChange={(v) => setTocRows((rows) => rows.map((x, j) => (j === i ? { ...x, level: Number(v) } : x)))} options={LEVELS} className="w-24 shrink-0" aria-label="level" matchWidth={false} />
                <Input value={r.title} onChange={(e) => setTocRows((rows) => rows.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder={t("admin.articles.tocTitle")} className="flex-1" />
                <Input value={r.page} onChange={(e) => setTocRows((rows) => rows.map((x, j) => (j === i ? { ...x, page: e.target.value } : x)))} placeholder={t("common.page")} inputMode="numeric" className="w-20 shrink-0" />
                <IconButton size="sm" variant="plain" label={t("common.delete")} onClick={() => setTocRows((rows) => rows.filter((_, j) => j !== i))}>
                  <I.X size={15} />
                </IconButton>
              </div>
            ))}
          </div>
          <Button type="button" size="sm" variant="secondary" icon={<I.Plus size={14} />} onClick={() => setTocRows((rows) => [...rows, { level: 1, title: "", page: "" }])}>
            {t("admin.articles.tocAddRow")}
          </Button>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setTocFor(null)}>
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
