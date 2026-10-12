"use client";

/**
 * 44.5 → 87: maqola testi (reader yon paneli) — IELTS Reading uslubidagi 13 savol turi. O'quvchi o'zini sinashi uchun.
 *  - Ketma-ket bir xil turdagi savollar — bitta guruh, IELTS kabi ko'rsatma bilan ("Savollar 3–7");
 *  - raqamlash ballar bo'yicha: matching elementi va bo'sh joy — alohida raqam;
 *  - javoblar tab almashganda yo'qolmaydi (sessionStorage, yuborilguncha);
 *  - bo'sh javob bilan ham tekshirish mumkin (IELTS'da bo'sh = 0 ball) — tasdiq so'raladi;
 *  - natija: umumiy ball va foiz, har savol — to'g'ri / qisman / xato;
 *  - 93: to'g'ri javoblar va izohlar — bitta tugma: o'quvchi xohlasa ko'rsatadi, xohlasa yashiradi;
 *  - natija tab almashsa / "Matnda ko'rsatish" (telefonda panel yopiladi) dan keyin ham saqlanadi;
 *  - mehmon (tekin kitob): savollarni ko'radi; server natija uchun kirishni talab qilsa — kirish havolasi.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Button, cn, useConfirm } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { QuestionView } from "@/components/quiz/question-view";
import { errorMessage, isApiError, quizApi, type QuestionResponse, type QuizQuestion, type QuizResult } from "@/lib/api";
import { missingParts, responseFor } from "@/lib/quiz/ielts";
import { useT, type DictKey } from "@/i18n";

const draftKey = (articleId: string) => `a365.quiz.${articleId}`;
const resultKey = (articleId: string) => `a365.quiz.res.${articleId}`;
const focusKey = (articleId: string) => `a365.quiz.focus.${articleId}`;

interface Saved {
  result: QuizResult;
  responses: Record<string, QuestionResponse>;
  revealed: boolean;
}

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private rejim */
  }
}

