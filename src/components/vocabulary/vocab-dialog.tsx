"use client";

/**
 * Lug'at oynasi (33.2, 33.4): reader'dan yangi so'z qo'shish va lug'at sahifasida tahrirlash — bitta forma.
 * So'z majburiy, tarjima va kontekst ixtiyoriy. Dublikat bo'lsa ogohlantiradi (saqlash — tarjimani yangilaydi).
 * 41/47: tarjima tilini o'quvchi o'zi tanlaydi (O'zbekcha · Русский · English — sayt tili emas); tanlov eslab qolinadi.
 * Til tanlangan bo'lsa — `autoTranslate` da oyna ochilishi bilan shu tilga tarjima so'raladi; tanlanmagan bo'lsa —
 * tanlanguncha so'ralmaydi. Til tugmasini bosish — joriy so'zni shu tilga (qayta) tarjima qilish. Foydalanuvchi
 * o'zi yozsa, kech kelgan avtomatik tarjima uni bosib ketmaydi.
 * Tarjima ishlamasa (backend o'chiq/xato) — forma odatdagidek ishlaydi.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Field, Input, Modal, Textarea, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { translateApi, VOCAB_TRANSLATION_MAX, VOCAB_WORD_MAX } from "@/lib/api";
import { LOCALES, useT } from "@/i18n";
import { setTranslateLang, useTranslateLang } from "@/lib/translate-lang";
import type { TranslateLang } from "@/lib/api";

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
  autoTranslate,
  onSave,
  onClose,
}: {
  open: boolean;
  mode: "add" | "edit";
  initial: VocabFormValues;
  /** Shu maqoladan bu so'z allaqachon lug'atda */
  duplicate?: boolean;
  /** Tarjima bo'sh bo'lsa — ochilganda avtomatik tarjima (reader'dan yangi so'z; dublikatda emas) */
  autoTranslate?: boolean;
  onSave: (v: VocabFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useT();
  const lang = useTranslateLang();
  const trId = useId();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 41: avtomatik tarjima holati; `fromGoogle` — maydondagi matn avtomatik (foydalanuvchi o'zgartirmagan)
  const [translating, setTranslating] = useState(false);
  const [fromGoogle, setFromGoogle] = useState(false);
  // O'zbekcha tanlanib, o'zbekcha tarjima bo'lmasa — ruscha keladi (izoh boshqacha)
  const [fallbackLang, setFallbackLang] = useState(false);
  const touched = useRef(false); // foydalanuvchi tarjima maydoniga yozdi — avtomatik natija uni bosmaydi
  const reqId = useRef(0);
  // Oyna yangi so'z bilan qayta ochilsa — forma boshlang'ich qiymatga qaytadi (render fazasida)
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setValues(initial);
    setError(null);
    setFromGoogle(false);
    setTranslating(false);
  }

  const runTranslate = (word: string, target: TranslateLang, force: boolean) => {
    const id = ++reqId.current;
    setTranslating(true);
    void translateApi.translate(word, target).then((tr) => {
      if (id !== reqId.current) return; // eskirgan javob (boshqa so'z / oyna yopildi)
      setTranslating(false);
      if (!tr || (!force && touched.current)) return;
      setValues((v) => (force || !v.translation.trim() ? { ...v, translation: tr.text.slice(0, VOCAB_TRANSLATION_MAX) } : v));
      setFromGoogle(true);
      setFallbackLang(tr.lang !== target);
    });
  };

  // Ochilganda: tarjima bo'sh bo'lsa — avtomatik
  useEffect(() => {
    touched.current = false;
    reqId.current++;
    // 47: til hali tanlanmagan — tanlanguncha so'ralmaydi
    if (!open || !autoTranslate || !lang || initial.translation.trim() || !initial.word.trim() || !translateApi.availableFor(lang)) return;
    const id = reqId.current;
    queueMicrotask(() => id === reqId.current && runTranslate(initial.word, lang, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat yangi so'z/oyna ochilganda
  }, [open, initial, autoTranslate]);

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
        {/* 51: yorliq faqat tarjima maydoniga — label ichidagi til tugmalari bosilib ketmasin */}
        <Field label={t("vocab.translation")} hint={fromGoogle ? undefined : t("vocab.translationHint")} htmlFor={trId}>
          {/* 47: tarjima tili — o'quvchi tanlaydi (sayt tili emas); bosish — shu tilga tarjima */}
          {translateApi.enabled() && (
            <div className="vocab-langs" role="group" aria-label={t("vocab.translateTo")} data-testid="vocab-langs">
              <span className={cn("vocab-langs-label", !lang && "pick")}>{lang ? t("vocab.translateTo") : t("vocab.pickLang")}</span>
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  className={cn(lang === l.code && "active")}
                  aria-pressed={lang === l.code}
                  disabled={!values.word.trim() || !translateApi.availableFor(l.code) || translating}
                  onClick={() => {
                    setTranslateLang(l.code);
                    runTranslate(values.word, l.code, true);
                  }}
                  data-testid={`vocab-lang-${l.code}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
          <div className="vocab-tr">
            <Input
              value={values.translation}
              maxLength={VOCAB_TRANSLATION_MAX}
              placeholder={translating ? t("vocab.translating") : t("vocab.translationPlaceholder")}
              onChange={(e) => {
                touched.current = true;
                setFromGoogle(false);
                setValues((v) => ({ ...v, translation: e.target.value }));
              }}
              id={trId}
              data-testid="vocab-translation"
              data-state={translating ? "loading" : fromGoogle ? "auto" : undefined}
              autoComplete="off"
              autoFocus
            />
          </div>
          {fromGoogle && (
            <p className="vocab-tr-badge" data-testid="vocab-auto-badge">
              <I.Sparkles size={12} />
              {fallbackLang ? t("vocab.autoTranslatedRu") : t("vocab.autoTranslated")}
            </p>
          )}
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
