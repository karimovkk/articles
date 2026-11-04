"use client";

/**
 * 124: o'qish musiqasi — brauzerdagi yagona pleyer (reader layout'ida yashaydi: bet va maqola almashganda ham
 * to'xtamaydi). Manba — faqat admin yuklagan treklar (`<audio>`, BACKEND_TASKS.md 5-qism); o'rnatilgan
 * tovushlar yo'q: treklar bo'lmasa o'ynaydigan narsa ham yo'q (reader musiqa tugmasini ko'rsatmaydi).
 * Hech qachon o'zi boshlamaydi — faqat foydalanuvchi bosganda (`toggle`/`play`). Oxirgi trek, ovoz va
 * takrorlash localStorage'da eslab qolinadi; ovoz silliq kuchayadi/so'nadi.
 */
import { useSyncExternalStore } from "react";
import { musicApi, type MusicTrack } from "@/lib/api/music";

export type MusicSource = { kind: "track"; id: string };

export interface MusicState {
  /** null — hali yuklanmagan; [] — treklar yo'q (yoki backend'da endpoint yo'q) */
  tracks: MusicTrack[] | null;
  source: MusicSource | null;
  playing: boolean;
  /** Trek yuklanmoqda (tarmoq) */
  buffering: boolean;
  volume: number;
  loop: boolean;
  /** Uyqu taymeri tugash vaqti (epoch ms) */
  sleepAt: number | null;
  error: boolean;
}

const KEY = "a365.music";
const FADE_IN = 1200;
const FADE_OUT = 600;

let state: MusicState = { tracks: null, source: null, playing: false, buffering: false, volume: 0.6, loop: false, sleepAt: null, error: false };
let restored = false;
const listeners = new Set<() => void>();

function emit(patch: Partial<MusicState>) {
  state = { ...state, ...patch };
  if (patch.source !== undefined || patch.volume !== undefined || patch.loop !== undefined) persist();
  listeners.forEach((l) => l());
}

function restore() {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<MusicState> | null;
    if (v) {
      // faqat trek; eski "ambient" (o'rnatilgan tovushlar olib tashlangan) va boshqa noma'lum qiymatlar — e'tiborsiz
      const src = v.source as { kind?: unknown; id?: unknown } | null | undefined;
      const okSrc = src?.kind === "track" && typeof src.id === "string";
      state = { ...state, source: okSrc ? { kind: "track", id: src.id as string } : null, volume: typeof v.volume === "number" ? clamp01(v.volume) : state.volume, loop: !!v.loop };
    }
  } catch {
    /* buzilgan qiymat — standartlar */
  }
}
function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ source: state.source, volume: state.volume, loop: state.loop }));
  } catch {
    /* saqlab bo'lmadi (private mode) — sessiya davomida ishlayveradi */
  }
}
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function subscribe(l: () => void) {
  restore();
  listeners.add(l);
  return () => listeners.delete(l);
}
const getSnapshot = () => {
  restore();
  return state;
};
const SERVER: MusicState = state;
export function useMusic(): MusicState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER);
}

/* ---------------- treklar ---------------- */

let loading: Promise<void> | null = null;
export function loadTracks(force = false): Promise<void> {
  if (loading && !force) return loading;
  loading = musicApi
    .tracks()
    .then((list) => emit({ tracks: list ?? [] }))
    .catch(() => {
      // tarmoq xatosi — hozircha "treklar yo'q"; keyingi chaqiruv qayta urinadi
      loading = null;
      emit({ tracks: state.tracks ?? [] });
    });
  return loading;
}

/* ---------------- <audio> (treklar) ---------------- */

let audio: HTMLAudioElement | null = null;
let currentUrl = "";
let fadeRaf = 0;

function audioEl(): HTMLAudioElement {
  if (audio) return audio;
  const a = new Audio();
  a.preload = "auto";
  a.addEventListener("waiting", () => emit({ buffering: true }));
  a.addEventListener("playing", () => emit({ buffering: false, error: false }));
  a.addEventListener("canplay", () => emit({ buffering: false }));
  a.addEventListener("error", () => {
    if (state.source) emit({ playing: false, buffering: false, error: true });
  });
  a.addEventListener("ended", () => {
    // takrorlash o'chiq — ro'yxatdagi keyingi trek (oxiridan — boshiga)
    if (state.source && !state.loop) void next();
  });
  audio = a;
  return a;
}

