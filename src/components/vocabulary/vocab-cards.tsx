"use client";

/**
 * Takrorlash (33.5): kartalar — old tomonda so'z, aylantirilsa tarjima va kontekst. "Bilaman" — so'z o'rganilgan deb
 * belgilanadi va keyingisi; "Yana" — keyingisi (so'z o'rganilmoqda qoladi). Aralashtirish, progress, yakuniy ekran.
 * Klaviatura: Space/Enter — aylantirish, ← — yana, → — bilaman. Reduced-motion'da aylanish animatsiyasiz.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, EmptyState, IconButton, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import type { VocabEntry } from "@/lib/api";
import { canSpeak, speak } from "./speak";
import { pdfHref } from "./links";
import { useT } from "@/i18n";

/** Tasodifiy tartib (Fisher–Yates) — `seed` o'zgarganda qayta */
function shuffled(n: number, seed: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  let s = seed || 1;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function VocabCards({ entries, onLearned }: { entries: VocabEntry[]; onLearned: (v: VocabEntry) => Promise<void> }) {
  const { t } = useT();
  // Takrorlash to'plami rejim ochilgan paytdagi ro'yxatdan olinadi (o'rgandim bosilsa ro'yxatdan tushib ketmasin)
  const [deck, setDeck] = useState(entries);
  const [seed, setSeed] = useState(0);
  const order = useMemo(() => (seed ? shuffled(deck.length, seed) : deck.map((_, i) => i)), [deck, seed]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [busy, setBusy] = useState(false);

  // Filtr o'zgarsa (yangi ro'yxat) — takrorlash boshidan
  const [source, setSource] = useState(entries);
  const sameSet = entries.length === source.length && entries.every((e, i) => e.id === source[i]?.id);
  if (!sameSet) {
    setSource(entries);
    setDeck(entries);
    setPos(0);
    setFlipped(false);
    setKnown(0);
  }

  const done = pos >= order.length;
  const card = done ? null : deck[order[pos]];

  const next = () => {
    setFlipped(false);
    setPos((p) => p + 1);
  };
  const know = async () => {
    if (!card || busy) return;
    setBusy(true);
    try {
      if (!card.learned) await onLearned(card);
      setKnown((k) => k + 1);
      next();
    } finally {
      setBusy(false);
    }
  };
  const restart = (shuffle: boolean) => {
    setSeed(shuffle ? Math.floor(performance.now()) + 1 : 0);
    setPos(0);
    setFlipped(false);
    setKnown(0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || !card) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowLeft") next();
      else if (e.key === "ArrowRight") void know();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!deck.length) return <EmptyState icon={<I.Layers size={22} />} title={t("vocab.cards.empty")} />;

  if (done)
    return (
      <div className="flashcards-done card" data-testid="cards-done">
        <span className="flashcards-done-icon">
          <I.CheckCircle size={30} />
        </span>
        <h3>{t("vocab.cards.done")}</h3>
        <p>{t("vocab.cards.doneDesc")}</p>
        <p className="flashcards-score">
          {known} / {deck.length}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => restart(false)} icon={<I.RotateCcw size={16} />}>
            {t("vocab.cards.restart")}
          </Button>
          <Button variant="secondary" onClick={() => restart(true)} icon={<I.Shuffle size={16} />}>
            {t("vocab.cards.shuffle")}
          </Button>
        </div>
      </div>
    );

  return (
    <div className="flashcards" data-testid="flashcards">
      <div className="flashcards-top">
        <div className="progress flex-1">
          <i style={{ width: `${(pos / deck.length) * 100}%` }} />
        </div>
        <span className="flashcards-count" data-testid="cards-progress">
          {t("vocab.cards.progress", { i: pos + 1, n: deck.length })}
        </span>
        <IconButton size="sm" label={t("vocab.cards.shuffle")} onClick={() => restart(true)} data-testid="cards-shuffle">
          <I.Shuffle size={16} />
        </IconButton>
      </div>

      <button
        type="button"
        className={cn("flashcard", flipped && "is-flipped")}
        onClick={() => setFlipped((f) => !f)}
        aria-label={t("vocab.cards.flip")}
        aria-pressed={flipped}
        data-testid="flashcard"
      >
        <span className="flashcard-inner">
          <span className="flashcard-face front">
            <span className="flashcard-word user-text">{card!.word}</span>
            <span className="flashcard-hint">{t("vocab.cards.tapHint")}</span>
          </span>
          <span className="flashcard-face back">
            <span className="flashcard-word small user-text">{card!.word}</span>
            <span className={cn("flashcard-tr user-text", !card!.translation && "muted")} data-testid="flashcard-translation">
              {card!.translation ?? t("vocab.noTranslation")}
            </span>
            {card!.context && <span className="flashcard-context user-text">{card!.context}</span>}
          </span>
        </span>
      </button>

      <div className="flashcards-actions">
        <Button variant="secondary" onClick={next} icon={<I.ArrowLeft size={16} />} data-testid="cards-again">
          {t("vocab.cards.again")}
        </Button>
        {canSpeak() && (
          <IconButton label={t("vocab.listen")} onClick={() => speak(card!.word)}>
            <I.Volume size={18} />
          </IconButton>
        )}
        <Link href={pdfHref(card!)} className="icon-btn" aria-label={t("vocab.openInPdf")} title={t("vocab.openInPdf")}>
          <I.BookOpen size={18} />
        </Link>
        <Button onClick={() => void know()} loading={busy} icon={<I.Check size={16} />} data-testid="cards-know">
          {t("vocab.cards.know")}
        </Button>
      </div>
      <p className="flashcards-keys max-[640px]:hidden">{t("vocab.cards.hint")}</p>
    </div>
  );
}
