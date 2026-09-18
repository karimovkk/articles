"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Spinner, Textarea, formatDate, statusTone } from "@/components/ui";
import { adminApi, errorMessage, type BookAccess, type Category } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { GrantModal } from "./user-detail";

const STATUS_OPTIONS = ["DRAFT", "ACTIVE", "INACTIVE"];

export function AdminBookDetail({ bookId }: { bookId: string }) {
  const { data, error: loadError, reload: load } = useAsync(
    async () => {
      const [book, categories, access] = await Promise.all([
        adminApi.book(bookId),
        adminApi.categories().catch(() => [] as Category[]),
        adminApi.access({ book_id: bookId, page_size: 100 }).then((r) => r.items).catch(() => [] as BookAccess[]),
      ]);
      return { book, categories, access };
    },
    [bookId],
  );
  const book = data?.book ?? null;
  const categories = data?.categories ?? [];
  const access = data?.access ?? [];

  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const error = actionError ?? loadError;

  // Forma: foydalanuvchi tahrirlari serverdagi qiymatlar ustiga qo'yiladi
  const [edits, setEdits] = useState<Partial<{ title: string; author: string; description: string; category_id: string }>>({});
  const form = {
    title: edits.title ?? book?.title ?? "",
    author: edits.author ?? book?.author ?? "",
    description: edits.description ?? book?.description ?? book?.summary ?? "",
    category_id: edits.category_id ?? book?.category_id ?? book?.category?.id ?? "",
  };
  const setForm = (next: typeof form) => setEdits(next);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  // PROCESSING holatida avtomatik yangilash
  const bookStatus = (book?.status ?? "").toUpperCase();
  useEffect(() => {
    if (!["PROCESSING", "UPLOADING"].includes(bookStatus)) return;
    const t = window.setInterval(load, 3000);
    return () => window.clearInterval(t);
  }, [bookStatus, load]);

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

  function saveMeta(e: FormEvent) {
    e.preventDefault();
    void run("Saqlandi", () =>
      adminApi.updateBook(bookId, {
        title: form.title.trim(),
        author: form.author.trim() || null,
        description: form.description.trim() || null,
        category_id: form.category_id || null,
      }),
    );
  }

  if (!book) return error ? <Alert>{error}</Alert> : <Spinner />;

  const status = (book.status ?? "").toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title={book.title}
        description={book.author ?? undefined}
        actions={
          <>
            <Badge tone={statusTone(status)}>{status || "—"}</Badge>
            <Link href="/admin/books" className="text-sm text-accent hover:underline">
              ← Ro&apos;yxat
            </Link>
          </>
        }
      />
      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold text-text">Ma&apos;lumotlar</h2>
          <form onSubmit={saveMeta} className="space-y-3">
            <Field label="Nomi">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </Field>
            <Field label="Muallif">
              <Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
            </Field>
            <Field label="Kategoriya">
              <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">— yo&apos;q —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Qisqacha mazmun">
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Button type="submit" loading={busy}>
              Saqlash
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-1 text-base font-semibold text-text">Fayl va muqova</h2>
            <p className="mb-3 text-xs text-muted">
              PDF yuklangach backend uni qayta ishlaydi (PROCESSING → READY): sahifa soni, mundarija, matn qatlami.
            </p>
            <dl className="mb-4 grid grid-cols-3 gap-y-1 text-sm">
              <dt className="text-muted">PDF</dt>
              <dd className="col-span-2 text-text">{book.has_source_file ? "✓ yuklangan" : "yo'q"}</dd>
              <dt className="text-muted">Sahifalar</dt>
              <dd className="col-span-2 text-text">{book.page_count ?? "—"}</dd>
              <dt className="text-muted">Matn qatlami</dt>
              <dd className="col-span-2 text-text">{book.text_available === undefined ? "—" : book.text_available ? "bor" : "yo'q (qidiruv ishlamaydi)"}</dd>
              <dt className="text-muted">Muqova</dt>
              <dd className="col-span-2 text-text">{book.has_cover ? "✓" : "yo'q"}</dd>
              <dt className="text-muted">Yangilangan</dt>
              <dd className="col-span-2 text-text">{formatDate(book.updated_at ?? book.created_at)}</dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void run("PDF yuklandi, qayta ishlanmoqda…", () => adminApi.uploadBookFile(bookId, f));
                  e.target.value = "";
                }}
              />
              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void run("Muqova yuklandi", () => adminApi.uploadCover(bookId, f));
                  e.target.value = "";
                }}
              />
              <Button variant="secondary" loading={busy} onClick={() => fileRef.current?.click()}>
                {book.has_source_file ? "PDF ni almashtirish" : "PDF yuklash"}
              </Button>
              <Button variant="secondary" loading={busy} onClick={() => coverRef.current?.click()}>
                {book.has_cover ? "Muqovani almashtirish" : "Muqova yuklash"}
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 text-base font-semibold text-text">Holat</h2>
            <p className="mb-3 text-xs text-muted">Faqat ACTIVE kitoblar foydalanuvchilarga ko&apos;rinadi va o&apos;qiladi.</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.filter((s) => s !== status).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === "ACTIVE" ? "primary" : "secondary"}
                  loading={busy}
                  disabled={s === "ACTIVE" && !book.has_source_file}
                  title={s === "ACTIVE" && !book.has_source_file ? "Avval PDF yuklang" : undefined}
                  onClick={() => run(`Holat: ${s}`, () => adminApi.updateBook(bookId, { status: s }))}
                >
                  {s === "ACTIVE" ? "Faollashtirish" : s === "INACTIVE" ? "Nofaol qilish" : "Qoralama"}
                </Button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">Kimga ruxsat berilgan ({access.filter((a) => (a.status ?? "ACTIVE").toUpperCase() === "ACTIVE").length})</h2>
          <Button size="sm" onClick={() => setGrantOpen(true)}>
            + Ruxsat berish
          </Button>
        </div>
        {access.length === 0 ? (
          <p className="text-sm text-muted">Hali hech kimga berilmagan</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-1">Foydalanuvchi</th>
                <th className="py-1">Holat</th>
                <th className="py-1">Berilgan</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {access.map((a) => (
                <tr key={a.id}>
                  <td className="py-2">
                    <Link href={`/admin/users/${a.user_id}`} className="text-accent hover:underline">
                      {a.user?.full_name || a.user?.email || a.user?.phone || a.user_id}
                    </Link>
                  </td>
                  <td className="py-2">
                    <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                  </td>
                  <td className="py-2 text-muted">{formatDate(a.granted_at)}</td>
                  <td className="py-2 text-right">
                    {(a.status ?? "ACTIVE").toUpperCase() === "ACTIVE" && (
                      <Button size="sm" variant="danger" loading={busy} onClick={() => run("Ruxsat bekor qilindi", () => adminApi.revokeAccess(a.id))}>
                        Bekor qilish
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
