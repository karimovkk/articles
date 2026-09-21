"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, Toolbar, usePaged, type Column } from "@/components/admin/data-table";
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, SearchInput, Select, Textarea, formatDate, statusTone } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { adminApi, errorMessage, type Book, type BookStatus, type Category } from "@/lib/api";
import { Price } from "@/components/catalog/price";
import { useDebounced } from "@/lib/use-debounce";
import { useT } from "@/i18n";

export default function AdminBooksPage() {
  const { t } = useT();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, flush] = useDebounced(search.trim(), 300); // jonli qidiruv
  const [status, setStatus] = useState<BookStatus | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const { data, loading, error, setPage } = usePaged<Book>(
    (page) => adminApi.books({ page, search: query || undefined, status: status || undefined }),
    [query, status],
  );

  useEffect(() => {
    adminApi
      .categories()
      .then((r) => setCategories(r.items))
      .catch(() => undefined);
  }, []);

  const columns: Column<Book>[] = [
    {
      key: "title",
      header: t("admin.book"),
      render: (b) => (
        <div className="row-name">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-muted">
            <I.Book size={16} />
          </span>
          <span className="min-w-0">
            <Link href={`/admin/books/${b.id}`} className="name block hover:text-accent-ink">
              {b.title}
            </Link>
            {b.author && <span className="sub block">{b.author}</span>}
          </span>
        </div>
      ),
    },
    { key: "category", header: t("admin.books.category"), render: (b) => <span className="muted">{b.category?.name ?? categories.find((c) => c.id === b.category_id)?.name ?? "—"}</span> },
    {
      key: "status",
      header: t("common.status"),
      render: (b) => (
        <Badge tone={statusTone(b.status)} dot>
          {b.status ?? "—"}
        </Badge>
      ),
    },
    { key: "price", header: t("admin.books.price"), num: true, render: (b) => <Price value={b.price} /> },
    { key: "cover", header: t("admin.books.cover"), render: (b) => (b.has_cover ? <Badge tone="success">✓</Badge> : <span className="muted">{t("common.none")}</span>) },
    { key: "created", header: t("common.created"), render: (b) => <span className="muted">{formatDate(b.created_at)}</span> },
  ];

  const statusOptions = [
    { value: "", label: t("admin.allStatuses") },
    { value: "ACTIVE", label: "ACTIVE" },
    { value: "INACTIVE", label: "INACTIVE" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={t("admin.nav.content")}
        title={t("admin.books.title")}
        icon={<I.Book size={26} />}
        actions={
          <Button onClick={() => setCreateOpen(true)} icon={<I.Plus size={16} />} data-testid="new-book">
            {t("admin.books.new")}
          </Button>
        }
      />
      <Toolbar onSubmit={flush} meta={data ? `${t("common.total")}: ${data.total}` : undefined} busy={loading && !!data}>
        <SearchInput placeholder={t("admin.books.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full max-w-xs" aria-label={t("common.search")} />
        <Select value={status} onChange={(v) => setStatus(v as BookStatus | "")} options={statusOptions} className="w-44" aria-label={t("common.status")} data-testid="filter-status" />
      </Toolbar>
      <DataTable data={data} columns={columns} loading={loading} error={error} onPage={setPage} onRowClick={(b) => router.push(`/admin/books/${b.id}`)} minWidth={760} />

      <CreateBookModal open={createOpen} onClose={() => setCreateOpen(false)} categories={categories} onCreated={(b) => router.push(`/admin/books/${b.id}`)} />
    </div>
  );
}

function CreateBookModal({ open, onClose, categories, onCreated }: { open: boolean; onClose: () => void; categories: Category[]; onCreated: (b: Book) => void }) {
  const { t } = useT();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const b = await adminApi.createBook({
        title: title.trim(),
        author: author.trim() || null,
        description: description.trim() || null,
        category_id: categoryId || null,
        price: price.trim() || 0,
      });
      onCreated(b);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("admin.books.newTitle")} icon={<I.Book size={18} />}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label={t("admin.books.name")}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <Field label={t("admin.books.author")}>
          <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </Field>
        <Field label={t("admin.books.category")}>
          <Select value={categoryId} onChange={setCategoryId} options={[{ value: "", label: t("admin.books.noCategory") }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} aria-label={t("admin.books.category")} data-testid="book-category" />
        </Field>
        <Field label={t("admin.books.price")}>
          <Input type="number" min={0} step="1000" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
        </Field>
        <Field label={t("admin.books.summary")}>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <p className="text-xs text-muted">{t("admin.books.uploadLater")}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={busy}>
            {t("admin.books.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
