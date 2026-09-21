"use client";

import { useState, type FormEvent } from "react";
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Spinner } from "@/components/ui";
import { adminApi, errorMessage, type Category } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { useT } from "@/i18n";

export default function AdminCategoriesPage() {
  const { t } = useT();
  const { data, error: loadError, reload } = useAsync(() => adminApi.categories({ page_size: 100 }), []);
  const items = data?.items;
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    void run(async () => {
      await adminApi.createCategory({ name: name.trim() });
      setName("");
    });
  }

  return (
    <div>
      <PageHeader title={t("admin.categories.title")} />
      {(error ?? loadError) && (
        <div className="mb-4">
          <Alert>{error ?? loadError}</Alert>
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-5 md:col-span-1">
          <h2 className="mb-3 text-base font-semibold text-text">{t("admin.categories.new")}</h2>
          <form onSubmit={create} className="space-y-3">
            <Field label={t("admin.books.name")} hint={t("admin.categories.nameHint")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Button type="submit" loading={busy}>
              {t("admin.categories.add")}
            </Button>
          </form>
        </Card>

        <Card className="p-5 md:col-span-2">
          {!items ? (
            <Spinner />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted">{t("admin.categories.empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  {editing?.id === c.id ? (
                    <form
                      className="flex flex-1 gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(async () => {
                          await adminApi.updateCategory(c.id, { name: editName.trim() });
                          setEditing(null);
                        });
                      }}
                    >
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                      <Button size="sm" type="submit" loading={busy}>
                        {t("common.save")}
                      </Button>
                      <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(null)}>
                        {t("common.cancel")}
                      </Button>
                    </form>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <span className="text-text">{c.name}</span>
                        {c.slug && <span className="ml-2 font-mono text-xs text-muted">{c.slug}</span>}
                        <span className="ml-2">
                          <Badge tone={c.status === "INACTIVE" ? "warning" : "success"}>{c.status === "INACTIVE" ? t("admin.categories.inactive") : t("admin.categories.active")}</Badge>
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(c);
                            setEditName(c.name);
                          }}
                        >
                          {t("common.edit")}
                        </Button>
                        <Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => adminApi.updateCategory(c.id, { status: c.status === "INACTIVE" ? "ACTIVE" : "INACTIVE" }))}>
                          {c.status === "INACTIVE" ? t("common.activate") : t("admin.categories.disable")}
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
