"use client";

/**
 * 87: admin — bitta IELTS savolini yaratish/tahrirlash. Tur tanlash (mexanika bo'yicha guruhlar) → turga mos forma:
 *   choice   — variantlar (A, B, C…), bir yoki bir nechta to'g'ri;
 *   enum     — da'vo va to'g'ri qiymat (TRUE/FALSE/NOT GIVEN yoki YES/NO/NOT GIVEN);
 *   matching — elementlar (paragraflar/gaplar/fikrlar) va variantlar (kalit + matn; sarlavhalar — i, ii, iii…), har
 *              element uchun to'g'ri kalit;
 *   text     — matn `___` bo'sh joylari bilan (jadval — katakchalar, oqim — qadamlar quruvchisi), har bo'sh joy uchun
 *              qabul qilinadigan variantlar, so'z chegarasi.
 * O'ngda — o'quvchi ko'rinishi (jonli; "To'g'ri javob bilan" — natija rejimi). Tekshiruv — `validateDraft` (backend 422 ham).
 */
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Field,
  IconButton,
  Input,
  Textarea,
  cn,
  useConfirm,
} from "@/components/ui";
import * as I from "@/components/ui/icons";
import { QuestionView } from "@/components/quiz/question-view";
import {
  errorMessage,
  mechanicOf,
  pointsOf,
  QUESTION_TYPES,
  quizApi,
  type AdminQuestion,
  type MatchingOption,
  type QuestionAnswer,
  type QuestionData,
  type QuestionType,
} from "@/lib/api";
import {
  MAX_BLANKS,
  MAX_CHOICE_OPTIONS,
  MAX_MATCH_ITEMS,
  MAX_MATCH_OPTIONS,
  choiceOptions,
  countBlanks,
  emptyDraft,
  enumValues,
  matchingOptions,
  optionKey,
  validateDraft,
  promptChooseCount,
  splitImage,
  withImage,
  splitPage,
  withPage,
  HTTPS_URL_RE,
} from "@/lib/quiz/ielts";
import { useT, type DictKey } from "@/i18n";

const GROUPS: Array<{ id: string; types: QuestionType[] }> = [
  { id: "choice", types: ["MULTIPLE_CHOICE"] },
  { id: "enum", types: ["TRUE_FALSE_NOT_GIVEN", "YES_NO_NOT_GIVEN"] },
  {
    id: "matching",
    types: [
      "MATCHING_INFORMATION",
      "MATCHING_HEADINGS",
      "MATCHING_FEATURES",
      "MATCHING_SENTENCE_ENDINGS",
    ],
  },
  {
    id: "text",
    types: [
      "SENTENCE_COMPLETION",
      "SUMMARY_COMPLETION",
      "NOTE_COMPLETION",
      "TABLE_COMPLETION",
      "FLOW_CHART_COMPLETION",
      "DIAGRAM_LABEL_COMPLETION",
    ],
  },
];
const ENUM_LABEL: Record<string, string> = {
  TRUE: "TRUE",
  FALSE: "FALSE",
  NOT_GIVEN: "NOT GIVEN",
  YES: "YES",
  NO: "NO",
};

/** Jadval matni ↔ katakchalar */
const parseTable = (text: string) => {
  const rows = text
    .split("\n")
    .filter((r) => r.trim())
    .map((r) => r.split("|").map((c) => c.trim()));
  const cols = Math.max(2, ...rows.map((r) => r.length));
  return (rows.length ? rows : [["", ""]]).map((r) =>
    Array.from({ length: cols }, (_, i) => r[i] ?? ""),
  );
};
const tableText = (rows: string[][]) =>
  rows.map((r) => r.join(" | ")).join("\n");

