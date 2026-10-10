"use client";

/**
 * Admin: kitob sahifasi. Kitob = metama'lumot + muqova + maqolalar (har birida o'z PDF fayli).
 * Ko'rinish: hero (muqova, nom, holat, tez amallar) + tablar: Ma'lumotlar / Maqolalar / Ruxsatlar.
 * Nashr sanasi — `book_metadata.published_at` (YYYY-MM-DD, qo'lbola DatePicker).
 * Maqolalarni boshqarish (yaratish, fayl yuklash, TOC) — `ArticlesPanel` (7.7).
 */
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert, Badge, Button, Card, DatePicker, Field, Input, Select, Spinner, Switch, Textarea, buttonClass, cn, formatDate, statusTone, useConfirm } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { PriceTag } from "@/components/catalog/price";
import { PriceFields } from "./price-fields";
import { isFreeBook } from "@/lib/free-books";
import { BookCover } from "@/components/book-cover";
import { adminApi, errorMessage, type Article, type BookAccess, type BookStatus, type Category } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { env } from "@/lib/env";
import { formatMb, validateCover } from "@/lib/uploads";
import { GrantModal } from "./user-detail";
import { ArticlesPanel } from "./articles-panel";
import { useAdminCrumb } from "./admin-shell";
import { useEntityNames } from "@/lib/admin-names";
import { useT } from "@/i18n";

type Tab = "info" | "articles" | "access";

