"use client";

/**
 * 62: belgilash, xatcho'p va eslatmalar internetsiz ham ishlaydi. Har o'zgarish darhol (optimistik) ko'rinadi va
 * qurilmadagi navbatga (foydalanuvchi bo'yicha, localStorage) yoziladi; internet bo'lsa — darhol, bo'lmasa — qaytganda
 * orqa fonda ketma-ket, ohista (har so'rov orasida pauza) yuboriladi. Sahifa yopilsa ham navbat saqlanadi va ilova
 * keyingi ochilganda yuboriladi.
 *
 * Navbat ixchamlanadi: hali yuborilmagan yaratish → tahrir unga qo'shiladi, o'chirilsa — umuman yuborilmaydi.
 * Yaratilgach vaqtinchalik `local-…` id server id bilan almashadi (navbatdagi keyingi amallarda ham). Tarmoq / 5xx /
 * 429 / 401 — keyinroq qayta (ortib boruvchi kutish); boshqa 4xx — amal tashlanadi (UI'ga xabar).
 */
import { useSyncExternalStore } from "react";
import { isApiError, readingApi, type Annotation } from "@/lib/api";
import { isNetworkError } from "@/lib/api/client";
import type { AnnotationInput } from "@/lib/api/reading";

type Patch = Partial<Omit<AnnotationInput, "type">>;
type Op =
  | { kind: "create"; id: string; articleId: string; input: AnnotationInput; local: Annotation; sending?: boolean }
  | { kind: "update"; id: string; articleId: string; patch: Patch; sending?: boolean }
  | { kind: "delete"; id: string; articleId: string; sending?: boolean };

export type SyncEvent =
  | { type: "created"; articleId: string; localId: string; annotation: Annotation }
  | { type: "dropped"; articleId: string; id: string; kind: Op["kind"] };

const LOCAL = "local-";
export const isLocalId = (id: string) => id.startsWith(LOCAL);
/** Yaratilgan izohlar: vaqtinchalik id → server id (ekranda eski id qolgan bo'lsa ham keyingi amallar to'g'ri ketsin) */
const idMap = new Map<string, string>();
export const resolveId = (id: string) => idMap.get(id) ?? id;

let user: string | null = null;
let queue: Op[] = [];
let flushing = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let backoff = 0;
let version = 0;
const listeners = new Set<(e: SyncEvent) => void>();
const statusListeners = new Set<() => void>();

const outboxKey = () => (user ? `a365.ann.outbox.${user}` : null);
const cacheKey = (articleId: string) => (user ? `a365.ann.cache.${user}.${articleId}` : null);

function read<T>(key: string | null, fallback: T): T {
  if (!key) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string | null, value: unknown) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* to'lgan / private rejim — navbat shu sessiyada xotirada ishlayveradi */
  }
}
function persist() {
  const k = outboxKey();
  if (!k) return;
  if (queue.length) write(k, queue.map(({ sending: _s, ...op }) => op));
  else
    try {
      localStorage.removeItem(k);
    } catch {
      /* e'tiborsiz */
    }
  version++;
  statusListeners.forEach((l) => l());
}
const emit = (e: SyncEvent) => listeners.forEach((l) => l(e));

/** Joriy foydalanuvchi (AuthProvider). Navbat — shu foydalanuvchiniki; ilova ochilganda yuborish boshlanadi. */
export function setAnnotationUser(id: string | null) {
  if (id === user) return;
  // Foydalanuvchi hali aniqlanmay turib qilingan o'zgarishlar yo'qolmasin — saqlangan navbatga qo'shiladi
  const early = user === null ? queue : [];
  user = id;
  queue = id ? [...read<Op[]>(outboxKey(), []), ...early] : [];
  backoff = 0;
  if (id && early.length) persist();
  else {
    version++;
    statusListeners.forEach((l) => l());
  }
  if (id) schedule(300);
}

/** Chiqishda — keshlangan ro'yxatlar (eslatma matnlari) qurilmada qolmasin; yuborilmagan navbat saqlanadi. */
export function clearAnnotationCaches() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith("a365.ann.cache.")) localStorage.removeItem(k);
    }
  } catch {
    /* e'tiborsiz */
  }
}

