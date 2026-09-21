"use client";

/**
 * Admin: kitob sahifasi. Kitob = metama'lumot + muqova + maqolalar (har birida o'z PDF fayli).
 * Maqolalarni boshqarish (yaratish, fayl yuklash, TOC) — `ArticlesPanel` (7.7).
 */
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
  formatDate,
  statusTone,
} from "@/components/ui";
import { Price } from "@/components/catalog/price";
import {
  adminApi,
  errorMessage,
  type Article,
  type BookAccess,
  type BookStatus,
  type Category,
} from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { env } from "@/lib/env";
import { formatMb, validateCover } from "@/lib/uploads";
import { GrantModal } from "./user-detail";
import { ArticlesPanel } from "./articles-panel";
import { useEntityNames } from "@/lib/admin-names";
import { useT } from "@/i18n";

export function AdminBookDetail({ bookId }: { bookId: string }) {
  const { t } = useT();
  const {
    data,
    error: loadError,
    reload: load,
  } = useAsync(async () => {
    const [book, categories, articles, access] = await Promise.all([
      adminApi.book(bookId),
      adminApi
        .categories({ page_size: 100 })
        .then((r) => r.items)
        .catch(() => [] as Category[]),
      adminApi.articles(bookId).catch(() => [] as Article[]),
      adminApi
        .access({ book_id: bookId, page_size: 100 })
        .then((r) => r.items)
        .catch(() => [] as BookAccess[]),
    ]);
    return { book, categories, articles, access };
  }, [bookId]);
  const book = data?.book ?? null;
  const categories = data?.categories ?? [];
  const articles = data?.articles ?? [];
  const access = data?.access ?? [];
  const names = useEntityNames(
    access
      .filter((a) => !a.user_full_name && !a.user_email)
      .map((a) => a.user_id),
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [upload, setUpload] = useState<{
    label: string;
    loaded: number;
    total: number;
  } | null>(null);
  const error = actionError ?? loadError;

  // Forma: foydalanuvchi tahrirlari serverdagi qiymatlar ustiga qo'yiladi
  const [edits, setEdits] = useState<
    Partial<{
      title: string;
      author: string;
      description: string;
      category_id: string;
      price: string;
    }>
  >({});
  const form = {
    title: edits.title ?? book?.title ?? "",
    author: edits.author ?? book?.author ?? "",
    description: edits.description ?? book?.description ?? "",
    category_id:
      edits.category_id ?? book?.category_id ?? book?.category?.id ?? "",
    price: edits.price ?? (book?.price ? String(Number(book.price)) : ""),
  };
  const setForm = (next: typeof form) => setEdits(next);
  const coverRef = useRef<HTMLInputElement>(null);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(label);
      setEdits({});
      load();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function uploadCover(file: File) {
    setActionError(null);
    const problem = await validateCover(file);
    if (problem) {
      setActionError(problem);
      return;
    }
    const label = `${t("admin.books.cover")}: ${file.name}`;
    setUpload({ label, loaded: 0, total: file.size });
    await run(t("admin.books.coverUploaded"), () =>
      adminApi.uploadCover(bookId, file, {
        onProgress: (loaded, total) => setUpload({ label, loaded, total }),
      }),
    );
    setUpload(null);
  }

  function saveMeta(e: FormEvent) {
    e.preventDefault();
    void run(t("admin.books.saved"), () =>
      adminApi.updateBook(bookId, {
        title: form.title.trim(),
        author: form.author.trim() || null,
        description: form.description.trim() || null,
        category_id: form.category_id || null,
        price: form.price.trim() === "" ? null : form.price.trim(),
      }),
    );
  }

  if (!book) return error ? <Alert>{error}</Alert> : <Spinner />;

  const status: BookStatus = book.status;
  const nextStatus: BookStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const readyArticles = articles.filter(
    (a) => a.processing_status === "READY",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={book.title}
        description={book.author ?? undefined}
        actions={
          <>
            <Badge tone={statusTone(status)}>{status}</Badge>
            <Link
              href="/admin/books"
              className="text-sm text-accent hover:underline"
            >
              {t("admin.backToList")}
            </Link>
          </>
        }
      />
      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold text-text">
            {t("admin.books.info")}
          </h2>
          <form onSubmit={saveMeta} className="space-y-3">
            <Field label={t("admin.books.name")}>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </Field>
            <Field label={t("admin.books.author")}>
              <Input
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
              />
            </Field>
            <Field label={t("admin.books.category")}>
              <Select
                value={form.category_id}
                onChange={(e) =>
                  setForm({ ...form, category_id: e.target.value })
                }
              >
                <option value="">{t("admin.books.noCategory")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("admin.books.price")}>
              <Input
                type="number"
                min={0}
                step="1000"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
            <Field label={t("admin.books.summary")}>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </Field>
            <Button type="submit" loading={busy}>
              {t("common.save")}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-1 text-base font-semibold text-text">
              {t("admin.books.cover")}
            </h2>
            <p className="mb-3 text-xs text-muted">
              {t("admin.books.coverLimit", { cover: env.maxCoverMb })}
            </p>
            <dl className="mb-4 grid grid-cols-3 gap-y-1 text-sm">
              <dt className="text-muted">{t("admin.books.cover")}</dt>
              <dd className="col-span-2 text-text">
                {book.has_cover ? "✓" : t("common.none")}
              </dd>
              <dt className="text-muted">{t("admin.books.price")}</dt>
              <dd className="col-span-2 text-text">
                <Price value={book.price} />
              </dd>
              <dt className="text-muted">{t("common.updated")}</dt>
              <dd className="col-span-2 text-text">
                {formatDate(book.updated_at ?? book.created_at)}
              </dd>
            </dl>
            <input
              ref={coverRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadCover(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="secondary"
              loading={busy}
              onClick={() => coverRef.current?.click()}
            >
              {book.has_cover
                ? t("admin.books.replaceCover")
                : t("admin.books.uploadCover")}
            </Button>
            {upload && (
              <div
                className="mt-3"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((upload.loaded / upload.total) * 100)}
              >
                <div className="mb-1 flex justify-between text-xs text-muted">
                  <span className="truncate">{upload.label}</span>
                  <span className="shrink-0">
                    {upload.loaded >= upload.total
                      ? t("admin.books.serverProcessing")
                      : `${Math.round((upload.loaded / upload.total) * 100)}% · ${formatMb(upload.loaded)} / ${formatMb(upload.total)}`}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
                  <div
                    className="h-full rounded-full bg-accent transition-[width]"
                    style={{
                      width: `${Math.min(100, (upload.loaded / upload.total) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 text-base font-semibold text-text">
              {t("common.status")}
            </h2>
            <p className="mb-3 text-xs text-muted">
              {t("admin.books.statusNote")}
            </p>
            <Button
              size="sm"
              variant={nextStatus === "ACTIVE" ? "primary" : "secondary"}
              loading={busy}
              disabled={nextStatus === "ACTIVE" && readyArticles === 0}
              title={
                nextStatus === "ACTIVE" && readyArticles === 0
                  ? t("admin.books.uploadFirst")
                  : undefined
              }
              onClick={() =>
                run(t("admin.books.statusSet", { s: nextStatus }), () =>
                  adminApi.updateBook(bookId, { status: nextStatus }),
                )
              }
            >
              {nextStatus === "ACTIVE"
                ? t("common.activate")
                : t("common.deactivate")}
            </Button>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">
            {t("admin.articles.title")} ({articles.length})
          </h2>
        </div>
        <ArticlesPanel bookId={bookId} articles={articles} onChanged={load} />
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">
            {t("admin.books.grantedTo", {
              n: access.filter((a) => a.status === "ACTIVE").length,
            })}
          </h2>
          <Button size="sm" onClick={() => setGrantOpen(true)}>
            {t("admin.grant")}
          </Button>
        </div>
        {access.length === 0 ? (
          <p className="text-sm text-muted">{t("admin.books.noneGranted")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs uppercase text-muted">
                <tr>
                  <th className="py-1">{t("common.user")}</th>
                  <th className="py-1">{t("common.status")}</th>
                  <th className="py-1">{t("admin.granted")}</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {access.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2">
                      <Link
                        href={`/admin/users/${a.user_id}`}
                        className="text-accent hover:underline"
                      >
                        {a.user_full_name ||
                          a.user_email ||
                          names.users[a.user_id] ||
                          a.user_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2">
                      <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                    </td>
                    <td className="py-2 text-muted">
                      {formatDate(a.granted_at)}
                    </td>
                    <td className="py-2 text-right">
                      {a.status === "ACTIVE" && (
                        <Button
                          size="sm"
                          variant="danger"
                          loading={busy}
                          onClick={() =>
                            run(t("admin.books.accessRevoked"), () =>
                              adminApi.revokeAccess(a.id),
                            )
                          }
                        >
                          {t("common.revoke")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <GrantModal
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        bookId={bookId}
        onDone={() => {
          setGrantOpen(false);
          load();
        }}
      />
    </div>
  );
}
