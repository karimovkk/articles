"use client";

/**
 * 87: bitta IELTS savolining ko'rinishi — reader testi va admin "O'quvchi ko'rinishi" uchun umumiy.
 *  - `onChange` bo'lmasa yoki `result` bo'lsa — faqat o'qish (natija rejimi);
 *  - raqamlash ballar bo'yicha: savol `start` dan boshlab `points` ta raqam egallaydi (matching elementi / bo'sh joy);
 *  - natijada har element/bo'sh joy alohida belgilanadi (server — umumiy ball; element bo'yicha — `correct_answer` va
 *    javobdan; matnda normalizatsiya backend bilan bir xil: kichik harf, bo'shliq va tinish belgilarisiz).
 *  - 88: `reveal={false}` — natijada faqat o'quvchi javobining to'g'ri/xatoligi; to'g'ri javoblar va izoh yashirin
 *    ("Matnda ko'rsatish" tugmasi qoladi — javobni o'zi topsin); rasm (diagramma) — matnning 1-satri.
 */
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { mechanicOf, type QuestionResponse, type QuizAnswerResult, type QuizQuestion } from "@/lib/api";
import { chooseCount, choiceOptions, enumValues, matchingOptions, splitBlanks, splitImage, splitPage, uniqueOptions, wordCount } from "@/lib/quiz/ielts";
import { useT } from "@/i18n";

const norm = (s: string) => s.toLowerCase().normalize("NFKC").replace(/[\s\p{P}\p{S}]+/gu, "");
const ENUM_LABEL: Record<string, string> = { TRUE: "TRUE", FALSE: "FALSE", NOT_GIVEN: "NOT GIVEN", YES: "YES", NO: "NO" };

