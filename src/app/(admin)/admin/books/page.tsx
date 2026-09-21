"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, usePaged, type Column } from "@/components/admin/data-table";
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, Select, Textarea, formatDate, statusTone } from "@/components/ui";
import { adminApi, errorMessage, type Book, type BookStatus, type Category } from "@/lib/api";
import { Price } from "@/components/catalog/price";
import { useT } from "@/i18n";

export default function AdminBooksPage() {
  const { t } = useT();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
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
        <div>
          <Link href={`/admin/books/${b.id}`} className="font-medium text-accent hover:underline">
            {b.title}
          </Link>
          {b.author && <p className="text-xs text-muted">{b.author}</p>}
        </div>
      ),
    },
    { key: "category", header: t("admin.books.category"), render: (b) => <span className="text-muted">{b.category?.name ?? categories.find((c) => c.id === b.category_id)?.name ?? "—"}</span> },
    { key: "status", header: t("common.status"), render: (b) => <Badge tone={statusTone(b.status)}>{b.status ?? "—"}</Badge> },
    { key: "price", header: t("admin.books.price"), render: (b) => <Price value={b.price} /> },
    { key: "cover", header: t("admin.books.cover"), render: (b) => <span className="text-xs text-muted">{b.has_cover ? "✓" : t("common.none")}</span> },
    { key: "created", header: t("common.created"), render: (b) => <span className="text-muted">{formatDate(b.created_at)}</span> },
  ];

  return (
    <div>
      <PageHeader title={t("admin.books.title")} actions={<Button onClick={() => setCreateOpen(true)}>{t("admin.books.new")}</Button>} />
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
      >
        <Input placeholder={t("admin.books.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={status} onChange={(e) => setStatus(e.target.value as BookStatus | "")} className="w-44">
          <option value="">{t("admin.allStatuses")}</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </Select>
        <Button type="submit" variant="secondary">
          {t("common.search")}
        </Button>
      </form>
      <DataTable data={data} columns={columns} loading={loading} error={error} onPage={setPage} />

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
    <Modal open={open} onClose={onClose} title={t("admin.books.newTitle")}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label={t("admin.books.name")}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <Field label={t("admin.books.author")}>
          <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </Field>
        <Field label={t("admin.books.category")}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{t("admin.books.noCategory")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
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