export function QuizPanel({ articleId, questions, onShowPage }: { articleId: string; questions: QuizQuestion[]; onShowPage?: (page: number) => void }) {
  const { t } = useT();
  const confirm = useConfirm();
  const csr = typeof window !== "undefined";
  const [saved] = useState<Saved | null>(() => (csr ? read<Saved>(resultKey(articleId)) : null));
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>(() => saved?.responses ?? (csr ? (read<Record<string, QuestionResponse>>(draftKey(articleId)) ?? {}) : {}));
  const [result, setResult] = useState<QuizResult | null>(saved?.result ?? null);
  const [revealed, setRevealed] = useState(saved?.revealed ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sorted = useMemo(() => [...questions].sort((a, b) => a.order_index - b.order_index), [questions]);

  // Javoblar qoralamasi — tab almashsa ham saqlanadi (yuborilguncha)
  useEffect(() => {
    if (Object.keys(responses).length && !result) write(draftKey(articleId), responses);
  }, [responses, result, articleId]);
  // Natija — panel qayta ochilganda ham (telefonda "Matnda ko'rsatish" panelni yopadi)
  useEffect(() => {
    write(resultKey(articleId), result ? ({ result, responses, revealed } satisfies Saved) : null);
  }, [result, responses, revealed, articleId]);
  // "Matnda ko'rsatish" dan qaytilganda — o'sha savolga
  useEffect(() => {
    const id = read<string>(focusKey(articleId));
    if (!id) return;
    write(focusKey(articleId), null);
    requestAnimationFrame(() => rootRef.current?.querySelector(`[data-qid="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center" }));
  }, [articleId]);

  // Raqamlar (ballar bo'yicha) va guruhlar (ketma-ket bir xil tur)
  const layout = useMemo(() => {
    let n = 1;
    const groups: Array<{ type: QuizQuestion["type"]; from: number; to: number; items: Array<{ q: QuizQuestion; start: number }> }> = [];
    for (const q of sorted) {
      const start = n;
      n += Math.max(1, q.points);
      const last = groups[groups.length - 1];
      if (last && last.type === q.type) {
        last.items.push({ q, start });
        last.to = n - 1;
      } else groups.push({ type: q.type, from: start, to: n - 1, items: [{ q, start }] });
    }
    return { groups, total: n - 1 };
  }, [sorted]);
  const missing = sorted.reduce((s, q) => s + missingParts(q, responses[q.id]), 0);
  const filled = layout.total - missing;
  const byId = new Map(result?.results.map((r) => [r.question_id, r]) ?? []);
  const counts = result
    ? {
        ok: result.results.filter((r) => r.is_correct).length,
        part: result.results.filter((r) => !r.is_correct && r.score > 0).length,
        bad: result.results.filter((r) => !r.is_correct && r.score <= 0).length,
      }
    : null;

  const submit = async () => {
    if (missing > 0) {
      const ok = await confirm({ title: t("ielts.emptyTitle"), message: t("ielts.emptyBody", { n: missing }), confirmLabel: t("ielts.checkAnyway") });
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await quizApi.submit(
        articleId,
        sorted.map((q) => ({ question_id: q.id, response: responseFor(q, responses[q.id]) })),
      );
      setResult(res);
      setRevealed(false);
      write(draftKey(articleId), null);
      // Natija (ball) panel boshida — o'sha yerga
      requestAnimationFrame(() => rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
    } catch (e) {
      if (isApiError(e) && e.status === 401) setNeedLogin(true);
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const retry = () => {
    setResult(null);
    setResponses({});
    setRevealed(false);
  };
  const showPage = onShowPage
    ? (qid: string) => (page: number) => {
        write(focusKey(articleId), qid);
        onShowPage(page);
      }
    : null;

  return (
    <div className="quiz" ref={rootRef} data-testid="quiz-panel">
      <p className="quiz-intro">{t("ielts.intro", { n: layout.total })}</p>

      {result && counts && (
        <div className={cn("quiz-score", result.percentage >= 70 ? "good" : "low")} data-testid="quiz-score">
          <strong>
            {result.score} / {result.total}
          </strong>
          <span>{t("quiz.percent", { n: Math.round(result.percentage) })}</span>
          <span className="quiz-score-msg">{t(result.percentage === 100 ? "quiz.perfect" : result.percentage >= 70 ? "quiz.good" : "quiz.low")}</span>
          <span className="quiz-score-sum" data-testid="quiz-summary">
            <i className="ok" aria-hidden />
            {t("ielts.sumOk", { n: counts.ok })}
            {counts.part > 0 && (
              <>
                <i className="part" aria-hidden />
                {t("ielts.sumPart", { n: counts.part })}
              </>
            )}
            <i className="bad" aria-hidden />
            {t("ielts.sumBad", { n: counts.bad })}
          </span>
        </div>
      )}
      {result && (
        <Button variant="secondary" className="w-full" onClick={() => setRevealed((v) => !v)} icon={revealed ? <I.EyeOff size={15} /> : <I.Eye size={15} />} aria-pressed={revealed} data-testid="quiz-reveal">
          {t(revealed ? "ielts.hide" : "ielts.reveal")}
        </Button>
      )}

      <div className="quiz-groups">
        {layout.groups.map((g, gi) => (
          <section key={gi} className="quiz-group" data-testid="quiz-group" data-type={g.type}>
            <header className="quiz-group-head">
              <p className="quiz-group-range">{g.from === g.to ? t("ielts.questionN", { n: g.from }) : t("ielts.questionsRange", { from: g.from, to: g.to })}</p>
              <p className="quiz-group-instr">{t(`ielts.instr.${g.type}` as DictKey)}</p>
            </header>
            {g.items.map(({ q, start }) => (
              <QuestionView
                key={q.id}
                q={q}
                start={start}
                response={responses[q.id]}
                result={byId.get(q.id) ?? null}
                reveal={revealed}
                disabled={busy}
                onChange={(r) => setResponses((s) => ({ ...s, [q.id]: r }))}
                onShowPage={showPage?.(q.id)}
              />
            ))}
          </section>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}
      {needLogin && (
        <div data-testid="quiz-login">
          <Alert tone="info">
            {t("quiz.loginToCheck")}{" "}
            <Link href={`/login?next=${encodeURIComponent(`/reader/${articleId}`)}`} className="font-bold underline">
              {t("auth.login")}
            </Link>
          </Alert>
        </div>
      )}

      {result ? (
        <Button variant="secondary" className="w-full" onClick={retry} icon={<I.RotateCcw size={15} />} data-testid="quiz-retry">
          {t("quiz.retry")}
        </Button>
      ) : (
        <Button className="w-full" onClick={() => void submit()} loading={busy} disabled={filled === 0} data-testid="quiz-submit">
          {t("quiz.check", { done: filled, total: layout.total })}
        </Button>
      )}
    </div>
  );
}
