"use client";

/**
 * 124: reader toolbar'idagi musiqa — chap qism BIR bosishda yoqadi/to'xtatadi (oxirgi trek yoki birinchisi),
 * o'ngdagi kichik o'q — panel: trek/kayfiyat, ovoz, takrorlash, uyqu taymeri. Faqat admin yuklagan treklar:
 * faol trek yo'q bo'lsa (bo'sh ro'yxat, 404 yoki tarmoq xatosi) boshqaruv umuman ko'rsatilmaydi.
 * `M` tugmasi — yoqish/to'xtatish. Hech qachon o'zi boshlanmaydi.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { cn, Switch } from "@/components/ui";
import { DropdownPanel, useOutsideClose } from "@/components/ui/dropdown";
import * as I from "@/components/ui/icons";
import { useT, type DictKey } from "@/i18n";
import { MUSIC_MOODS } from "@/lib/api/music";
import { loadTracks, next, play, setLoop, setSleep, setVolume, toggle, useMusic, type MusicSource } from "@/lib/music/engine";

const SLEEP = [0, 15, 30, 60];

function useMusicTitle() {
  const { t } = useT();
  const m = useMusic();
  return (src: MusicSource | null) => m.tracks?.find((x) => x.id === src?.id)?.title ?? t("music.title");
}

export function MusicControl({ className }: { className?: string }) {
  const { t } = useT();
  const m = useMusic();
  const titleOf = useMusicTitle();
  const [open, setOpen] = useState(false);
  const caretRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(open, [groupRef, panelRef], close);
  const id = useId();

  // Ro'yxat oldindan (bir bosishda darhol o'ynasin)
  useEffect(() => {
    void loadTracks();
  }, []);

  const hasTracks = !!m.tracks?.length;

  // `M` — yoqish/to'xtatish (matn yozilayotganda emas; treklar bo'lmasa — jim)
  useEffect(() => {
    if (!hasTracks) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== "m") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasTracks]);

  // O'ynaydigan narsa yo'q — bo'sh pleyer o'rniga hech narsa (yuklanayotganda ham)
  if (!hasTracks) return null;

  const label = m.playing ? t("music.pause", { title: titleOf(m.source) }) : t("music.play");
  return (
    <div ref={groupRef} className={cn("music-ctl", m.playing && "on", className)} data-testid="music-control" data-playing={m.playing ? "1" : "0"}>
      <button type="button" className="music-main" onClick={toggle} aria-pressed={m.playing} aria-label={label} title={`${label} (M)`} data-testid="music-toggle">
        {m.playing ? <Bars busy={m.buffering} /> : <I.Music size={18} />}
      </button>
      <button
        ref={caretRef}
        type="button"
        className="music-caret"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={t("music.choose")}
        title={t("music.choose")}
        data-testid="music-open"
      >
        <I.ChevronDown size={14} />
      </button>
      {open && (
        <DropdownPanel triggerRef={groupRef} panelRef={panelRef} align="end" minWidth={300} variant="plain" className="music-panel" id={id} role="dialog" aria-label={t("music.title")}>
          <MusicPanel />
        </DropdownPanel>
      )}
    </div>
  );
}

function Bars({ busy }: { busy: boolean }) {
  return (
    <span className={cn("eq", busy && "busy")} aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

function MusicPanel() {
  const { t } = useT();
  const m = useMusic();
  const titleOf = useMusicTitle();
  const [mood, setMood] = useState<string>("ALL");
  const tracks = m.tracks ?? [];
  const moods = MUSIC_MOODS.filter((x) => tracks.some((tr) => tr.mood === x));
  const shown = mood === "ALL" ? tracks : tracks.filter((x) => x.mood === mood);
  const pick = (id: string) => (m.source?.id === id && m.playing ? undefined : void play({ kind: "track", id }));
  const sleepLeft = useSleepLeft(m.sleepAt);

  return (
    <div className="music-body" data-testid="music-panel">
      <div className="music-now">
        <button type="button" className="music-big" onClick={toggle} aria-label={m.playing ? t("music.pauseShort") : t("music.play")} data-testid="music-panel-toggle">
          {m.playing ? <I.Pause size={18} /> : <I.Play size={16} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="music-now-title truncate">{titleOf(m.source ?? null)}</p>
          <p className="music-now-sub">{m.error ? t("music.error") : m.playing ? (m.buffering ? t("music.loading") : t("music.playing")) : t("music.paused")}</p>
        </div>
        {m.source && tracks.length > 1 && (
          <button type="button" className="icon-btn plain sm" onClick={() => void next()} aria-label={t("music.next")} title={t("music.next")}>
            <I.SkipForward size={16} />
          </button>
        )}
      </div>

      {moods.length > 1 && (
        <div className="music-moods" role="group" aria-label={t("music.mood")}>
          {["ALL", ...moods].map((x) => (
            <button key={x} type="button" className={cn("music-mood", mood === x && "active")} aria-pressed={mood === x} onClick={() => setMood(x)}>
              {x === "ALL" ? t("music.mood.ALL") : t(`music.mood.${x}` as DictKey)}
            </button>
          ))}
        </div>
      )}
      <ul className="music-list" data-testid="music-tracks">
        {shown.map((tr) => {
          const on = m.source?.id === tr.id;
          return (
            <li key={tr.id}>
              <button type="button" className={cn("music-item", on && "active")} onClick={() => pick(tr.id)} aria-current={on ? "true" : undefined} data-testid="music-track">
                <span className="music-item-ic">{on && m.playing ? <Bars busy={m.buffering} /> : <I.Play size={11} />}</span>
                <span className="min-w-0 flex-1 truncate">{tr.title}</span>
                <span className="music-item-meta">{tr.duration_seconds ? fmtDur(tr.duration_seconds) : t(`music.mood.${tr.mood}` as DictKey)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="music-row">
        <I.Volume size={16} className="shrink-0 text-muted" />
        <Slider value={m.volume} onChange={setVolume} label={t("music.volume")} />
      </div>
      <div className="music-row justify-between">
        <span className="text-[13px] font-semibold text-text-2">{t("music.loop")}</span>
        <Switch checked={m.loop} onChange={setLoop} aria-label={t("music.loop")} data-testid="music-loop" />
      </div>
      <div className="music-row flex-wrap">
        <span className="mr-auto text-[13px] font-semibold text-text-2">
          {t("music.sleep")}
          {sleepLeft && <span className="ml-1.5 font-bold text-text tabular-nums">· {sleepLeft}</span>}
        </span>
        <div className="music-sleep" role="group" aria-label={t("music.sleep")}>
          {SLEEP.map((n) => {
            const on = n === 0 ? !m.sleepAt : false;
            return (
              <button key={n} type="button" className={cn("music-mood", on && "active")} onClick={() => setSleep(n)} data-testid={`music-sleep-${n}`}>
                {n === 0 ? t("music.sleepOff") : t("music.minutes", { n })}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function useSleepLeft(at: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!at) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [at]);
  if (!at) return null;
  const s = Math.max(0, Math.round((at - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Qo'lbola slider (role=slider): sichqoncha/barmoq bilan sudrash, ←/→ va Home/End — 5% qadam */
function Slider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const setFrom = (x: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    onChange(Math.min(1, Math.max(0, (x - r.left) / r.width)));
  };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setFrom(e.clientX);
  };
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05 }[e.key];
    if (step !== undefined || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      // reader'ning ←/→ (bet varaqlash) yorliqlariga yetib bormasin
      e.stopPropagation();
      onChange(e.key === "Home" ? 0 : e.key === "End" ? 1 : Math.min(1, Math.max(0, Math.round((value + (step ?? 0)) * 20) / 20)));
    }
  };
  return (
    <div
      ref={ref}
      className="slider"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      onPointerDown={onDown}
      onPointerMove={(e) => e.buttons === 1 && setFrom(e.clientX)}
      onKeyDown={onKey}
      data-testid="music-volume"
    >
      <span className="slider-track">
        <span className="slider-fill" style={{ width: `${value * 100}%` }} />
      </span>
      <span className="slider-thumb" style={{ left: `${value * 100}%` }} />
    </div>
  );
}