/** `<audio>` ovozini silliq o'zgartirish (iOS `volume` ni e'tiborsiz qoldiradi — u yerda darhol) */
function fadeAudio(to: number, ms: number): Promise<void> {
  const a = audioEl();
  cancelAnimationFrame(fadeRaf);
  const from = a.volume;
  const t0 = performance.now();
  return new Promise((resolve) => {
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      a.volume = clamp01(from + (to - from) * k);
      if (k < 1) fadeRaf = requestAnimationFrame(step);
      else resolve();
    };
    fadeRaf = requestAnimationFrame(step);
  });
}

/* ---------------- boshqaruv ---------------- */

let seq = 0;

/** Eslab qolingan trek hali ro'yxatda bo'lsa — o'sha, aks holda birinchi trek; treklar yo'q — null */
function pickSource(): MusicSource | null {
  const list = state.tracks ?? [];
  const saved = state.source && list.some((t) => t.id === state.source!.id) ? state.source : null;
  return saved ?? (list[0] ? { kind: "track", id: list[0].id } : null);
}

export async function play(src?: MusicSource) {
  const my = ++seq;
  if (state.tracks === null) await loadTracks();
  if (my !== seq) return;
  const target = src ?? pickSource();
  const track = target && state.tracks?.find((t) => t.id === target.id);
  // o'ynaydigan narsa yo'q (treklar yo'q yoki trek o'chirilgan) — jim, xatosiz
  if (!target || !track) return emit({ playing: false, buffering: false });
  emit({ source: target, playing: true, error: false });

  const a = audioEl();
  const url = musicApi.streamUrl(track);
  if (currentUrl !== url) {
    a.src = url;
    currentUrl = url;
  }
  a.loop = state.loop;
  a.volume = 0;
  emit({ buffering: a.readyState < 3 });
  try {
    await a.play();
  } catch {
    if (my === seq) emit({ playing: false, buffering: false, error: true });
    return;
  }
  if (my !== seq) return;
  void fadeAudio(state.volume, FADE_IN);
}

export async function pause(ms = FADE_OUT) {
  const my = ++seq;
  emit({ playing: false, buffering: false });
  if (audio && !audio.paused) await fadeAudio(0, ms);
  if (my !== seq) return;
  audio?.pause();
}

export function toggle() {
  if (state.playing) void pause();
  else void play();
}

export async function next() {
  const list = state.tracks ?? [];
  if (!state.source || list.length === 0) return;
  const i = list.findIndex((t) => t.id === state.source!.id);
  const nx = list[(i + 1) % list.length];
  await play({ kind: "track", id: nx.id });
}

export function setVolume(v: number) {
  const vol = clamp01(v);
  emit({ volume: vol });
  if (!state.playing) return;
  cancelAnimationFrame(fadeRaf);
  if (audio) audio.volume = vol;
}

export function setLoop(on: boolean) {
  emit({ loop: on });
  if (audio) audio.loop = on;
}

let sleepTimer = 0;
/** Uyqu taymeri: `minutes` dan keyin musiqa sekin (8 s) so'nadi. 0 — o'chirish. */
export function setSleep(minutes: number) {
  window.clearTimeout(sleepTimer);
  if (!minutes) return emit({ sleepAt: null });
  const at = Date.now() + minutes * 60_000;
  emit({ sleepAt: at });
  sleepTimer = window.setTimeout(() => {
    emit({ sleepAt: null });
    void pause(8000);
  }, minutes * 60_000);
}

/** Reader'dan chiqilganda — to'xtatish (keyingi safar yana bir bosishda davom etadi) */
export function stopAll() {
  window.clearTimeout(sleepTimer);
  void pause(300);
  emit({ sleepAt: null });
}

/** e2e/diagnostika: haqiqiy ovoz chiqyaptimi */
function debugInfo() {
  return { audioPaused: audio?.paused ?? true, audioSrc: audio?.src ?? null, audioVolume: audio?.volume ?? 0 };
}

// e2e: ovoz haqiqatan chiqyaptimi (audio to'xtamaganmi) — faqat o'qish uchun
if (typeof window !== "undefined") (window as unknown as { __a365music?: typeof debugInfo }).__a365music = debugInfo;