export function subscribeSync(fn: (e: SyncEvent) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Yangi izoh — darhol qaytadi (vaqtinchalik id), navbatga yoziladi */
export function queueCreate(articleId: string, input: AnnotationInput): Annotation {
  const now = new Date().toISOString();
  const local: Annotation = {
    id: `${LOCAL}${crypto.randomUUID()}`,
    article_id: articleId,
    type: input.type,
    page: input.page ?? null,
    location_data: input.location_data ?? null,
    selected_text: input.selected_text ?? null,
    note_text: input.note_text ?? null,
    color: input.color ?? null,
    label: input.label ?? null,
    created_at: now,
    updated_at: now,
  };
  queue.push({ kind: "create", id: local.id, articleId, input, local });
  persist();
  schedule(0);
  return local;
}

export function queueUpdate(articleId: string, rawId: string, patch: Patch) {
  const id = resolveId(rawId);
  const create = queue.find((o): o is Extract<Op, { kind: "create" }> => o.kind === "create" && o.id === id && !o.sending);
  if (create) {
    create.input = { ...create.input, ...patch };
    create.local = { ...create.local, ...patch };
  } else {
    const upd = queue.find((o): o is Extract<Op, { kind: "update" }> => o.kind === "update" && o.id === id && !o.sending);
    if (upd) upd.patch = { ...upd.patch, ...patch };
    else queue.push({ kind: "update", id, articleId, patch });
  }
  persist();
  schedule(0);
}

export function queueDelete(articleId: string, rawId: string) {
  const id = resolveId(rawId);
  const create = queue.find((o) => o.kind === "create" && o.id === id);
  if (create && !create.sending) {
    // Hali yuborilmagan — serverga umuman bormaydi
    queue = queue.filter((o) => o.id !== id);
  } else {
    queue = queue.filter((o) => !(o.kind === "update" && o.id === id && !o.sending));
    queue.push({ kind: "delete", id, articleId });
  }
  persist();
  schedule(0);
}

/** Server ro'yxati + navbatdagi (hali yuborilmagan) o'zgarishlar */
export function mergeWithPending(articleId: string, list: Annotation[]): Annotation[] {
  const mine = queue.filter((o) => o.articleId === articleId);
  const deleted = new Set(mine.filter((o) => o.kind === "delete").map((o) => o.id));
  const patches = new Map<string, Patch>();
  for (const o of mine) if (o.kind === "update") patches.set(o.id, { ...patches.get(o.id), ...o.patch });
  const out = list.filter((a) => !deleted.has(a.id)).map((a) => (patches.has(a.id) ? { ...a, ...patches.get(a.id) } : a));
  const created = mine.filter((o): o is Extract<Op, { kind: "create" }> => o.kind === "create").map((o) => ({ ...o.local, ...patches.get(o.id) }));
  return [...created.filter((c) => !deleted.has(c.id)), ...out];
}

/** Oxirgi server ro'yxati (internetsiz ochilganda ham ko'rinsin) */
export function cacheAnnotations(articleId: string, list: Annotation[]) {
  write(cacheKey(articleId), list);
}
export function cachedAnnotations(articleId: string): Annotation[] {
  return read<Annotation[]>(cacheKey(articleId), []);
}

// ---- Yuborish
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const online = () => typeof navigator === "undefined" || navigator.onLine !== false;

function schedule(ms: number) {
  if (typeof window === "undefined" || !user) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), ms);
}

const TIMEOUT = 30_000;
const timedOut = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
const retryable = (e: unknown) => timedOut(e) || isNetworkError(e) || (isApiError(e) && (e.status === 0 || e.status >= 500 || e.status === 429 || e.status === 401));

async function flush() {
  timer = null;
  if (flushing || !queue.length || !user) return;
  if (!online()) return; // "online" hodisasi qayta boshlaydi
  flushing = true;
  const owner = user;
  try {
    while (queue.length && user === owner) {
      const op = queue[0];
      op.sending = true;
      // Osilib qolgan so'rov navbatni to'xtatib qo'ymasin — vaqt chegarasi
      const ctl = new AbortController();
      const kill = setTimeout(() => ctl.abort(), TIMEOUT);
      try {
        if (op.kind === "create") {
          const a = await readingApi.createAnnotation(op.articleId, op.input, ctl.signal);
          const annotation: Annotation = { ...op.local, ...a, color: a.color ?? op.local.color, location_data: a.location_data ?? op.local.location_data };
          queue.shift();
          idMap.set(op.id, a.id);
          // Keyingi amallar (yuborish paytida qilingan tahrir/o'chirish) — endi server id bilan
          for (const o of queue) if (o.id === op.id) o.id = a.id;
          persist();
          emit({ type: "created", articleId: op.articleId, localId: op.id, annotation });
        } else if (op.kind === "update") {
          await readingApi.updateAnnotation(op.articleId, op.id, op.patch, ctl.signal);
          queue.shift();
          persist();
        } else {
          await readingApi.deleteAnnotation(op.articleId, op.id, ctl.signal).catch((e: unknown) => {
            if (!(isApiError(e) && e.status === 404)) throw e; // allaqachon yo'q — maqsadga erishilgan
          });
          queue.shift();
          persist();
        }
        backoff = 0;
      } catch (e) {
        op.sending = false;
        if (retryable(e)) {
          backoff = Math.min(backoff ? backoff * 2 : 5_000, 120_000);
          schedule(backoff);
          break;
        }
        queue.shift();
        persist();
        emit({ type: "dropped", articleId: op.articleId, id: op.id, kind: op.kind });
      } finally {
        clearTimeout(kill);
      }
      await sleep(250); // ohista — o'qishga xalaqit bermasin
    }
  } finally {
    flushing = false;
    version++;
    statusListeners.forEach((l) => l());
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    backoff = 0;
    schedule(1_000);
  });
  window.addEventListener("offline", () => {
    version++;
    statusListeners.forEach((l) => l());
  });
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && schedule(500));
}

// ---- Holat (UI belgisi)
function subscribeStatus(fn: () => void) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}
let snapKey = "";
let snap = { pending: 0, offline: false };
function getSnapshot(articleId?: string) {
  const pending = queue.filter((o) => !articleId || o.articleId === articleId).length;
  const offline = !online();
  const k = `${version}:${pending}:${offline}`;
  if (k !== snapKey) {
    snapKey = k;
    snap = { pending, offline };
  }
  return snap;
}
const SERVER = { pending: 0, offline: false };

/** Navbatdagi o'zgarishlar soni va internet holati */
export function useAnnotationSync(articleId?: string): { pending: number; offline: boolean } {
  return useSyncExternalStore(
    subscribeStatus,
    () => getSnapshot(articleId),
    () => SERVER,
  );
}