export function AdminBookDetail({ bookId }: { bookId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
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
  const names = useEntityNames(access.filter((a) => !a.user_full_name && !a.user_email).map((a) => a.user_id));
  useAdminCrumb(book?.title);

  // 87: savollar sahifasidan qaytilganda — "Maqolalar" tabi (`?tab=articles`; client navigatsiyada ham)
  const search = useSearchParams();
  const [tab, setTab] = useState<Tab>(search.get("tab") === "articles" ? "articles" : "info");
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [upload, setUpload] = useState<{ label: string; loaded: number; total: number } | null>(null);
  const [coverKey, setCoverKey] = useState(0); // muqova almashgach qayta yuklash
  const error = actionError ?? loadError;

  // Forma: foydalanuvchi tahrirlari serverdagi qiymatlar ustiga qo'yiladi
  const [edits, setEdits] = useState<Partial<{ title: string; author: string; description: string; category_id: string; price: string; original_price: string; published_at: string; is_free: boolean; watermark_enabled: boolean }>>({});
  const meta = (book?.book_metadata ?? {}) as Record<string, unknown>;
  const form = {
    title: edits.title ?? book?.title ?? "",
    author: edits.author ?? book?.author ?? "",
    description: edits.description ?? book?.description ?? "",
    category_id: edits.category_id ?? book?.category_id ?? book?.category?.id ?? "",
    price: edits.price ?? (book?.price && Number(book.price) > 0 ? String(Number(book.price)) : ""),
    // 81: asl narx (chegirmagacha) — bo'sh: chegirma yo'q
    original_price: edits.original_price ?? (book?.original_price && Number(book.original_price) > 0 ? String(Number(book.original_price)) : ""),
    // 37: tekin kitob (is_free yoki narx 0)
    is_free: edits.is_free ?? isFreeBook(book),
    // 65: kitob bo'yicha himoya kodi (yo'q bo'lsa — yoqiq)
    watermark_enabled: edits.watermark_enabled ?? book?.watermark_enabled !== false,
    published_at: edits.published_at ?? (typeof meta.published_at === "string" ? meta.published_at.slice(0, 10) : ""),
  };
  const setForm = (next: typeof form) => setEdits(next);
  const dirty = Object.keys(edits).length > 0;
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
    setCoverKey((k) => k + 1);
  }

  function saveMeta(e: FormEvent) {
    e.preventDefault();
    const nextMeta: Record<string, unknown> = { ...meta };
    if (form.published_at) nextMeta.published_at = form.published_at;
    else delete nextMeta.published_at;
    if (!form.is_free && !(Number(form.price) > 0)) {
      setActionError(t("admin.books.priceRequired"));
      return;
    }
    if (!form.is_free && form.original_price.trim() && !(Number(form.original_price) > Number(form.price))) {
      setActionError(t("admin.books.originalTooLow"));
      return;
    }
    // 81: chegirmani olib tashlash — `0` (backend null qiladi); o'zgarmagan bo'lsa yuborilmaydi
    const hadOriginal = Number(book?.original_price) > 0;
    const originalOut = !form.is_free && form.original_price.trim() ? form.original_price.trim() : hadOriginal ? 0 : undefined;
    void run(t("admin.books.saved"), () =>
      adminApi.updateBook(bookId, {
        title: form.title.trim(),
        author: form.author.trim() || null,
        description: form.description.trim() || null,
        category_id: form.category_id || null,
        price: form.is_free ? 0 : form.price.trim(),
        ...(originalOut !== undefined ? { original_price: originalOut } : {}),
        is_free: form.is_free,
        watermark_enabled: form.is_free ? false : form.watermark_enabled,
        book_metadata: nextMeta,
      }),
    );
  }

  async function toggleStatus(next: BookStatus) {
    if (next === "INACTIVE") {
      const ok = await confirm({ title: t("common.deactivate"), message: t("admin.books.statusNote"), confirmLabel: t("common.deactivate"), tone: "danger" });
      if (!ok) return;
    }
    await run(t("admin.books.statusSet", { s: next }), () => adminApi.updateBook(bookId, { status: next }));
  }

  if (!book) return error ? <Alert>{error}</Alert> : <Spinner />;

  const status: BookStatus = book.status;
  const readyArticles = articles.filter((a) => a.processing_status === "READY").length;
  const activeAccess = access.filter((a) => a.status === "ACTIVE").length;
  const canActivate = readyArticles > 0;

  const tabs: Array<{ id: Tab; label: string; count?: number; icon: React.ReactNode }> = [
    { id: "info", label: t("admin.books.info"), icon: <I.FileText size={15} /> },
    { id: "articles", label: t("admin.articles.title"), count: articles.length, icon: <I.Layers size={15} /> },
    { id: "access", label: t("nav.admin.access"), count: activeAccess, icon: <I.Key size={15} /> },
  ];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="book-hero" data-testid="book-hero">
        <div className="relative">
          <BookCover key={coverKey} bookId={bookId} title={book.title} hasCover={book.has_cover} size="medium" source="auto" />
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
          <Button variant="secondary" size="sm" className="mt-3 w-full" loading={busy && !!upload} onClick={() => coverRef.current?.click()} icon={<I.Image size={15} />} data-testid="upload-cover">
            {book.has_cover ? t("admin.books.replaceCover") : t("admin.books.uploadCover")}
          </Button>
          {upload && (
            <div className="mt-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((upload.loaded / upload.total) * 100)}>
              <div className="mb-1 flex justify-between text-[11px] font-semibold text-muted">
                <span className="truncate">{upload.label}</span>
                <span className="shrink-0">{upload.loaded >= upload.total ? t("admin.books.serverProcessing") : `${Math.round((upload.loaded / upload.total) * 100)}% · ${formatMb(upload.loaded)} / ${formatMb(upload.total)}`}</span>
              </div>
              <div className="progress thin">
                <i style={{ width: `${Math.min(100, (upload.loaded / upload.total) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(status)} dot>
              {status}
            </Badge>
            {book.category?.name && <Badge>{book.category.name}</Badge>}
            <span className="text-xs font-semibold text-muted">
              {t("common.updated")}: {formatDate(book.updated_at ?? book.created_at)}
            </span>
          </div>
          <div>
            <h1 className="book-hero-title">{book.title}</h1>
            {book.author && <p className="mt-1 text-[15px] font-semibold text-muted">{book.author}</p>}
          </div>
          {book.description && <p className="max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-text-2">{book.description}</p>}
          <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="flex items-center gap-2 font-semibold">
              <I.Wallet size={16} className="text-muted" />
              {isFreeBook(book) ? <Badge tone="success">{t("catalog.free")}</Badge> : <PriceTag item={book} />}
            </span>
            <span className="flex items-center gap-2 font-semibold text-text-2">
              <I.Layers size={16} className="text-muted" />
              {t("admin.articles.title")}: {readyArticles}/{articles.length} READY
            </span>
            <span className="flex items-center gap-2 font-semibold text-text-2">
              <I.Users size={16} className="text-muted" />
              {t("admin.books.grantedTo", { n: activeAccess })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Switch
              checked={status === "ACTIVE"}
              disabled={busy || (status !== "ACTIVE" && !canActivate)}
              label={status === "ACTIVE" ? t("common.deactivate") : t("common.activate")}
              description={status !== "ACTIVE" && !canActivate ? t("admin.books.uploadFirst") : t("admin.books.statusNote")}
              onChange={(on) => void toggleStatus(on ? "ACTIVE" : "INACTIVE")}
              data-testid="book-status-switch"
            />
            <span className="ml-auto flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setGrantOpen(true)} icon={<I.Plus size={15} />}>
                {t("admin.grant")}
              </Button>
              <Link href="/admin/books" className={buttonClass("ghost", "sm")}>
                <I.ArrowLeft size={15} />
                {t("admin.backToList")}
              </Link>
            </span>
          </div>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {/* Tablar */}
      <div className="tabs" role="tablist">
        {tabs.map((tb) => (
          <button key={tb.id} type="button" role="tab" aria-selected={tab === tb.id} className={cn("tab", tab === tb.id && "active")} onClick={() => setTab(tb.id)} data-testid={`tab-${tb.id}`}>
            {tb.icon}
            {tb.count !== undefined ? `${tb.label} (${tb.count})` : tb.label}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <Card title={t("admin.books.info")} actions={dirty && <Badge tone="warning">{t("common.edit")}</Badge>}>
          <form onSubmit={saveMeta} className="grid gap-4 md:grid-cols-2">
            <Field label={t("admin.books.name")} className="md:col-span-2">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </Field>
            <Field label={t("admin.books.author")}>
              <Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
            </Field>
            <Field label={t("admin.books.category")}>
              <Select
                value={form.category_id}
                onChange={(v) => setForm({ ...form, category_id: v })}
                options={[{ value: "", label: t("admin.books.noCategory") }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                aria-label={t("admin.books.category")}
                data-testid="book-category"
              />
            </Field>
            <div className="md:col-span-2">
              <Switch checked={form.is_free} onChange={(v) => setForm({ ...form, is_free: v })} label={t("admin.books.free")} description={t("admin.books.freeHint")} data-testid="book-free" />
            </div>
            {!form.is_free && (
              <div className="md:col-span-2">
                <PriceFields price={form.price} original={form.original_price} onPrice={(v) => setForm({ ...form, price: v })} onOriginal={(v) => setForm({ ...form, original_price: v })} />
              </div>
            )}
            {/* 65: himoya kodi (suv belgisi) — kitob bo'yicha; tekin kitobda doim o'chiq */}
            <Switch
              checked={!form.is_free && form.watermark_enabled}
              disabled={form.is_free}
              onChange={(v) => setForm({ ...form, watermark_enabled: v })}
              label={t("admin.books.watermark")}
              description={form.is_free ? t("admin.articles.watermarkFree") : t("admin.books.watermarkHint")}
              data-testid="book-watermark"
            />
            <Field label={t("admin.books.publishedAt")} hint={t("admin.books.publishedAtHint")}>
              <DatePicker value={form.published_at} onChange={(v) => setForm({ ...form, published_at: v })} max={new Date().toISOString().slice(0, 10)} aria-label={t("admin.books.publishedAt")} data-testid="published-at" />
            </Field>
            <Field label={t("admin.books.summary")} className="md:col-span-2">
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <p className="text-xs text-muted md:col-span-2">{t("admin.books.coverLimit", { cover: env.maxCoverMb })}</p>
            <div className="flex justify-end gap-2 md:col-span-2">
              {dirty && (
                <Button type="button" variant="ghost" onClick={() => setEdits({})}>
                  {t("common.cancel")}
                </Button>
              )}
              <Button type="submit" loading={busy} disabled={!dirty} icon={<I.Check size={16} />}>
                {t("common.save")}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tab === "articles" && (
        <Card title={`${t("admin.articles.title")} (${articles.length})`} padded={false}>
          <div className="p-5">
            <ArticlesPanel bookId={bookId} articles={articles} onChanged={load} bookFree={isFreeBook(book)} bookWatermark={book?.watermark_enabled !== false} />
          </div>
        </Card>
      )}

      {tab === "access" && (
        <Card
          title={t("admin.books.grantedTo", { n: activeAccess })}
          actions={
            <Button size="sm" onClick={() => setGrantOpen(true)} icon={<I.Plus size={15} />}>
              {t("admin.grant")}
            </Button>
          }
          padded={false}
        >
          {access.length === 0 ? (
            <p className="p-5 text-sm text-muted">{t("admin.books.noneGranted")}</p>
          ) : (
            <div className="table-wrap">
              <div className="table-scroll">
                <table className="table" style={{ minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th>{t("common.user")}</th>
                      <th>{t("common.status")}</th>
                      <th>{t("admin.granted")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {access.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <Link href={`/admin/users/${a.user_id}`} className="name hover:text-accent-ink">
                            {a.user_full_name || a.user_email || names.users[a.user_id] || a.user_id.slice(0, 8)}
                          </Link>
                        </td>
                        <td>
                          <Badge tone={statusTone(a.status)} dot>
                            {a.status}
                          </Badge>
                        </td>
                        <td className="muted">{formatDate(a.granted_at)}</td>
                        <td className="text-right">
                          {a.status === "ACTIVE" && (
                            <Button size="sm" variant="danger-ghost" loading={busy} onClick={() => run(t("admin.books.accessRevoked"), () => adminApi.revokeAccess(a.id))}>
                              {t("common.revoke")}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

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
