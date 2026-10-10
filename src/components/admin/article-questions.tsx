"use client";

/**
 * 87: admin — maqolaning IELTS savollari (alohida sahifa; avvalgi modal o'rniga). Ro'yxat — o'quvchi ko'radigan tartibda,
 * raqamlar ballar bo'yicha (matching elementi / bo'sh joy — alohida raqam); har savolda tur, savol matni, to'g'ri javob
 * qisqacha, ball; tartib (yuqoriga/pastga), nusxa, tahrir, o'chirish. Tahrir/yaratish — `QuestionForm` (o'ng tomonda
 * o'quvchi ko'rinishi). Maqolalar orasida oldingi/keyingi tugmalari.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, EmptyState, IconButton, PageHeader, Spinner, buttonClass, cn, useConfirm } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { adminApi, errorMessage, mechanicOf, quizApi, type AdminQuestion, type Mechanic } from "@/lib/api";
import { answerSummary, chooseCount, splitPage } from "@/lib/quiz/ielts";
import { useAsync } from "@/lib/use-async";
import { useT, type DictKey } from "@/i18n";
import { QuestionForm } from "./question-form";

const MECH_TONE: Record<Mechanic, "accent" | "info" | "success" | "warning"> = { choice: "accent", enum: "info", matching: "success", text: "warning" };

export function ArticleQuestionsPage({ bookId, articleId }: { bookId: string; articleId: string }) {
  const { t } = useT();
  const confirm = useConfirm();
  const { data: book } = useAsync(() => adminApi.book(bookId), [bookId]);
  const { data: articles } = useAsync(() => adminApi.articles(bookId), [bookId]);
  const { data, error: loadError, reload } = useAsync(() => quizApi.adminList(articleId), [articleId]);
  const [editing, setEditing] = useState<AdminQuestion | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger" | "warning"; text: string } | null>(null);

  const list = useMemo(() => [...(data ?? [])].sort((a, b) => a.order_index - b.order_index), [data]);
  const sortedArticles = useMemo(() => [...(articles ?? [])].sort((a, b) => a.order_index - b.order_index), [articles]);
  const article = sortedArticles.find((a) => a.id === articleId);
  const idx = sortedArticles.findIndex((a) => a.id === articleId);
  const prev = idx > 0 ? sortedArticles[idx - 1] : null;
  const next = idx >= 0 && idx < sortedArticles.length - 1 ? sortedArticles[idx + 1] : null;

  // Raqamlar (ballar bo'yicha), jami ball va turlar
  const numbered = useMemo(() => {
    const out: Array<{ q: AdminQuestion; start: number; end: number }> = [];
    let n = 1;
    for (const q of list) {
      const start = n;
      n += Math.max(1, q.points);
      out.push({ q, start, end: n - 1 });
    }
    return out;
  }, [list]);
  const totalPoints = numbered.length ? numbered[numbered.length - 1].end : 0;
  const byMech = list.reduce<Record<string, number>>((m, q) => ({ ...m, [mechanicOf(q.type)]: (m[mechanicOf(q.type)] ?? 0) + 1 }), {});

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setMsg(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setMsg({ tone: "danger", text: errorMessage(e) });
    } finally {
      setBusyId(null);
    }
  }
  // Tartib: yangi tartib bo'yicha order_index 0..n-1 — faqat o'zgarganlari yuboriladi
  const move = (i: number, dir: -1 | 1) =>
    run(list[i].id, async () => {
      const arr = [...list];
      [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]];
      for (let k = 0; k < arr.length; k++) if (arr[k].order_index !== k) await quizApi.adminUpdate(articleId, arr[k].id, { order_index: k });
    });
  const duplicate = (q: AdminQuestion) =>
    run(q.id, async () => {
      const copy = await quizApi.adminCreate(articleId, { type: q.type, prompt: q.prompt, data: q.data, answer: q.answer, explanation: q.explanation, order_index: list.length });
      setMsg({ tone: "success", text: t("ielts.admin.duplicated") });
      return copy;
    });
  const remove = async (q: AdminQuestion) => {
    if (!(await confirm({ title: t("common.delete"), message: t("quiz.admin.deleteConfirm"), confirmLabel: t("common.delete"), tone: "danger" }))) return;
    await run(q.id, () => quizApi.adminDelete(articleId, q.id));
  };

  return (
    <div className="space-y-5" data-testid="questions-page">
      <nav className="crumbs" aria-label="breadcrumb">
        <Link href="/admin/books">{t("nav.admin.books")}</Link>
        <I.ChevronRight size={14} />
        <Link href={`/admin/books/${bookId}?tab=articles`}>{book?.title ?? "…"}</Link>
        <I.ChevronRight size={14} />
        <span className="current">{article?.title ?? "…"}</span>
      </nav>
      <PageHeader
        title={t("ielts.admin.title")}
        description={article ? t("ielts.admin.sub", { title: article.title }) : undefined}
        icon={<I.CheckCircle size={24} />}
        actions={
          <div className="flex flex-wrap gap-2">
            {prev && (
              <Link href={`/admin/books/${bookId}/articles/${prev.id}/questions`} className={buttonClass("ghost", "sm")} title={prev.title} data-testid="qa-prev">
                <I.ChevronLeft size={15} />
                {t("ielts.admin.prevArticle")}
              </Link>
            )}
            {next && (
              <Link href={`/admin/books/${bookId}/articles/${next.id}/questions`} className={buttonClass("ghost", "sm")} title={next.title} data-testid="qa-next">
                {t("ielts.admin.nextArticle")}
                <I.ChevronRight size={15} />
              </Link>
            )}
            <Button icon={<I.Plus size={15} />} onClick={() => setEditing("new")} disabled={!!editing} data-testid="q-new">
              {t("quiz.admin.add")}
            </Button>
          </div>
        }
      />

      {(msg || loadError) && <Alert tone={msg?.tone === "success" ? "success" : msg?.tone === "warning" ? "warning" : "danger"}>{msg?.text ?? loadError}</Alert>}

      {editing && (
        <section className="card qa-editor" data-testid="qa-editor">
          <header className="card-header">
            <div className="card-title">{editing === "new" ? t("ielts.admin.newQuestion") : t("ielts.admin.editQuestion")}</div>
          </header>
          <div className="card-body">
            <QuestionForm
              key={editing === "new" ? "new" : editing.id}
              articleId={articleId}
              initial={editing === "new" ? null : editing}
              orderIndex={list.length}
              pageCount={article?.page_count ?? null}
              onCancel={() => setEditing(null)}
              onSaved={(_, warning) => {
                setEditing(null);
                setMsg(warning ? { tone: "warning", text: warning } : { tone: "success", text: t("ielts.admin.saved") });
                reload();
              }}
            />
          </div>
        </section>
      )}

      <section className="card" data-testid="q-list-card">
        <header className="card-header">
          <div className="card-title">{t("ielts.admin.list")}</div>
          {data && list.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs" data-testid="qa-summary">
              <Badge>{t("ielts.admin.countN", { n: list.length })}</Badge>
              <Badge tone="accent">{t("ielts.admin.pointsN", { n: totalPoints })}</Badge>
              {(Object.keys(byMech) as Mechanic[]).map((m) => (
                <Badge key={m} tone={MECH_TONE[m]}>
                  {t(`ielts.mech.${m}` as DictKey)}: {byMech[m]}
                </Badge>
              ))}
            </div>
          )}
        </header>
        <div className="card-body">
          {!data ? (
            <Spinner />
          ) : list.length === 0 ? (
            <EmptyState icon={<I.CheckCircle size={22} />} title={t("quiz.admin.empty")} description={t("ielts.admin.emptyHint")} />
          ) : (
            <ol className="qa-list" data-testid="q-list">
              {numbered.map(({ q, start, end }, i) => {
                // Ko'p javobli: o'quvchi nechta tanlashini bilmasa (data.choose ham, savol matnidagi son ham yo'q)
                const multiLost = mechanicOf(q.type) === "choice" && (q.answer.correct?.length ?? 0) > 1 && chooseCount(q) !== q.answer.correct?.length;
                const page = splitPage(q.explanation).page;
                return (
                  <li key={q.id} className={cn("qa-item", editing !== null && editing !== "new" && editing.id === q.id && "editing")} data-testid="q-item" data-type={q.type}>
                    <span className="qa-num">{start === end ? start : `${start}–${end}`}</span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={MECH_TONE[mechanicOf(q.type)]}>{t(`ielts.type.${q.type}` as DictKey)}</Badge>
                        <span className="text-xs text-muted">{t("ielts.admin.pointsN", { n: q.points })}</span>
                        {page && (
                          <span className="qa-page" data-testid="qa-page">
                            <I.BookOpen size={12} />
                            {t("ielts.admin.pageTag", { n: page })}
                          </span>
                        )}
                        {multiLost && (
                          <span data-testid="qa-choose-lost">
                            <Badge tone="warning">{t("ielts.admin.chooseLostShort")}</Badge>
                          </span>
                        )}
                      </div>
                      <p className="qa-prompt user-text">{q.prompt}</p>
                      <p className="qa-answer" data-testid="qa-answer">
                        <I.CheckCircle size={13} />
                        <span className="user-text">{answerSummary(q)}</span>
                      </p>
                    </div>
                    <div className="qa-actions">
                      <IconButton size="sm" variant="plain" label={t("ielts.admin.moveUp")} disabled={i === 0 || !!busyId || !!editing} onClick={() => void move(i, -1)} data-testid="q-up">
                        <I.ArrowUp size={14} />
                      </IconButton>
                      <IconButton size="sm" variant="plain" label={t("ielts.admin.moveDown")} disabled={i === list.length - 1 || !!busyId || !!editing} onClick={() => void move(i, 1)} data-testid="q-down">
                        <I.ArrowDown size={14} />
                      </IconButton>
                      <IconButton size="sm" variant="plain" label={t("ielts.admin.duplicate")} disabled={!!busyId || !!editing} onClick={() => void duplicate(q)} data-testid="q-duplicate">
                        <I.Copy size={14} />
                      </IconButton>
                      <IconButton size="sm" variant="plain" label={t("common.edit")} disabled={!!busyId || !!editing} onClick={() => setEditing(q)} data-testid="q-edit">
                        <I.Pencil size={14} />
                      </IconButton>
                      <IconButton size="sm" variant="plain" label={t("common.delete")} disabled={!!busyId || !!editing} onClick={() => void remove(q)} data-testid="q-delete">
                        <I.Trash size={14} />
                      </IconButton>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
