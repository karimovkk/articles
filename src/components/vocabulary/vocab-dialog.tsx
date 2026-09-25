"use client";

/**
 * Lug'at oynasi (33.2, 33.4): reader'dan yangi so'z qo'shish va lug'at sahifasida tahrirlash — bitta forma.
 * So'z majburiy, tarjima va kontekst ixtiyoriy. Dublikat bo'lsa ogohlantiradi (saqlash — tarjimani yangilaydi).
 */
import { useState, type FormEvent } from "react";
import { Alert, Button, Field, Input, Modal, Textarea } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { VOCAB_TRANSLATION_MAX, VOCAB_WORD_MAX } from "@/lib/api";
import { useT } from "@/i18n";

export interface VocabFormValues {
  word: string;
  translation: string;
  context: string;
}

export function VocabDialog({
  open,
  mode,
  initial,
  duplicate,
  onSave,
  onClose,
}: {
  open: boolean;
  mode: "add" | "edit";
  initial: VocabFormValues;
  /** Shu maqoladan bu so'z allaqachon lug'atda */
  duplicate?: boolean;
  onSave: (v: VocabFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useT();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Oyna yangi so'z bilan qayta ochilsa — forma boshlang'ich qiymatga qaytadi (render fazasida)
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setValues(initial);
    setError(null);
  }

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!values.word.trim()) {
      setError(t("vocab.wordRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({ word: values.word.trim(), translation: values.translation.trim(), context: values.context.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      icon={<I.Languages size={18} />}
      title={t(mode === "add" ? "vocab.addTitle" : "vocab.editTitle")}
      data-testid="vocab-dialog"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} loading={busy} icon={<I.Check size={16} />} data-testid="vocab-save">
            {t("vocab.save")}
          </Button>
        </>
      }
    >
      <form className="space-y-3.5" onSubmit={(e) => void submit(e)}>
        {duplicate && (
          <Alert tone="info">
            <span data-testid="vocab-duplicate">{t("vocab.duplicate")}</span>
          </Alert>
        )}
        {error && <Alert>{error}</Alert>}
        <Field label={t("vocab.word")}>
          <Input value={values.word} maxLength={VOCAB_WORD_MAX} onChange={(e) => setValues((v) => ({ ...v, word: e.target.value }))} data-testid="vocab-word" autoComplete="off" required />
        </Field>
        <Field label={t("vocab.translation")} hint={t("vocab.translationHint")}>
          <Input
            value={values.translation}
            maxLength={VOCAB_TRANSLATION_MAX}
            placeholder={t("vocab.translationPlaceholder")}
            onChange={(e) => setValues((v) => ({ ...v, translation: e.target.value }))}
            data-testid="vocab-translation"
            autoComplete="off"
            autoFocus
          />
        </Field>
        <Field label={t("vocab.context")}>
          <Textarea rows={3} value={values.context} maxLength={500} onChange={(e) => setValues((v) => ({ ...v, context: e.target.value }))} data-testid="vocab-context" />
        </Field>
        {/* Enter bilan saqlash uchun */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
