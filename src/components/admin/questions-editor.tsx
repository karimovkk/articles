"use client";

/**
 * 44.5: admin — maqola testi savollari (ko'p tanlovli, avtomatik tekshiriladi). Ro'yxat, qo'shish/tahrirlash
 * (savol, 2–6 variant, to'g'ri javob, izoh, tartib), o'chirish. `GET/POST /admin/articles/{id}/questions`,
 * `PATCH/DELETE …/questions/{qid}`. O'quvchi to'g'ri javobni faqat testni yuborgandan keyin ko'radi.
 */
import { useState, type FormEvent } from "react";
import { Alert, Button, EmptyState, Field, IconButton, Input, Modal, Spinner, Textarea, cn, useConfirm } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { errorMessage, quizApi, QUIZ_MAX_OPTIONS, QUIZ_MIN_OPTIONS, type AdminQuestion } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { useT } from "@/i18n";

interface Draft {
  id: string | null;
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
}
const EMPTY: Draft = { id: null, prompt: "", options: ["", ""], correct: 0, explanation: "" };

export function QuestionsEditor({ articleId, title, open, onClose }: { articleId: string; title: string; open: boolean; onClose: () => void }) {
  const { t } = useT();
  const confirm = useConfirm();
  const { data, error: loadError, reload } = useAsync(() => (open ? quizApi.adminList(articleId) : Promise.resolve(null)), [articleId, open]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = [...(data ?? [])].sort((a, b) => a.order_index - b.order_index);

  const edit = (q: AdminQuestion) => setDraft({ id: q.id, prompt: q.prompt, options: [...q.options], correct: q.correct_index, explanation: q.explanation ?? "" });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const options = draft.options.map((o) => o.trim());
    if (!draft.prompt.trim() || options.some((o) => !o) || options.length < QUIZ_MIN_OPTIONS) {
      setError(t("quiz.admin.invalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = { prompt: draft.prompt.trim(), options, correct_index: draft.correct, explanation: draft.explanation.trim() || null };
      if (draft.id) await quizApi.adminUpdate(articleId, draft.id, body);
      else await quizApi.adminCreate(articleId, { ...body, order_index: items.length });
      setDraft(null);
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(q: AdminQuestion) {
    const ok = await confirm({ title: t("common.delete"), message: t("quiz.admin.deleteConfirm"), confirmLabel: t("common.delete"), tone: "danger" });
    if (!ok) return;
    try {
      await quizApi.adminDelete(articleId, q.id);
      reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const setOption = (i: number, v: string) => setDraft((d) => (d ? { ...d, options: d.options.map((o, k) => (k === i ? v : o)) } : d));
  const removeOption = (i: number) =>
    setDraft((d) => (d ? { ...d, options: d.options.filter((_, k) => k !== i), correct: d.correct === i ? 0 : d.correct > i ? d.correct - 1 : d.correct } : d));

  return (
    <Modal open={open} onClose={onClose} title={`${t("quiz.admin.title")}: ${title}`} size="lg" icon={<I.CheckCircle size={18} />} data-testid="questions-editor">
      <div className="space-y-4">
        <p className="text-xs text-muted">{t("quiz.admin.hint")}</p>
        {(error ?? loadError) && <Alert>{error ?? loadError}</Alert>}

        {draft ? (
          <form onSubmit={(e) => void save(e)} className="space-y-3" data-testid="question-form">
            <Field label={t("quiz.admin.prompt")}>
              <Textarea rows={2} value={draft.prompt} maxLength={1000} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} required data-testid="q-prompt" />
            </Field>
            <div className="space-y-2">
              <p className="text-xs font-bold text-text-2">{t("quiz.admin.options")}</p>
              {draft.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="q-correct"
                    checked={draft.correct === i}
                    onChange={() => setDraft({ ...draft, correct: i })}
                    aria-label={t("quiz.admin.markCorrect")}
                    title={t("quiz.admin.markCorrect")}
                    className="size-4 shrink-0 accent-[var(--accent-ink)]"
                    data-testid="q-correct"
                  />
                  <Input value={o} maxLength={300} onChange={(e) => setOption(i, e.target.value)} placeholder={t("quiz.admin.optionN", { n: i + 1 })} className={cn(draft.correct === i && "border-[var(--success)]")} data-testid="q-option" />
                  <IconButton size="sm" variant="plain" label={t("common.delete")} disabled={draft.options.length <= QUIZ_MIN_OPTIONS} onClick={() => removeOption(i)}>
                    <I.X size={15} />
                  </IconButton>
                </div>
              ))}
              {draft.options.length < QUIZ_MAX_OPTIONS && (
                <Button type="button" size="sm" variant="ghost" icon={<I.Plus size={14} />} onClick={() => setDraft({ ...draft, options: [...draft.options, ""] })} data-testid="q-add-option">
                  {t("quiz.admin.addOption")}
                </Button>
              )}
              <p className="text-xs text-muted">{t("quiz.admin.correctHint")}</p>
            </div>
            <Field label={t("quiz.admin.explanation")} hint={t("quiz.admin.explanationHint")}>
              <Textarea rows={2} value={draft.explanation} maxLength={1000} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} data-testid="q-explanation" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={busy} icon={<I.Check size={15} />} data-testid="q-save">
                {t("common.save")}
              </Button>
            </div>
          </form>
        ) : (
          <>
            {!data ? (
              <Spinner />
            ) : items.length === 0 ? (
              <EmptyState icon={<I.CheckCircle size={22} />} title={t("quiz.admin.empty")} description={t("quiz.admin.emptyHint")} />
            ) : (
              <ol className="space-y-3" data-testid="q-list">
                {items.map((q, i) => (
                  <li key={q.id} className="rounded-xl border border-border p-3" data-testid="q-item">
                    <div className="flex items-start gap-2">
                      <span className="track-num !size-6 shrink-0 !text-xs">{i + 1}</span>
                      <p className="min-w-0 flex-1 text-sm font-semibold text-text user-text">{q.prompt}</p>
                      <IconButton size="sm" variant="plain" label={t("common.edit")} onClick={() => edit(q)} data-testid="q-edit">
                        <I.Pencil size={14} />
                      </IconButton>
                      <IconButton size="sm" variant="plain" label={t("common.delete")} onClick={() => void remove(q)} data-testid="q-delete">
                        <I.Trash size={14} />
                      </IconButton>
                    </div>
                    <ul className="mt-2 space-y-1 pl-8 text-sm">
                      {q.options.map((o, k) => (
                        <li key={k} className={cn("flex items-center gap-1.5 user-text", k === q.correct_index ? "font-semibold text-success" : "text-text-2")}>
                          {k === q.correct_index ? <I.CheckCircle size={13} /> : <span className="inline-block size-[13px]" />}
                          {o}
                        </li>
                      ))}
                    </ul>
                    {q.explanation && <p className="mt-2 pl-8 text-xs text-muted user-text">{q.explanation}</p>}
                  </li>
                ))}
              </ol>
            )}
            <Button icon={<I.Plus size={15} />} onClick={() => setDraft({ ...EMPTY, options: ["", ""] })} data-testid="q-new">
              {t("quiz.admin.add")}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
