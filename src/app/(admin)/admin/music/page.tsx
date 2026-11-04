"use client";

/**
 * 124: O'qish musiqasi — admin. Fayllarni sudrab tashlash (bir nechta), progress, format/hajm tekshiruvi; ro'yxatda
 * tinglab ko'rish, nomini o'zgartirish, kayfiyat, yoqish/o'chirish, tasdiq bilan o'chirish. Kontrakt — BACKEND_TASKS.md 5-qism.
 */
import { useEffect, useRef, useState, type DragEvent } from "react";
import { Alert, Badge, Card, EmptyState, IconButton, Input, PageHeader, Select, Spinner, Switch, cn, formatBytes, useConfirm } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { errorMessage } from "@/lib/api";
import { MUSIC_MOODS, adminMusicApi, musicApi, type AdminMusicTrack } from "@/lib/api/music";
import { audioDuration, validateAudio } from "@/lib/uploads";
import { env } from "@/lib/env";
import { useAsync } from "@/lib/use-async";
import { useT, type DictKey } from "@/i18n";

interface Job {
  key: string;
  name: string;
  progress: number;
  error: string | null;
}

const ACCEPT = ".mp3,.ogg,.oga,.opus,.m4a,.aac,audio/mpeg,audio/ogg,audio/mp4";
const fmtDur = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "—");

