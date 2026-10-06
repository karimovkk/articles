"use client";

/**
 * 44.5: maqola testi (reader yon paneli). Savollar — to'g'ri javobsiz; hammasiga javob berilgach "Tekshirish" →
 * `POST /reader/articles/{id}/quiz` → ball, foiz, har savolda to'g'ri javob va izoh. "Qayta yechish" — boshidan.
 * 53: natijada to'g'ri topilgan savol — yashil, xatosi — qizil (belgi + "To'g'ri"/"Xato" yozuvi, rang yolg'iz emas);
 * xato savolda tanlangan javob "Sizning javobingiz", to'g'risi "To'g'ri javob" va alohida qatorda yoziladi.
 * Mehmon (tekin kitob): savollarni ko'radi; server natija uchun kirishni talab qilsa — kirish havolasi.
 */
import { useRef, useState } from "react";
import Link from "next/link";
import { Alert, Button, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { errorMessage, isApiError, quizApi, type QuizQuestion, type QuizResult } from "@/lib/api";
import { useT } from "@/i18n";

export function QuizPanel({ articleId, questions }: { articleId: string; questions: QuizQuestion[] }) {
  const { t } = useT();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sorted = [...questions].sort((a, b) => a.order_index - b.order_index);
  const answered = sorted.filter((q) => answers[q.id] !== undefined).length;
  const byId = new Map(result?.results.map((r) => [r.question_id, r]) ?? []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await quizApi.submit(articleId, sorted.map((q) => ({ question_id: q.id, selected_index: answers[q.id] }))));
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
    setAnswers({});
  };

  return (
    <div className="quiz" ref={rootRef} data-testid="quiz-panel">
      <p className="quiz-intro">{t("quiz.intro", { n: sorted.length })}</p>

      {result && (
        <div className={cn("quiz-score", result.percentage >= 70 ? "good" : "low")} data-testid="quiz-score">
          <strong>
            {result.score} / {result.total}
          </strong>
          <span>{t("quiz.percent", { n: Math.round(result.percentage) })}</span>
          <span className="quiz-score-msg">{t(result.percentage === 100 ? "quiz.perfect" : result.percentage >= 70 ? "quiz.good" : "quiz.low")}</span>
          <span className="quiz-score-sum" data-testid="quiz-summary">
            <i className="ok" aria-hidden />
            {t("quiz.summaryOk", { n: result.score })}
            <i className="bad" aria-hidden />
            {t("quiz.summaryBad", { n: result.total - result.score })}
          </span>
        </div>
      )}

      <ol className="quiz-list">
        {sorted.map((q, qi) => {
          const r = byId.get(q.id);
          const verdict = r ? (r.is_correct ? "correct" : "wrong") : undefined;
          return (
            <li key={q.id} className={cn("quiz-q", verdict && `is-${verdict}`)} data-testid="quiz-question" data-result={verdict}>
              <p className="quiz-prompt">
                <span className="quiz-num">{r ? r.is_correct ? <I.Check size={13} /> : <I.X size={13} /> : qi + 1}</span>
                <span className="user-text">{q.prompt}</span>
              </p>
              {r && (
                <p className={cn("quiz-verdict", verdict)} data-testid="quiz-verdict">
                  {r.is_correct ? <I.CheckCircle size={13} /> : <I.XCircle size={13} />}
                  {t(r.is_correct ? "quiz.verdictOk" : "quiz.verdictBad")}
                </p>
              )}
              <div className="quiz-options" role="radiogroup" aria-label={q.prompt}>
                {q.options.map((opt, oi) => {
                  const chosen = answers[q.id] === oi;
                  const state = r ? (oi === r.correct_index ? "correct" : chosen ? "wrong" : "dim") : chosen ? "chosen" : undefined;
                  return (
                    <label key={oi} className={cn("quiz-opt", state)} data-state={state}>
                      <input type="radio" name={`q-${q.id}`} checked={chosen} disabled={!!r || busy} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} />
                      <span className="user-text">{opt}</span>
                      {/* Xato savolda: qaysi biri o'quvchiniki, qaysi biri to'g'ri — yozuv bilan */}
                      {r && !r.is_correct && state === "correct" && <span className="quiz-opt-tag">{t("quiz.correct")}</span>}
                      {state === "wrong" && <span className="quiz-opt-tag">{t("quiz.yourAnswer")}</span>}
                      {state === "correct" && <I.CheckCircle size={15} aria-label={t("quiz.correct")} />}
                      {state === "wrong" && <I.XCircle size={15} aria-label={t("quiz.wrong")} />}
                    </label>
                  );
                })}
              </div>
              {r && !r.is_correct && (
                <p className="quiz-answer" data-testid="quiz-correct-answer">
                  <I.CheckCircle size={14} />
                  <span>
                    {t("quiz.correct")}: <strong className="user-text">{q.options[r.correct_index]}</strong>
                  </span>
                </p>
              )}
              {r?.explanation && (
                <p className="quiz-expl" data-testid="quiz-explanation">
                  <I.Info size={13} />
                  <span>{r.explanation}</span>
                </p>
              )}
            </li>
          );
        })}
      </ol>

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
        <Button className="w-full" onClick={() => void submit()} loading={busy} disabled={answered < sorted.length} data-testid="quiz-submit">
          {t("quiz.check", { done: answered, total: sorted.length })}
        </Button>
      )}
    </div>
  );
}
