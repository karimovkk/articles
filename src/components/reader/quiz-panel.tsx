"use client";

/**
 * 44.5 → 87: maqola testi (reader yon paneli) — IELTS Reading uslubidagi 13 savol turi.
 *  - Ketma-ket bir xil turdagi savollar — bitta guruh, IELTS kabi ko'rsatma bilan ("Savollar 3–7");
 *  - raqamlash ballar bo'yicha: matching elementi va bo'sh joy — alohida raqam;
 *  - javoblar tab almashganda yo'qolmaydi (sessionStorage, yuborilguncha);
 *  - bo'sh javob bilan ham tekshirish mumkin (IELTS'da bo'sh = 0 ball) — tasdiq so'raladi;
 *  - natija: umumiy ball va foiz, har savol — to'g'ri / qisman / xato, element/bo'sh joy bo'yicha to'g'ri javoblar, izoh;
 *  - mehmon (tekin kitob): savollarni ko'radi; server natija uchun kirishni talab qilsa — kirish havolasi.
 * 88:
 *  - natijada to'g'ri javoblar va izohlar avval yashirin: o'quvchi xatolarini tuzatib qayta tekshiradi yoki
 *    "To'g'ri javoblarni ko'rsatish" ni bosadi (keyin — "Qayta yechish"); natija tab almashsa / "Matnda ko'rsatish"
 *    (telefonda panel yopiladi) dan keyin ham saqlanadi;
 *  - urinishlar tarixi (shu qurilmada, foydalanuvchi bo'yicha): urinish raqami, eng yaxshi natija — javoblar
 *    ko'rilgandan keyingi urinishlar eng yaxshisiga kirmaydi;
 *  - vaqt bilan yechish (ixtiyoriy): IELTS tempi — har ballga 1,5 daqiqa; tab almashsa ham davom etadi; tugasa —
 *    javoblar avtomatik tekshiriladi.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Button, cn, formatDate, useConfirm } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { QuestionView } from "@/components/quiz/question-view";
import { errorMessage, isApiError, quizApi, type QuestionResponse, type QuizQuestion, type QuizResult } from "@/lib/api";
import { missingParts, responseFor } from "@/lib/quiz/ielts";
import { useAuth } from "@/providers/auth-provider";
import { useT, type DictKey } from "@/i18n";

const draftKey = (articleId: string) => `a365.quiz.${articleId}`;
const resultKey = (articleId: string) => `a365.quiz.res.${articleId}`;
const timerKey = (articleId: string) => `a365.quiz.timer.${articleId}`;
const focusKey = (articleId: string) => `a365.quiz.focus.${articleId}`;
const attemptsKey = (uid: string, articleId: string) => `a365.quiz.attempts.${uid}.${articleId}`;

interface Saved {
  result: QuizResult;
  responses: Record<string, QuestionResponse>;
  revealed: boolean;
  secs: number | null;
  timedOut: boolean;
}
interface Attempt {
  at: number;
  score: number;
  total: number;
  pct: number;
  secs: number | null;
  /** To'g'ri javoblar oldin ko'rilgan — eng yaxshi natijaga kirmaydi */
  afterReveal: boolean;
}
interface Attempts {
  list: Attempt[];
  revealedAt: number | null;
}
interface Timer {
  startedAt: number;
  deadline: number;
}