export function QuestionForm({
  articleId,
  initial,
  orderIndex,
  pageCount,
  onSaved,
  onCancel,
}: {
  articleId: string;
  /** Tahrirlash — mavjud savol; yangi — null */
  initial: AdminQuestion | null;
  orderIndex: number;
  /** Maqola betlari soni (javob sahifasi tekshiruvi uchun) */
  pageCount?: number | null;
  onSaved: (q: AdminQuestion, warning: string | null) => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const confirm = useConfirm();
  const [type, setType] = useState<QuestionType>(
    initial?.type ?? "MULTIPLE_CHOICE",
  );
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [data, setData] = useState<QuestionData>(() =>
    initial
      ? structuredClone(initial.data)
      : emptyDraft("MULTIPLE_CHOICE").data,
  );
  const [answer, setAnswer] = useState<QuestionAnswer>(() =>
    initial
      ? structuredClone(initial.answer)
      : emptyDraft("MULTIPLE_CHOICE").answer,
  );
  // 88.4: izoh oxiridagi `[p. N]` — alohida "Javob sahifasi" maydoni
  const [explanation, setExplanation] = useState(
    () => splitPage(initial?.explanation).text,
  );
  const [answerPage, setAnswerPage] = useState(() =>
    String(splitPage(initial?.explanation).page ?? ""),
  );
  const pageNo = Number(answerPage) || null;
  const pageBad =
    answerPage.trim() !== "" &&
    (!Number.isInteger(Number(answerPage)) ||
      Number(answerPage) < 1 ||
      Number(answerPage) > (pageCount || 9999));
  const fullExplanation = withPage(explanation, pageBad ? null : pageNo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const mech = mechanicOf(type);
  const touched = useRef(false);
  const touch = () => {
    touched.current = true;
    setError(null);
  };

  async function pickType(next: QuestionType) {
    if (next === type) return;
    // Mexanika o'zgarsa — maydonlar boshqacha: kiritilgani yo'qoladi (tasdiq bilan); savol matni saqlanadi
    if (mechanicOf(next) !== mech) {
      if (
        touched.current &&
        !(await confirm({
          title: t("ielts.admin.changeType"),
          message: t("ielts.admin.changeTypeBody"),
          confirmLabel: t("ielts.admin.change"),
        }))
      )
        return;
      const d = emptyDraft(next);
      setData(d.data);
      setAnswer(d.answer);
      touched.current = false;
    } else if (mechanicOf(next) === "matching") {
      // Kalit uslubi (i, ii… ↔ A, B…) turga mos qayta nomlanadi
      const opts = matchingOptions(data);
      const rename = new Map(opts.map((o, i) => [o.key, optionKey(next, i)]));
      setData({
        ...data,
        options: opts.map((o, i) => ({ ...o, key: optionKey(next, i) })),
      });
      setAnswer({
        map: Object.fromEntries(
          Object.entries(answer.map ?? {}).map(([k, v]) => [
            k,
            rename.get(v) ?? v,
          ]),
        ),
      });
    } else if (mechanicOf(next) === "enum") setAnswer({ value: "" });
    else if (
      mechanicOf(next) === "text" &&
      (next === "TABLE_COMPLETION" || type === "TABLE_COMPLETION")
    ) {
      const d = emptyDraft(next);
      setData(d.data);
      setAnswer(d.answer);
    } else if (next === "FLOW_CHART_COMPLETION") {
      // Oqim qadamlari — rasm satrisiz
      const rest = splitImage(data.text ?? "").rest;
      setData({ ...data, text: rest, blanks: countBlanks(rest) });
    }
    setType(next);
    setError(null);
  }

  // ---- text: matn o'zgarsa — bo'sh joylar soni va javoblar ro'yxati moslanadi
  const setText = (text: string) => {
    touch();
    const n = countBlanks(text);
    setData({ ...data, text, blanks: n });
    setAnswer({
      blanks: Array.from({ length: n }, (_, i) => answer.blanks?.[i] ?? [""]),
    });
  };
  const insertBlank = () => {
    const el = textRef.current;
    const { raw, rest: text } = splitImage(data.text ?? "");
    const at = el ? el.selectionStart : text.length;
    const next = `${text.slice(0, at)}${at > 0 && !/\s$/.test(text.slice(0, at)) ? " " : ""}___${text.slice(at)}`;
    setText(withImage(raw ?? "", next));
    requestAnimationFrame(() => el?.focus());
  };

  const v = useMemo(
    () => validateDraft(type, prompt, data, answer),
    [type, prompt, data, answer],
  );
  const previewQ = useMemo(
    () => ({
      id: "preview",
      type,
      prompt: prompt || t("ielts.admin.promptPh"),
      data: v.error ? data : v.input.data,
      points: pointsOf(type, v.error ? data : v.input.data),
      order_index: 0,
    }),
    [type, prompt, data, v, t],
  );
  const [previewResp, setPreviewResp] = useState<Record<string, unknown>>({});
  const previewResult = showAnswer
    ? {
        question_id: "preview",
        type,
        is_correct: true,
        score: previewQ.points,
        max_score: previewQ.points,
        correct_answer: v.error ? answer : v.input.answer,
        explanation: fullExplanation,
      }
    : null;
  const answerAsResponse = (a: QuestionAnswer) =>
    mech === "choice"
      ? { selected: a.correct ?? [] }
      : mech === "enum"
        ? { value: a.value }
        : mech === "matching"
          ? { map: a.map ?? {} }
          : { blanks: (a.blanks ?? []).map((x) => x[0] ?? "") };

  async function save() {
    if (v.error) {
      setError(t(v.error as DictKey));
      return;
    }
    if (pageBad) {
      setError(t("ielts.err.page", { max: pageCount || 9999 }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = { ...v.input, explanation: fullExplanation };
      const saved = initial
        ? await quizApi.adminUpdate(articleId, initial.id, body)
        : await quizApi.adminCreate(articleId, {
            ...body,
            order_index: orderIndex,
          });
      // Ko'p javobli savol: server `choose` ni saqlamasa — o'quvchi bitta variant tanlay oladi (ogohlantirish)
      // (savol matnida son bo'lsa — "Choose TWO" — o'quvchi baribir to'g'ri ko'radi)
      const wantChoose = (v.input.data as { choose?: number }).choose;
      const warning =
        wantChoose &&
        !(saved.data as { choose?: number }).choose &&
        promptChooseCount(saved.prompt) !== wantChoose
          ? t("ielts.admin.chooseLost")
          : null;
      onSaved(saved, warning);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // ---- turga xos maydonlar
  let fields: React.ReactNode = null;
  if (mech === "choice") {
    const opts = choiceOptions(data);
    const correct = new Set(answer.correct ?? []);
    fields = (
      <div className="space-y-2" data-testid="qf-choice">
        <p className="qf-label">{t("ielts.admin.options")}</p>
        {opts.map((o, i) => (
          <div key={i} className="qf-row">
            <label
              className={cn("qf-correct", correct.has(i) && "on")}
              title={t("ielts.admin.markCorrect")}
            >
              <input
                type="checkbox"
                checked={correct.has(i)}
                onChange={() => {
                  touch();
                  const next = new Set(correct);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  setAnswer({ correct: [...next].sort((a, b) => a - b) });
                }}
                data-testid="qf-correct"
              />
              <span>{String.fromCharCode(65 + i)}</span>
            </label>
            <Input
              value={o}
              maxLength={300}
              placeholder={t("ielts.admin.optionPh", {
                l: String.fromCharCode(65 + i),
              })}
              onChange={(e) => {
                touch();
                setData({
                  ...data,
                  options: opts.map((x, k) => (k === i ? e.target.value : x)),
                });
              }}
              data-testid="qf-option"
            />
            <IconButton
              size="sm"
              variant="plain"
              label={t("common.delete")}
              disabled={opts.length <= 2}
              onClick={() => {
                touch();
                setData({ ...data, options: opts.filter((_, k) => k !== i) });
                setAnswer({
                  correct: (answer.correct ?? [])
                    .filter((c) => c !== i)
                    .map((c) => (c > i ? c - 1 : c)),
                });
              }}
            >
              <I.X size={15} />
            </IconButton>
          </div>
        ))}
        {opts.length < MAX_CHOICE_OPTIONS && (
          <Button
            size="sm"
            variant="ghost"
            icon={<I.Plus size={14} />}
            onClick={() => setData({ ...data, options: [...opts, ""] })}
            data-testid="qf-add-option"
          >
            {t("ielts.admin.addOption")}
          </Button>
        )}
        <p
          className={cn(
            "text-xs",
            correct.size ? "text-muted" : "font-semibold text-warning",
          )}
        >
          {correct.size > 1
            ? t("ielts.admin.multiHint", { n: correct.size })
            : correct.size
              ? t("ielts.admin.singleHint")
              : t("ielts.admin.pickCorrect")}
        </p>
        {/* 88.1: server `choose` ni saqlamasa ham — savol matnidagi son bo'yicha */}
        {correct.size > 1 && !promptChooseCount(prompt) && (
          <p className="text-xs text-text-2" data-testid="qf-choose-tip">
            <I.Info size={12} className="mr-1 inline" />
            {t("ielts.admin.chooseTip", { n: correct.size })}
          </p>
        )}
      </div>
    );
  } else if (mech === "enum") {
    fields = (
      <div className="space-y-2" data-testid="qf-enum-field">
        <p className="qf-label">{t("ielts.admin.correctValue")}</p>
        <div className="qv-enum" role="radiogroup">
          {enumValues(type).map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={answer.value === x}
              className={cn("qv-enum-btn", answer.value === x && "chosen")}
              onClick={() => {
                touch();
                setAnswer({ value: x });
              }}
              data-testid="qf-enum"
            >
              {ENUM_LABEL[x]}
            </button>
          ))}
        </div>
      </div>
    );
  } else if (mech === "matching") {
    const items = data.items ?? [];
    const opts = matchingOptions(data);
    const map = answer.map ?? {};
    const setOpts = (next: MatchingOption[]) =>
      setData({ ...data, options: next });
    fields = (
      <div className="qf-match" data-testid="qf-matching">
        <div className="space-y-2">
          <p className="qf-label">
            {t(
              type === "MATCHING_HEADINGS"
                ? "ielts.admin.itemsParagraphs"
                : type === "MATCHING_SENTENCE_ENDINGS"
                  ? "ielts.admin.itemsBeginnings"
                  : type === "MATCHING_FEATURES"
                    ? "ielts.admin.itemsStatements"
                    : "ielts.admin.itemsInfo",
            )}
          </p>
          {items.map((it, i) => (
            <div key={i} className="qf-row">
              <span className="qv-num">{i + 1}</span>
              <Input
                value={it}
                maxLength={500}
                placeholder={t("ielts.admin.itemPh", { n: i + 1 })}
                onChange={(e) => {
                  touch();
                  setData({
                    ...data,
                    items: items.map((x, k) => (k === i ? e.target.value : x)),
                  });
                }}
                data-testid="qf-item"
              />
              <select
                className="input sm qf-key-select"
                value={map[String(i)] ?? ""}
                onChange={(e) => {
                  touch();
                  setAnswer({ map: { ...map, [String(i)]: e.target.value } });
                }}
                aria-label={t("ielts.admin.correctKey")}
                data-testid="qf-item-answer"
              >
                <option value="">{t("ielts.admin.correctKey")}</option>
                {opts.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.key}
                    {o.text ? ` — ${o.text.slice(0, 40)}` : ""}
                  </option>
                ))}
              </select>
              <IconButton
                size="sm"
                variant="plain"
                label={t("common.delete")}
                disabled={items.length <= 1}
                onClick={() => {
                  touch();
                  setData({ ...data, items: items.filter((_, k) => k !== i) });
                  // Javoblar xaritasi indekslari siljiydi
                  const m2: Record<string, string> = {};
                  Object.entries(map).forEach(([k, val]) => {
                    const n = Number(k);
                    if (n < i) m2[k] = val;
                    else if (n > i) m2[String(n - 1)] = val;
                  });
                  setAnswer({ map: m2 });
                }}
              >
                <I.X size={15} />
              </IconButton>
            </div>
          ))}
          {items.length < MAX_MATCH_ITEMS && (
            <Button
              size="sm"
              variant="ghost"
              icon={<I.Plus size={14} />}
              onClick={() => setData({ ...data, items: [...items, ""] })}
              data-testid="qf-add-item"
            >
              {t("ielts.admin.addItem")}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <p className="qf-label">
            {t(
              type === "MATCHING_HEADINGS"
                ? "ielts.listHeadings"
                : type === "MATCHING_SENTENCE_ENDINGS"
                  ? "ielts.listEndings"
                  : type === "MATCHING_FEATURES"
                    ? "ielts.listFeatures"
                    : "ielts.listInfo",
            )}
          </p>
          {opts.map((o, i) => (
            <div key={i} className="qf-row">
              <Input
                className="qf-key"
                value={o.key}
                maxLength={8}
                aria-label={t("ielts.admin.key")}
                onChange={(e) => {
                  touch();
                  const key = e.target.value;
                  setOpts(opts.map((x, k) => (k === i ? { ...x, key } : x)));
                  // To'g'ri javoblar ham yangi kalitga
                  setAnswer({
                    map: Object.fromEntries(
                      Object.entries(map).map(([k2, val]) => [
                        k2,
                        val === o.key ? key : val,
                      ]),
                    ),
                  });
                }}
                data-testid="qf-opt-key"
              />
              <Input
                value={o.text}
                maxLength={300}
                placeholder={t("ielts.admin.optionTextPh")}
                onChange={(e) => {
                  touch();
                  setOpts(
                    opts.map((x, k) =>
                      k === i ? { ...x, text: e.target.value } : x,
                    ),
                  );
                }}
                data-testid="qf-opt-text"
              />
              <IconButton
                size="sm"
                variant="plain"
                label={t("common.delete")}
                disabled={opts.length <= 1}
                onClick={() => {
                  touch();
                  setOpts(opts.filter((_, k) => k !== i));
                  setAnswer({
                    map: Object.fromEntries(
                      Object.entries(map).filter(([, val]) => val !== o.key),
                    ),
                  });
                }}
              >
                <I.X size={15} />
              </IconButton>
            </div>
          ))}
          {opts.length < MAX_MATCH_OPTIONS && (
            <Button
              size="sm"
              variant="ghost"
              icon={<I.Plus size={14} />}
              onClick={() =>
                setOpts([
                  ...opts,
                  { key: optionKey(type, opts.length), text: "" },
                ])
              }
              data-testid="qf-add-opt"
            >
              {t("ielts.admin.addMatchOption")}
            </Button>
          )}
          <p className="text-xs text-muted">{t("ielts.admin.matchHint")}</p>
        </div>
      </div>
    );
  } else {
    const text = data.text ?? "";
    const n = countBlanks(text);
    // 88.2: diagramma rasmi — 1-satr `![…](https://…)`; matn maydonida ko'rinmaydi, alohida havola maydoni
    const img = splitImage(text);
    const withImg = type === "DIAGRAM_LABEL_COMPLETION" || img.raw !== null;
    const blanks = answer.blanks ?? [];
    let editor: React.ReactNode;
    if (type === "TABLE_COMPLETION") {
      const rows = parseTable(text);
      const setRows = (r: string[][]) => setText(tableText(r));
      editor = (
        <div className="space-y-2" data-testid="qf-table">
          <div className="qf-table-wrap">
            <table className="qf-table">
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((c, ci) => (
                      <td key={ci}>
                        <input
                          className={cn(
                            "input sm",
                            ri === 0 && "font-semibold",
                          )}
                          value={c}
                          placeholder={
                            ri === 0 ? t("ielts.admin.colHead") : "___"
                          }
                          onChange={(e) =>
                            setRows(
                              rows.map((rr, i2) =>
                                i2 === ri
                                  ? rr.map((cc, j) =>
                                      j === ci ? e.target.value : cc,
                                    )
                                  : rr,
                              ),
                            )
                          }
                          data-testid="qf-cell"
                        />
                      </td>
                    ))}
                    <td className="w-8">
                      {ri > 0 && rows.length > 2 && (
                        <IconButton
                          size="sm"
                          variant="plain"
                          label={t("ielts.admin.removeRow")}
                          onClick={() =>
                            setRows(rows.filter((_, i2) => i2 !== ri))
                          }
                        >
                          <I.X size={14} />
                        </IconButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<I.Plus size={14} />}
              onClick={() => setRows([...rows, rows[0].map(() => "")])}
              data-testid="qf-add-row"
            >
              {t("ielts.admin.addRow")}
            </Button>
            {rows[0].length < 5 && (
              <Button
                size="sm"
                variant="ghost"
                icon={<I.Plus size={14} />}
                onClick={() => setRows(rows.map((r) => [...r, ""]))}
              >
                {t("ielts.admin.addCol")}
              </Button>
            )}
            {rows[0].length > 2 && (
              <Button
                size="sm"
                variant="ghost"
                icon={<I.X size={14} />}
                onClick={() => setRows(rows.map((r) => r.slice(0, -1)))}
              >
                {t("ielts.admin.removeCol")}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">{t("ielts.admin.tableHint")}</p>
        </div>
      );
    } else if (type === "FLOW_CHART_COMPLETION") {
      const steps = text.split("\n");
      const setSteps = (s2: string[]) => setText(s2.join("\n"));
      editor = (
        <div className="space-y-2" data-testid="qf-flow">
          {steps.map((s2, i) => (
            <div key={i} className="qf-row">
              <span className="qv-num">{i + 1}</span>
              <Input
                value={s2}
                placeholder={t("ielts.admin.stepPh")}
                onChange={(e) =>
                  setSteps(steps.map((x, k) => (k === i ? e.target.value : x)))
                }
                data-testid="qf-step"
              />
              <IconButton
                size="sm"
                variant="plain"
                label={t("common.delete")}
                disabled={steps.length <= 1}
                onClick={() => setSteps(steps.filter((_, k) => k !== i))}
              >
                <I.X size={15} />
              </IconButton>
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            icon={<I.Plus size={14} />}
            onClick={() => setSteps([...steps, "___"])}
            data-testid="qf-add-step"
          >
            {t("ielts.admin.addStep")}
          </Button>
        </div>
      );
    } else {
      editor = (
        <div className="space-y-2">
          <Textarea
            ref={textRef}
            rows={5}
            value={img.rest}
            maxLength={3000}
            onChange={(e) => setText(withImage(img.raw ?? "", e.target.value))}
            placeholder={t("ielts.admin.textPh")}
            data-testid="qf-text"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<I.Plus size={14} />}
              onClick={insertBlank}
              disabled={n >= MAX_BLANKS}
              data-testid="qf-insert-blank"
            >
              {t("ielts.admin.insertBlank")}
            </Button>
            <span className="text-xs text-muted">
              {t(
                type === "NOTE_COMPLETION" ||
                  type === "DIAGRAM_LABEL_COMPLETION"
                  ? "ielts.admin.linesHint"
                  : "ielts.admin.blankHint",
              )}
            </span>
          </div>
        </div>
      );
    }
    fields = (
      <div className="space-y-3" data-testid="qf-text-type">
        {withImg &&
          type !== "TABLE_COMPLETION" &&
          type !== "FLOW_CHART_COMPLETION" && (
            <Field
              label={t("ielts.admin.imageUrl")}
              hint={t("ielts.admin.imageUrlHint")}
            >
              <Input
                type="url"
                inputMode="url"
                value={img.raw ?? ""}
                placeholder="https://…/diagram.png"
                onChange={(e) => {
                  touch();
                  setText(withImage(e.target.value, img.rest));
                }}
                data-testid="qf-image-url"
              />
              {img.raw && !HTTPS_URL_RE.test(img.raw) && (
                <p className="mt-1 text-xs font-semibold text-danger">
                  {t("ielts.err.image")}
                </p>
              )}
            </Field>
          )}
        <p className="qf-label">{t("ielts.admin.textLabel")}</p>
        {editor}
        <div className="space-y-2">
          <p className="qf-label">
            {t("ielts.admin.accepted")}{" "}
            <span className="font-normal text-muted">
              · {t("ielts.admin.blanksN", { n })}
            </span>
          </p>
          {n === 0 && (
            <p className="text-xs font-semibold text-warning">
              {t("ielts.err.blanks")}
            </p>
          )}
          {blanks.slice(0, n).map((vs, i) => (
            <div
              key={i}
              className="qf-blank-answers"
              data-testid="qf-blank-answers"
            >
              <span className="qv-num">{i + 1}</span>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {vs.map((val, k) => (
                  <span key={k} className="qf-variant">
                    <input
                      className="input sm"
                      value={val}
                      placeholder={
                        k === 0
                          ? t("ielts.admin.answerPh")
                          : t("ielts.admin.variantPh")
                      }
                      onChange={(e) => {
                        touch();
                        setAnswer({
                          blanks: blanks.map((x, j) =>
                            j === i
                              ? x.map((y, z) => (z === k ? e.target.value : y))
                              : x,
                          ),
                        });
                      }}
                      data-testid="qf-accepted"
                    />
                    {vs.length > 1 && (
                      <button
                        type="button"
                        className="qf-variant-x"
                        aria-label={t("common.delete")}
                        onClick={() =>
                          setAnswer({
                            blanks: blanks.map((x, j) =>
                              j === i ? x.filter((_, z) => z !== k) : x,
                            ),
                          })
                        }
                      >
                        <I.X size={12} />
                      </button>
                    )}
                  </span>
                ))}
                {vs.length < 6 && (
                  <button
                    type="button"
                    className="qf-variant-add"
                    onClick={() =>
                      setAnswer({
                        blanks: blanks.map((x, j) =>
                          j === i ? [...x, ""] : x,
                        ),
                      })
                    }
                    data-testid="qf-add-variant"
                  >
                    <I.Plus size={12} />
                    {t("ielts.admin.addVariant")}
                  </button>
                )}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted">{t("ielts.admin.normHint")}</p>
        </div>
        <Field
          label={t("ielts.admin.wordLimit")}
          hint={t("ielts.admin.wordLimitHint")}
        >
          <div className="flex flex-wrap items-center gap-2">
            {[1, 2, 3].map((x) => (
              <button
                key={x}
                type="button"
                aria-pressed={Number(data.word_limit) === x}
                className={cn(
                  "qv-enum-btn sm",
                  Number(data.word_limit) === x && "chosen",
                )}
                onClick={() => {
                  touch();
                  setData({ ...data, word_limit: x });
                }}
                data-testid="qf-word-limit"
              >
                {t("ielts.admin.wordsN", { n: x })}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={!Number(data.word_limit)}
              className={cn(
                "qv-enum-btn sm",
                !Number(data.word_limit) && "chosen",
              )}
              onClick={() => {
                touch();
                setData({ ...data, word_limit: null });
              }}
            >
              {t("ielts.admin.noLimit")}
            </button>
          </div>
        </Field>
      </div>
    );
  }

  return (
    <div className="qf" data-testid="question-form">
      <div className="qf-main">
        {/* Tur tanlash */}
        <div className="space-y-2">
          <p className="qf-label">{t("ielts.admin.type")}</p>
          <div
            className="qf-types"
            role="radiogroup"
            aria-label={t("ielts.admin.type")}
          >
            {GROUPS.map((g) => (
              <div key={g.id} className="qf-type-group">
                <p className="qf-type-group-title">
                  {t(`ielts.mech.${g.id}` as DictKey)}
                </p>
                <div className="qf-type-list">
                  {g.types.map((ty) => (
                    <button
                      key={ty}
                      type="button"
                      role="radio"
                      aria-checked={ty === type}
                      className={cn("qf-type", ty === type && "on")}
                      onClick={() => void pickType(ty)}
                      data-testid="qf-type"
                      data-type={ty}
                      title={t(`ielts.desc.${ty}` as DictKey)}
                    >
                      {t(`ielts.type.${ty}` as DictKey)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted" data-testid="qf-type-desc">
            {t(`ielts.desc.${type}` as DictKey)}
          </p>
        </div>

        <Field
          label={t(
            mech === "enum" ? "ielts.admin.statement" : "ielts.admin.prompt",
          )}
        >
          <Textarea
            rows={2}
            value={prompt}
            maxLength={2000}
            onChange={(e) => {
              touch();
              setPrompt(e.target.value);
            }}
            placeholder={t(
              mech === "enum"
                ? "ielts.admin.statementPh"
                : (`ielts.admin.promptPh.${mech}` as DictKey),
            )}
            data-testid="qf-prompt"
          />
        </Field>

        {fields}

        <Field
          label={t("quiz.admin.explanation")}
          hint={t("quiz.admin.explanationHint")}
        >
          <Textarea
            rows={2}
            value={explanation}
            maxLength={2000}
            onChange={(e) => setExplanation(e.target.value)}
            data-testid="qf-explanation"
          />
        </Field>
        <Field
          label={t("ielts.admin.answerPage")}
          hint={
            pageCount
              ? t("ielts.admin.answerPageHintN", { n: pageCount })
              : t("ielts.admin.answerPageHint")
          }
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={pageCount || 9999}
            value={answerPage}
            onChange={(e) => {
              setAnswerPage(e.target.value);
              setError(null);
            }}
            className="max-w-[140px]"
            data-testid="qf-answer-page"
          />
          {pageBad && (
            <p className="mt-1 text-xs font-semibold text-danger">
              {t("ielts.err.page", { max: pageCount || 9999 })}
            </p>
          )}
        </Field>

        {error && <Alert>{error}</Alert>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-xs text-muted" data-testid="qf-points">
            {t("ielts.admin.pointsN", { n: previewQ.points })}
          </span>
          <Button variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => void save()}
            loading={busy}
            icon={<I.Check size={15} />}
            data-testid="qf-save"
          >
            {t("common.save")}
          </Button>
        </div>
      </div>

      {/* O'quvchi ko'rinishi (jonli) */}
      <aside className="qf-preview" aria-label={t("ielts.admin.preview")}>
        <div className="flex items-center justify-between gap-2">
          <p className="qf-label">{t("ielts.admin.preview")}</p>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-text-2">
            <input
              type="checkbox"
              checked={showAnswer}
              onChange={(e) => setShowAnswer(e.target.checked)}
              data-testid="qf-show-answer"
            />
            {t("ielts.admin.withAnswer")}
          </label>
        </div>
        <div className="quiz qf-preview-box" data-testid="qf-preview">
          <p className="quiz-group-instr">
            {t(`ielts.instr.${type}` as DictKey)}
          </p>
          <QuestionView
            q={previewQ}
            start={1}
            response={
              showAnswer
                ? answerAsResponse(v.error ? answer : v.input.answer)
                : (previewResp[type] as never)
            }
            onChange={(r) => setPreviewResp((s) => ({ ...s, [type]: r }))}
            result={previewResult}
          />
        </div>
        {v.error && (
          <p
            className="text-xs font-semibold text-warning"
            data-testid="qf-incomplete"
          >
            {t(v.error as DictKey)}
          </p>
        )}
      </aside>
    </div>
  );
}

export const ALL_TYPES = QUESTION_TYPES;
