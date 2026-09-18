"use client";

import { useState } from "react";
import Link from "next/link";
import { DataTable, usePaged, type Column } from "@/components/admin/data-table";
import { GrantModal } from "@/components/admin/user-detail";
import { Badge, Button, PageHeader, Select, formatDate, statusTone } from "@/components/ui";
import { adminApi, errorMessage, type BookAccess } from "@/lib/api";

export default function AdminAccessPage() {
  const [status, setStatus] = useState("");
  const [grantOpen, setGrantOpen] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const { data, loading, error, setPage, reload } = usePaged<BookAccess>((page) => adminApi.access({ page, status: status || undefined }), [status]);

  async function revoke(a: BookAccess) {
    if (!confirm("Ruxsatni bekor qilasizmi? Foydalanuvchi kitobni darhol o'qiy olmaydi (tarix saqlanadi).")) return;
    setActionErr(null);
    try {
      await adminApi.revokeAccess(a.id);
      await reload();
    } catch (e) {
      setActionErr(errorMessage(e));
    }
  }

  const columns: Column<BookAccess>[] = [
    {
      key: "user",
      header: "Foydalanuvchi",
      render: (a) => (
        <Link href={`/admin/users/${a.user_id}`} className="text-accent hover:underline">
          {a.user?.full_name || a.user?.email || a.user?.phone || a.user_id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: "book",
      header: "Kitob",
      render: (a) => (
        <Link href={`/admin/books/${a.book_id}`} className="text-accent hover:underline">
          {a.book?.title ?? a.book_id.slice(0, 8)}
        </Link>
      ),
    },
    { key: "status", header: "Holat", render: (a) => <Badge tone={statusTone(a.status)}>{a.status}</Badge> },
    { key: "granted", header: "Berilgan", render: (a) => <span className="text-muted">{formatDate(a.granted_at)}</span> },
    { key: "revoked", header: "Bekor qilingan", render: (a) => <span className="text-muted">{formatDate(a.revoked_at)}</span> },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (a) =>
        (a.status ?? "ACTIVE").toUpperCase() === "ACTIVE" ? (
          <Button size="sm" variant="danger" onClick={() => void revoke(a)}>
            Bekor qilish
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Kitoblarga ruxsatlar"
        description="To'lov tashqi tizimda tasdiqlangach ruxsat qo'lda beriladi (TZ §16). Bekor qilish tarixni saqlaydi."
        actions={<Button onClick={() => setGrantOpen(true)}>+ Ruxsat berish</Button>}
      />
      <div className="mb-4 flex gap-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <option value="">Barchasi</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="REVOKED">REVOKED</option>
        </Select>
      </div>
      <DataTable data={data} columns={columns} loading={loading} error={error ?? actionErr} onPage={setPage} />
      <GrantModal
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        onDone={() => {
          setGrantOpen(false);
          void reload();
        }}
      />
    </div>
  );
}
