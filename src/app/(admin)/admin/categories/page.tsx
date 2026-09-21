"use client";

import { useState, type FormEvent } from "react";
import { Alert, Badge, Button, Card, EmptyState, Field, IconButton, Input, PageHeader, Spinner, Switch } from "@/components/ui";
import * as I from "@/components/ui/icons";
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
      <PageHeader eyebrow={t("admin.nav.content")} title={t("admin.categories.title")} icon={<I.Tag size={26} />} />
      {(error ?? loadError) && <Alert className="mb-4">{error ?? loadError}</Alert>}
      <div className="grid gap-5 md:grid-cols-3">
        <Card className="md:col-span-1" title={t("admin.categories.new")}>
          <form onSubmit={create} className="space-y-4">
            <Field label={t("admin.books.name")} hint={t("admin.categories.nameHint")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} required data-testid="category-name" />
            </Field>
            <Button type="submit" loading={busy} icon={<I.Plus size={16} />}>
              {t("admin.categories.add")}
            </Button>
          </form>
        </Card>

        <Card className="md:col-span-2" title={t("admin.categories.title")} actions={items && <Badge>{items.length}</Badge>} padded={false}>
          {!items ? (
            <div className="p-5">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <div className="p-5">
              <EmptyState title={t("admin.categories.empty")} icon={<I.Tag size={22} />} className="border-0" />
            </div>
          ) : (
            <ul className="tracklist" data-testid="category-list">
              {items.map((c) => (
                <li key={c.id} className="track" style={{ gridTemplateColumns: "36px minmax(0,1fr) auto" }}>
                  <span className="track-num">
                    <I.Tag size={14} />
                  </span>
                  {editing?.id === c.id ? (
                    <form
                      className="col-span-2 flex flex-wrap gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(async () => {
                          await adminApi.updateCategory(c.id, { name: editName.trim() });
                          setEditing(null);
                        });
                      }}
                    >
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} inputSize="sm" className="max-w-xs flex-1" autoFocus aria-label={t("admin.books.name")} />
                      <Button size="sm" type="submit" loading={busy}>
                        {t("common.save")}
                      </Button>
                      <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(null)}>
                        {t("common.cancel")}
                      </Button>
                    </form>
                  ) : (
                    <>
                      <span className="min-w-0">
                        <span className="track-title">{c.name}</span>
                        <span className="track-sub flex flex-wrap items-center gap-2">
                          {c.slug && <span className="font-mono">{c.slug}</span>}
                          <Badge tone={c.status === "INACTIVE" ? "warning" : "success"} dot>
                            {c.status === "INACTIVE" ? t("admin.categories.inactive") : t("admin.categories.active")}
                          </Badge>
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Switch
                          checked={c.status !== "INACTIVE"}
                          disabled={busy}
                          aria-label={c.status === "INACTIVE" ? t("common.activate") : t("admin.categories.disable")}
                          onChange={() => run(() => adminApi.updateCategory(c.id, { status: c.status === "INACTIVE" ? "ACTIVE" : "INACTIVE" }))}
                          data-testid={`category-switch-${c.slug ?? c.id}`}
                        />
                        <IconButton
                          size="sm"
                          variant="plain"
                          label={t("common.edit")}
                          onClick={() => {
                            setEditing(c);
                            setEditName(c.name);
                          }}
                        >
                          <I.Pencil size={15} />
                        </IconButton>
                      </span>
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