export default function AdminMusicPage() {
  const { t } = useT();
  const confirm = useConfirm();
  const { data, error: loadError, loading, setData } = useAsync(() => adminMusicApi.list(), []);
  // backend'da endpoint hali yo'q (404) — `list()` null qaytaradi
  const missing = !loading && !loadError && data === null;
  const tracks = data ?? undefined;
  const [mood, setMood] = useState<string>("CALM");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => preview.current?.pause(), []);

  const moodOptions = MUSIC_MOODS.map((m) => ({ value: m, label: t(`music.mood.${m}` as DictKey) }));

  const patchLocal = (tr: AdminMusicTrack) => setData((list) => (list ? list.map((x) => (x.id === tr.id ? tr : x)) : list));

  async function uploadMany(files: FileList | File[] | null | undefined) {
    if (!files?.length || missing) return;
    setError(null);
    for (const file of Array.from(files)) {
      const key = `${file.name}-${file.size}-${Date.now()}`;
      const bad = await validateAudio(file);
      setJobs((j) => [...j, { key, name: file.name, progress: 0, error: bad }]);
      if (bad) continue;
      try {
        const dur = await audioDuration(file);
        const tr = await adminMusicApi.upload(
          file,
          { mood, duration_seconds: dur },
          { timeoutMs: 10 * 60_000, onProgress: (l, total) => setJobs((j) => j.map((x) => (x.key === key ? { ...x, progress: Math.round((l / total) * 100) } : x))) },
        );
        setJobs((j) => j.filter((x) => x.key !== key));
        setData((list) => [...(list ?? []), tr]);
      } catch (e) {
        setJobs((j) => j.map((x) => (x.key === key ? { ...x, error: errorMessage(e) } : x)));
      }
    }
  }

  async function update(tr: AdminMusicTrack, patch: Parameters<typeof adminMusicApi.update>[1]) {
    setError(null);
    patchLocal({ ...tr, ...patch } as AdminMusicTrack); // darhol ko'rinadi
    try {
      patchLocal(await adminMusicApi.update(tr.id, patch));
    } catch (e) {
      patchLocal(tr);
      setError(errorMessage(e));
    }
  }

  async function remove(tr: AdminMusicTrack) {
    const ok = await confirm({ title: t("admin.music.deleteTitle"), message: t("admin.music.deleteText", { title: tr.title }), confirmLabel: t("common.delete"), tone: "danger" });
    if (!ok) return;
    try {
      await adminMusicApi.remove(tr.id);
      if (playingId === tr.id) togglePreview(tr);
      setData((list) => (list ? list.filter((x) => x.id !== tr.id) : list));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function togglePreview(tr: AdminMusicTrack) {
    const a = (preview.current ??= new Audio());
    if (playingId === tr.id) {
      a.pause();
      setPlayingId(null);
      return;
    }
    a.src = musicApi.streamUrl(tr);
    a.onended = () => setPlayingId(null);
    void a.play().then(
      () => setPlayingId(tr.id),
      () => setError(t("music.error")),
    );
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void uploadMany(e.dataTransfer.files);
  };

  return (
    <div>
      <PageHeader title={t("admin.music.title")} description={t("admin.music.sub")} icon={<I.Music size={26} />} />
      {(error ?? loadError) && <Alert className="mb-4">{error ?? loadError}</Alert>}
      {missing && (
        <Alert tone="info" className="mb-4">
          <span data-testid="music-missing">{t("admin.music.missing")}</span>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Card title={t("admin.music.add")}>
          <div className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              aria-disabled={missing}
              className={cn("bg-drop music-drop", over && "over", missing && "pointer-events-none opacity-50")}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), fileRef.current?.click())}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
              aria-label={t("admin.music.drop")}
              data-testid="music-drop"
            >
              <span className="bg-drop-icon">
                <I.Upload size={22} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-text">{t("admin.music.drop")}</span>
                <span className="block text-xs text-muted">{t("admin.music.dropHint", { n: env.maxMusicMb })}</span>
              </span>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  void uploadMany(e.target.files);
                  e.target.value = "";
                }}
                data-testid="music-file"
              />
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-text-2">{t("admin.music.moodForNew")}</p>
              <Select value={mood} onChange={setMood} options={moodOptions} aria-label={t("admin.music.moodForNew")} data-testid="music-new-mood" />
            </div>
            {jobs.length > 0 && (
              <ul className="space-y-2" data-testid="music-jobs">
                {jobs.map((j) => (
                  <li key={j.key} className="rounded-[var(--r-md)] border border-border p-2.5">
                    <div className="flex items-center gap-2 text-[13px] font-semibold">
                      <span className="min-w-0 flex-1 truncate">{j.name}</span>
                      {j.error ? (
                        <IconButton size="sm" variant="plain" label={t("common.close")} onClick={() => setJobs((x) => x.filter((y) => y.key !== j.key))}>
                          <I.X size={14} />
                        </IconButton>
                      ) : (
                        <span className="tabular-nums text-muted">{j.progress}%</span>
                      )}
                    </div>
                    {j.error ? (
                      <p className="mt-1 text-xs text-danger" data-testid="music-job-error">
                        {j.error}
                      </p>
                    ) : (
                      <div className="progress thin mt-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={j.progress}>
                        <i style={{ width: `${j.progress}%` }} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card title={t("admin.music.list")} actions={tracks && <Badge>{tracks.length}</Badge>} padded={false}>
          {loading ? (
            <div className="p-5">
              <Spinner />
            </div>
          ) : !tracks || tracks.length === 0 ? (
            <div className="p-5">
              <EmptyState title={t("admin.music.empty")} description={t("admin.music.emptyHint")} icon={<I.Music size={22} />} className="border-0" />
            </div>
          ) : (
            <ul className="music-admin-list" data-testid="music-admin-list">
              {tracks.map((tr) => (
                <li key={tr.id} className={cn("music-admin-row", !tr.is_active && "off")} data-testid="music-admin-row">
                  <button type="button" className={cn("music-big sm", playingId === tr.id && "on")} onClick={() => togglePreview(tr)} aria-label={playingId === tr.id ? t("music.pauseShort") : t("admin.music.preview")} data-testid="music-preview">
                    {playingId === tr.id ? <I.Pause size={14} /> : <I.Play size={13} />}
                  </button>
                  <div className="min-w-0">
                    {editing?.id === tr.id ? (
                      <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const title = editing.title.trim();
                          setEditing(null);
                          if (title && title !== tr.title) void update(tr, { title });
                        }}
                      >
                        <Input
                          value={editing.title}
                          onChange={(e) => setEditing({ id: tr.id, title: e.target.value })}
                          onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                          inputSize="sm"
                          autoFocus
                          maxLength={160}
                          aria-label={t("admin.music.name")}
                          data-testid="music-rename-input"
                        />
                        <IconButton size="sm" type="submit" label={t("common.save")}>
                          <I.Check size={15} />
                        </IconButton>
                      </form>
                    ) : (
                      <button type="button" className="music-admin-title" onClick={() => setEditing({ id: tr.id, title: tr.title })} title={t("admin.music.rename")} data-testid="music-rename">
                        <span className="truncate">{tr.title}</span>
                        <I.Pencil size={13} className="shrink-0 text-muted" />
                      </button>
                    )}
                    <p className="music-admin-meta">
                      {fmtDur(tr.duration_seconds)} · {formatBytes(tr.file_size)} · {tr.mime_type === "audio/mpeg" ? "MP3" : tr.mime_type === "audio/ogg" ? "OGG" : "M4A"}
                    </p>
                  </div>
                  <Select size="sm" value={tr.mood} onChange={(v) => void update(tr, { mood: v })} options={moodOptions} aria-label={t("music.mood")} className="music-admin-mood" data-testid="music-mood" />
                  <Switch checked={tr.is_active} onChange={(v) => void update(tr, { is_active: v })} aria-label={tr.is_active ? t("admin.music.disable") : t("admin.music.enable")} data-testid="music-active" />
                  <IconButton size="sm" variant="plain" label={t("common.delete")} onClick={() => void remove(tr)} className="hover:!text-danger" data-testid="music-delete">
                    <I.Trash size={15} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