function read<T>(storage: "session" | "local", key: string): T | null {
  try {
    const raw = (storage === "session" ? sessionStorage : localStorage).getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(storage: "session" | "local", key: string, value: unknown) {
  try {
    const s = storage === "session" ? sessionStorage : localStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, JSON.stringify(value));
  } catch {
    /* private rejim */
  }
}
const mmss = (secs: number) => `${Math.floor(Math.max(0, secs) / 60)}:${String(Math.floor(Math.max(0, secs) % 60)).padStart(2, "0")}`;

export function QuizPanel({ articleId, questions, onShowPage }: { articleId: string; questions: QuizQuestion[]; onShowPage?: (page: number) => void }) {
  const { t } = useT();
  const confirm = useConfirm();
  const { user } = useAuth();
  const aKey = attemptsKey(user?.id ?? "guest", articleId);
  const csr = typeof window !== "undefined";
  const [saved] = useState<Saved | null>(() => (csr ? read<Saved>("session", resultKey(articleId)) : null));
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>(() => saved?.responses ?? (csr ? (read<Record<string, QuestionResponse>>("session", draftKey(articleId)) ?? {}) : {}));
  const [result, setResult] = useState<QuizResult | null>(saved?.result ?? null);
  const [revealed, setRevealed] = useState(saved?.revealed ?? false);
  const [secs, setSecs] = useState<number | null>(saved?.secs ?? null);
  const [timedOut, setTimedOut] = useState(saved?.timedOut ?? false);
  const [attempts, setAttempts] = useState<Attempts>(() => (csr ? read<Attempts>("local", aKey) : null) ?? { list: [], revealedAt: null });
  const [timer, setTimer] = useState<Timer | null>(() => (csr && !saved ? read<Timer>("session", timerKey(articleId)) : null));
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false); // qo'lda va avtomatik (vaqt tugadi) tekshiruv bir vaqtda ketmasin
  const sorted = useMemo(() => [...questions].sort((a, b) => a.order_index - b.order_index), [questions]);

  // Javoblar qoralamasi — tab almashsa ham saqlanadi (yuborilguncha)
  useEffect(() => {
    if (Object.keys(responses).length && !result) write("session", draftKey(articleId), responses);
  }, [responses, result, articleId]);
  // Natija — panel qayta ochilganda ham (telefonda "Matnda ko'rsatish" panelni yopadi)
  useEffect(() => {
    write("session", resultKey(articleId), result ? ({ result, responses, revealed, secs, timedOut } satisfies Saved) : null);
  }, [result, responses, revealed, secs, timedOut, articleId]);
  useEffect(() => write("session", timerKey(articleId), timer), [timer, articleId]);
  // "Matnda ko'rsatish" dan qaytilganda — o'sha savolga
  useEffect(() => {
    const id = read<string>("session", focusKey(articleId));
    if (!id) return;
    write("session", focusKey(articleId), null);
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
  const honest = attempts.list.filter((a) => !a.afterReveal);
  const best = honest.length ? honest.reduce((b, a) => (a.pct > b.pct ? a : b)) : null;
  const minutes = Math.max(2, Math.ceil(layout.total * 1.5));
  const left = timer ? Math.ceil((timer.deadline - now) / 1000) : null;

  const saveAttempts = (next: Attempts) => {
    setAttempts(next);
    write("local", aKey, next);
  };

  const submit = useCallback(
    async (auto = false) => {
      if (!auto && missing > 0) {
        const ok = await confirm({ title: t("ielts.emptyTitle"), message: t("ielts.emptyBody", { n: missing }), confirmLabel: t("ielts.checkAnyway") });
        if (!ok) return;
      }
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      const used = timer ? Math.round((Math.min(Date.now(), timer.deadline) - timer.startedAt) / 1000) : null;
      if (auto) setTimer(null); // bir marta (server xatosida qayta-qayta yubormaslik uchun)
      try {
        const res = await quizApi.submit(
          articleId,
          sorted.map((q) => ({ question_id: q.id, response: responseFor(q, responses[q.id]) })),
        );
        const perfect = res.percentage >= 100;
        setResult(res);
        setRevealed(perfect);
        setSecs(used);
        setTimedOut(auto);
        setTimer(null);
        const prev = read<Attempts>("local", aKey) ?? { list: [], revealedAt: null };
        const next: Attempts = {
          list: [...prev.list, { at: Date.now(), score: res.score, total: res.total, pct: Math.round(res.percentage), secs: used, afterReveal: prev.revealedAt !== null }].slice(-30),
          revealedAt: perfect ? (prev.revealedAt ?? Date.now()) : prev.revealedAt,
        };
        saveAttempts(next);
        write("session", draftKey(articleId), null);
        // Natija (ball) panel boshida — o'sha yerga
        requestAnimationFrame(() => rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
      } catch (e) {
        if (isApiError(e) && e.status === 401) setNeedLogin(true);
        else setError(errorMessage(e));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saveAttempts: faqat setState + storage
    [missing, confirm, t, timer, articleId, sorted, responses, aKey],
  );

  // Taymer: har soniya; vaqt tugasa — avtomatik tekshiruv (bo'sh javoblar so'ralmaydi; `submit` taymerni o'chiradi)
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    if (!timer) return;
    const id = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= timer.deadline) void submitRef.current(true);
    }, 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  const startTimer = () => {
    const at = Date.now();
    setNow(at);
    setTimer({ startedAt: at, deadline: at + minutes * 60_000 });
  };
  const reveal = () => {
    setRevealed(true);
    if (attempts.revealedAt === null) saveAttempts({ ...attempts, revealedAt: Date.now() });
  };
  /** Javoblar saqlanadi — faqat xatolarni tuzatish */
  const amend = () => {
    setResult(null);
    setTimedOut(false);
    setSecs(null);
  };
  const retry = () => {
    setResult(null);
    setResponses({});
    setRevealed(false);
    setTimedOut(false);
    setSecs(null);
  };
  const showPage = onShowPage
    ? (qid: string) => (page: number) => {
        write("session", focusKey(articleId), qid);
        onShowPage(page);
      }
    : null;

  return (
    <div className="quiz" ref={rootRef} data-testid="quiz-panel">
      <p className="quiz-intro">{t("ielts.intro", { n: layout.total })}</p>

      {!result && attempts.list.length > 0 && (
        <p className="quiz-prev" data-testid="quiz-prev">
          <I.History size={13} />
          {t("ielts.prevAttempts", { n: attempts.list.length })}
          {best && <b>· {t("ielts.best", { score: best.score, total: best.total, pct: best.pct })}</b>}
        </p>
      )}

      {!result &&
        (timer ? (
          <div className={cn("quiz-timer", left !== null && left <= 60 && "low")} role="timer" aria-live="off" data-testid="quiz-timer">
            <I.Clock size={15} />
            <span>{t("ielts.timerLeft")}</span>
            <strong data-testid="quiz-timer-left">{mmss(left ?? 0)}</strong>
            <button type="button" className="quiz-timer-x" onClick={() => setTimer(null)} data-testid="quiz-timer-cancel">
              {t("ielts.timerCancel")}
            </button>
          </div>
        ) : (
          <button type="button" className="quiz-timer-start" onClick={startTimer} title={t("ielts.timerHint")} data-testid="quiz-timer-start">
            <I.Clock size={14} />
            {t("ielts.timerStart", { n: minutes })}
          </button>
        ))}

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
          <span className="quiz-score-meta" data-testid="quiz-attempt">
            {t("ielts.attemptN", { n: attempts.list.length })}
            {secs !== null && <> · {t("ielts.timeUsed", { t: mmss(secs) })}</>}
            {best && <> · {t("ielts.best", { score: best.score, total: best.total, pct: best.pct })}</>}
          </span>
        </div>
      )}
      {result && timedOut && <Alert tone="info">{t("ielts.timeout")}</Alert>}
      {result && !revealed && (
        <p className="quiz-hidden-note" data-testid="quiz-hidden-note">
          <I.EyeOff size={13} />
          {t("ielts.hiddenNote")}
        </p>
      )}
      {result && attempts.list.length > 1 && (
        <details className="quiz-history" data-testid="quiz-history">
          <summary>{t("ielts.attempts")}</summary>
          <ol>
            {[...attempts.list].reverse().map((a, i) => (
              <li key={a.at} className={cn(a.afterReveal && "after")}>
                <span>{attempts.list.length - i}.</span>
                <span>{formatDate(new Date(a.at).toISOString())}</span>
                <b>
                  {a.score} / {a.total} ({a.pct}%)
                </b>
                {a.secs !== null && <span>{mmss(a.secs)}</span>}
                {a.afterReveal && <em>{t("ielts.afterReveal")}</em>}
              </li>
            ))}
          </ol>
          <p>{t("ielts.attemptsNote")}</p>
        </details>
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
        revealed ? (
          <Button variant="secondary" className="w-full" onClick={retry} icon={<I.RotateCcw size={15} />} data-testid="quiz-retry">
            {t("quiz.retry")}
          </Button>
        ) : (
          <div className="quiz-actions">
            <Button className="w-full" onClick={amend} icon={<I.Pencil size={15} />} data-testid="quiz-amend">
              {t("ielts.amend")}
            </Button>
            <Button variant="secondary" className="w-full" onClick={reveal} icon={<I.Eye size={15} />} data-testid="quiz-reveal">
              {t("ielts.reveal")}
            </Button>
          </div>
        )
      ) : (
        <Button className="w-full" onClick={() => void submit()} loading={busy} disabled={filled === 0} data-testid="quiz-submit">
          {t("quiz.check", { done: filled, total: layout.total })}
        </Button>
      )}
    </div>
  );
}