export function QuestionView({
  q,
  start,
  response,
  onChange,
  result,
  disabled,
  reveal = true,
  onShowPage,
}: {
  q: QuizQuestion;
  /** Birinchi raqam (IELTS: har element/bo'sh joy — alohida raqam) */
  start: number;
  response?: QuestionResponse;
  onChange?: (r: QuestionResponse) => void;
  result?: QuizAnswerResult | null;
  disabled?: boolean;
  /** Natijada to'g'ri javoblar va izoh ko'rinsinmi (o'quvchi "Ko'rsatish" ni bosguncha — yo'q) */
  reveal?: boolean;
  /** "Matnda ko'rsatish" — PDF'ning javob betiga o'tish */
  onShowPage?: (page: number) => void;
}) {
  const { t } = useT();
  const mech = mechanicOf(q.type);
  const ro = !onChange || !!result || disabled;
  const ca = result?.correct_answer ?? null;
  const verdict = result ? (result.is_correct ? "correct" : result.score > 0 ? "partial" : "wrong") : undefined;
  const range = q.points > 1 ? `${start}–${start + q.points - 1}` : String(start);
  const show = !!result && reveal; // to'g'ri javoblar ochiq
  const expl = splitPage(result?.explanation);

  let body: ReactNode = null;

  if (mech === "choice") {
    const opts = choiceOptions(q.data);
    const sel = response?.selected ?? [];
    // Bir nechta javobli: data.choose (frontend saqlaydi); backend saqlamasa — savol matnidan ("Choose TWO", "Qaysi ikkitasi")
    const choose = chooseCount(q);
    const multi = choose > 1;
    const correct = new Set(ca?.correct ?? []);
    body = (
      <div className="qv-options" role={multi ? "group" : "radiogroup"} aria-label={q.prompt}>
        {multi && !result && <p className="qv-hint">{t("ielts.chooseN", { n: choose })}</p>}
        {opts.map((o, i) => {
          const chosen = sel.includes(i);
          const state = result ? (show ? (correct.has(i) ? "correct" : chosen ? "wrong" : "dim") : chosen ? (correct.has(i) ? "correct" : "wrong") : "dim") : chosen ? "chosen" : undefined;
          return (
            <label key={i} className={cn("qv-opt", state)} data-state={state} data-testid="qv-option">
              <input
                type={multi ? "checkbox" : "radio"}
                name={`qv-${q.id}`}
                checked={chosen}
                disabled={ro}
                onChange={() => {
                  if (!onChange) return;
                  if (!multi) return onChange({ selected: [i] });
                  const next = chosen ? sel.filter((x) => x !== i) : [...sel, i].slice(-choose);
                  onChange({ selected: next.sort((a, b) => a - b) });
                }}
              />
              <span className="qv-letter">{String.fromCharCode(65 + i)}</span>
              <span className="user-text">{o}</span>
              {state === "correct" && <I.CheckCircle size={15} aria-label={t("quiz.correct")} />}
              {state === "wrong" && <I.XCircle size={15} aria-label={t("quiz.wrong")} />}
            </label>
          );
        })}
      </div>
    );
  } else if (mech === "enum") {
    const vals = enumValues(q.type);
    body = (
      <div className="qv-enum" role="radiogroup" aria-label={q.prompt}>
        {vals.map((v) => {
          const chosen = (response?.value ?? "").toUpperCase() === v;
          const right = (ca?.value ?? "").toUpperCase() === v;
          const state = result ? (show ? (right ? "correct" : chosen ? "wrong" : "dim") : chosen ? (right ? "correct" : "wrong") : "dim") : chosen ? "chosen" : undefined;
          return (
            <button key={v} type="button" role="radio" aria-checked={chosen} disabled={ro} className={cn("qv-enum-btn", state)} data-state={state} onClick={() => onChange?.({ value: v })} data-testid="qv-enum">
              {ENUM_LABEL[v]}
              {state === "correct" && <I.Check size={13} />}
            </button>
          );
        })}
      </div>
    );
  } else if (mech === "matching") {
    const items = q.data.items ?? [];
    const opts = matchingOptions(q.data);
    const map = response?.map ?? {};
    const textOf = (k: string) => opts.find((o) => o.key === k)?.text ?? "";
    body = (
      <div className="qv-match">
        <div className="qv-match-list" aria-label={t("ielts.optionsList")}>
          <p className="qv-match-title">{t(q.type === "MATCHING_HEADINGS" ? "ielts.listHeadings" : q.type === "MATCHING_SENTENCE_ENDINGS" ? "ielts.listEndings" : q.type === "MATCHING_FEATURES" ? "ielts.listFeatures" : "ielts.listInfo")}</p>
          {uniqueOptions(q.type) && !result && <p className="qv-hint">{t("ielts.uniqueHint")}</p>}
          <ul>
            {opts.map((o) => (
              <li key={o.key}>
                <b>{o.key}</b>
                <span className="user-text">{o.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <ol className="qv-match-items">
          {items.map((it, i) => {
            const mine = map[String(i)] ?? "";
            const right = ca?.map?.[String(i)];
            const ok = result ? mine === right : undefined;
            return (
              <li key={i} className={cn("qv-match-row", result && (ok ? "correct" : "wrong"))} data-testid="qv-match-row">
                <span className="qv-num">{start + i}</span>
                <span className="qv-match-text user-text">{it}</span>
                <select className="input sm qv-select" value={mine} disabled={ro} onChange={(e) => onChange?.({ map: { ...map, [String(i)]: e.target.value } })} aria-label={`${start + i}. ${it}`} data-testid="qv-match-select">
                  <option value="">—</option>
                  {opts.map((o) => {
                    // IELTS: sarlavha / gap tugatmasi bir marta — boshqa elementda tanlangani o'chiq
                    const taken = uniqueOptions(q.type) && o.key !== mine && Object.entries(map).some(([k, v]) => k !== String(i) && v === o.key);
                    return (
                      <option key={o.key} value={o.key} disabled={taken}>
                        {o.key}
                        {taken ? " ✓" : ""}
                      </option>
                    );
                  })}
                </select>
                {result && (ok ? <I.CheckCircle size={15} className="text-success" /> : <I.XCircle size={15} className="text-danger" />)}
                {show && !ok && right && (
                  <span className="qv-fix" data-testid="qv-fix">
                    {t("quiz.correct")}: <b>{right}</b> <span className="user-text">— {textOf(right)}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    );
  } else {
    // ---- text: bo'sh joylar
    const n = Number(q.data.blanks) || 0;
    const vals = Array.from({ length: n }, (_, i) => response?.blanks?.[i] ?? "");
    const limit = Number(q.data.word_limit) || 0;
    const blankOk = (i: number) => {
      const acc = ca?.blanks?.[i] ?? [];
      return acc.some((a) => norm(a) === norm(vals[i] ?? "")) && !!norm(vals[i] ?? "");
    };
    // Oddiy funksiya (komponent emas): render ichida e'lon qilingan komponent har bosishda qayta yaratilib, fokus yo'qolardi
    let bi = 0;
    const blank = (key: number | string) => {
      const i = bi++;
      if (i >= n)
        return (
          <span key={key} className="qv-gap">
            ___
          </span>
        );
      const v = vals[i];
      const over = limit > 0 && wordCount(v) > limit;
      const state = result ? (blankOk(i) ? "correct" : "wrong") : over ? "over" : undefined;
      return (
        <span key={key} className={cn("qv-blank", state)} data-state={state}>
          <input
            className="qv-blank-input"
            value={v}
            disabled={ro}
            placeholder={result ? "—" : String(start + i)}
            aria-label={t("ielts.blankN", { n: start + i })}
            size={Math.max(6, Math.min(26, v.length + 2))}
            onChange={(e) => onChange?.({ blanks: vals.map((x, k) => (k === i ? e.target.value : x)) })}
            data-testid="qv-blank"
          />
          {result && (blankOk(i) ? <I.Check size={12} /> : <I.X size={12} />)}
        </span>
      );
    };
    const line = (s: string, key: number) => (
      <Fragment key={key}>
        {splitBlanks(s).map((part, k) =>
          part === null ? (
            blank(k)
          ) : (
            <span key={k} className="user-text">
              {part}
            </span>
          ),
        )}
      </Fragment>
    );
    const { image, rest: text } = splitImage((q.data.text ?? "").replace(/\r\n/g, "\n"));
    let layout: ReactNode;
    if (!text.trim()) {
      layout = (
        <ol className="qv-blank-list">
          {vals.map((_, i) => (
            <li key={i}>
              <span className="qv-num">{start + i}</span>
              {blank("b")}
            </li>
          ))}
        </ol>
      );
    } else if (q.type === "TABLE_COMPLETION" && text.includes("|")) {
      const rows = text.split("\n").filter((r) => r.trim());
      layout = (
        <div className="qv-table-wrap">
          <table className="qv-table">
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.split("|").map((c, ci) => (ri === 0 ? <th key={ci}>{line(c.trim(), ci)}</th> : <td key={ci}>{line(c.trim(), ci)}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else if (q.type === "FLOW_CHART_COMPLETION") {
      const steps = text.split("\n").filter((r) => r.trim());
      layout = (
        <ol className="qv-flow">
          {steps.map((s, i) => (
            <li key={i} className="qv-flow-step">
              <div className="qv-flow-box">{line(s, i)}</div>
              {i < steps.length - 1 && <I.ArrowDown size={16} className="qv-flow-arrow" aria-hidden />}
            </li>
          ))}
        </ol>
      );
    } else if (q.type === "NOTE_COMPLETION" || q.type === "DIAGRAM_LABEL_COMPLETION") {
      layout = (
        <div className="qv-notes">
          {text.split("\n").map((s, i) => {
            const bullet = /^\s*[-•*]\s+/.test(s);
            return (
              <p key={i} className={cn("qv-note-line", bullet && "bullet", !s.trim() && "gap")}>
                {line(s.replace(/^\s*[-•*]\s+/, ""), i)}
              </p>
            );
          })}
        </div>
      );
    } else {
      layout = (
        <div className="qv-passage">
          {text.split("\n").map((s, i) => (
            <p key={i}>{line(s, i)}</p>
          ))}
        </div>
      );
    }
    body = (
      <div className="qv-text">
        {limit > 0 && (
          <p className="qv-hint" data-testid="qv-word-limit">
            <I.Info size={12} />
            {t("ielts.wordLimit", { n: limit })}
          </p>
        )}
        {image && <Figure src={image.src} alt={image.alt} />}
        {layout}
        {show && vals.some((_, i) => !blankOk(i)) && (
          <ul className="qv-fixes" data-testid="qv-fix">
            {vals.map((_, i) =>
              blankOk(i) ? null : (
                <li key={i}>
                  <span className="qv-num sm">{start + i}</span>
                  <span className="user-text">{(ca?.blanks?.[i] ?? []).join(" / ") || "—"}</span>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className={cn("qv", verdict && `is-${verdict}`)} data-testid="quiz-question" data-type={q.type} data-result={verdict} data-qid={q.id}>
      <p className="qv-prompt">
        <span className="qv-num">{result ? result.is_correct ? <I.Check size={13} /> : result.score > 0 ? "½" : <I.X size={13} /> : range}</span>
        <span className="user-text">{q.prompt}</span>
      </p>
      {result && (
        <p className={cn("qv-verdict", verdict)} data-testid="quiz-verdict">
          {verdict === "correct" ? <I.CheckCircle size={13} /> : verdict === "partial" ? <I.AlertTriangle size={13} /> : <I.XCircle size={13} />}
          {verdict === "correct" ? t("quiz.verdictOk") : verdict === "partial" ? t("ielts.partial", { score: result.score, max: result.max_score }) : t("quiz.verdictBad")}
          {result.max_score > 1 && verdict !== "partial" && <span className="qv-pts">· {t("ielts.points", { score: result.score, max: result.max_score })}</span>}
        </p>
      )}
      {body}
      {show && expl.text && (
        <p className="quiz-expl" data-testid="quiz-explanation">
          <I.Info size={13} />
          <span className="user-text">{expl.text}</span>
        </p>
      )}
      {result && expl.page && onShowPage && (show || verdict !== "correct") && (
        <button type="button" className="qv-show-page" onClick={() => onShowPage(expl.page!)} data-testid="qv-show-page">
          <I.BookOpen size={13} />
          {t("ielts.showInText", { n: expl.page })}
        </button>
      )}
    </div>
  );
}

/** 88.2: diagramma rasmi — bosilsa kattalashadi (Esc / bosish — yopiladi); yuklanmasa — xabar */
function Figure({ src, alt }: { src: string; alt: string }) {
  const { t } = useT();
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);
  if (failed)
    return (
      <p className="qv-figure-fail" data-testid="qv-figure-fail">
        <I.Image size={14} />
        {t("ielts.imageFailed")}
      </p>
    );
  return (
    <figure className="qv-figure" data-testid="qv-figure">
      <button type="button" onClick={() => setZoom(true)} aria-label={t("ielts.imageZoom")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- admin kiritgan tashqi havola (o'lchami noma'lum) */}
        <img src={src} alt={alt} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      </button>
      {zoom &&
        createPortal(
          <div className="qv-figure-zoom" role="dialog" aria-label={alt || t("ielts.imageZoom")} onClick={() => setZoom(false)} data-testid="qv-figure-zoom">
          {/* eslint-disable-next-line @next/next/no-img-element -- yuqoridagi rasmning kattasi */}
          <img src={src} alt={alt} referrerPolicy="no-referrer" />
          </div>,
          document.body,
        )}
    </figure>
  );
}
