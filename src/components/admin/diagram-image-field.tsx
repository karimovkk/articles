"use client";

/**
 * 90: admin — diagramma rasmi (Diagram labelling): yuklash (JPEG/PNG/WebP ≤ 10 MB; savol saqlanganda yuboriladi),
 * almashtirish, olib tashlash yoki tashqi https havola; bo'sh joylar o'rni — rasmni bosib 1, 2, 3… nuqtalarni qo'yish
 * (`data.labels`, foizda; indeks = bo'sh joy tartibi, joylanmagani — null).
 */
import { useRef, useState, type MouseEvent } from "react";
import { Button, Field, Input, cn } from "@/components/ui";
import * as I from "@/components/ui/icons";
import { useDiagramSrc } from "@/components/quiz/question-view";
import { isApiPath, type DiagramLabel } from "@/lib/api";
import { HTTPS_URL_RE } from "@/lib/quiz/ielts";
import { useT } from "@/i18n";

export const DIAGRAM_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const DIAGRAM_MAX_BYTES = 10 * 1024 * 1024;

export function DiagramImageField({
  imageUrl,
  pendingSrc,
  count,
  labels,
  onFile,
  onRemove,
  onUrl,
  onLabels,
  onError,
}: {
  /** `data.image_url` — backend yo'li (yuklangan) yoki tashqi https */
  imageUrl: string | null;
  /** Tanlangan, hali yuklanmagan fayl (lokal blob URL) */
  pendingSrc: string | null;
  /** Bo'sh joylar soni */
  count: number;
  labels: Array<DiagramLabel | null>;
  onFile: (file: File) => void;
  onRemove: () => void;
  onUrl: (url: string) => void;
  onLabels: (labels: Array<DiagramLabel | null>) => void;
  onError: (msg: string) => void;
}) {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const loaded = useDiagramSrc(pendingSrc ? null : imageUrl);
  const src = pendingSrc ?? loaded.src;
  const external = imageUrl && !isApiPath(imageUrl) ? imageUrl : "";
  const [showUrl, setShowUrl] = useState(!!external);
  const [active, setActive] = useState(0);
  const has = !!(pendingSrc || imageUrl);
  const slots = Array.from({ length: count }, (_, i) => labels[i] ?? null);
  const placed = slots.filter(Boolean).length;

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!DIAGRAM_TYPES.includes(f.type))
      return onError(t("ielts.err.imageType"));
    if (f.size > DIAGRAM_MAX_BYTES) return onError(t("ielts.err.imageSize"));
    onFile(f);
  };
  const place = (e: MouseEvent<HTMLImageElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    const next = slots.map((l, i) => (i === active ? { x, y } : l));
    onLabels(next);
    // Keyingi joylanmagan bo'sh joy (bo'lmasa — joyida qoladi)
    const after = next.findIndex((l, i) => !l && i > active);
    const any = next.findIndex((l) => !l);
    setActive(after >= 0 ? after : any >= 0 ? any : active);
  };

  return (
    <Field label={t("ielts.admin.diagram")} hint={t("ielts.admin.diagramHint")}>
      <div className="space-y-3" data-testid="qf-diagram">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={DIAGRAM_TYPES.join(",")}
            className="sr-only"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
            data-testid="qf-image-file"
          />
          <Button
            size="sm"
            variant="secondary"
            icon={<I.Upload size={14} />}
            onClick={() => fileRef.current?.click()}
            data-testid="qf-image-upload"
          >
            {has ? t("ielts.admin.replace") : t("ielts.admin.upload")}
          </Button>
          {has && (
            <Button
              size="sm"
              variant="ghost"
              icon={<I.Trash size={14} />}
              onClick={onRemove}
              data-testid="qf-image-remove"
            >
              {t("ielts.admin.removeImage")}
            </Button>
          )}
          {!showUrl && (
            <button
              type="button"
              className="text-xs font-semibold text-text-2 underline"
              onClick={() => setShowUrl(true)}
              data-testid="qf-image-url-toggle"
            >
              {t("ielts.admin.orUrl")}
            </button>
          )}
          {pendingSrc && (
            <span className="text-xs font-semibold text-accent-ink">
              {t("ielts.admin.imagePending")}
            </span>
          )}
        </div>
        {showUrl && (
          <div>
            <Input
              type="url"
              inputMode="url"
              value={external}
              placeholder="https://…/diagram.png"
              onChange={(e) => onUrl(e.target.value)}
              aria-label={t("ielts.admin.imageUrl")}
              data-testid="qf-image-url"
            />
            {external && !HTTPS_URL_RE.test(external) && (
              <p className="mt-1 text-xs font-semibold text-danger">
                {t("ielts.err.image")}
              </p>
            )}
          </div>
        )}

        {src && count > 0 && (
          <div className="qf-labels" data-testid="qf-labels">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="qf-label">{t("ielts.admin.labels")}</span>
              <span
                className="text-xs text-muted"
                data-testid="qf-labels-count"
              >
                {t("ielts.admin.labelsPlaced", { placed, total: count })}
              </span>
              <span className="ml-auto flex flex-wrap gap-1">
                {slots.map((l, i) => (
                  <button
                    key={i}
                    type="button"
                    className={cn(
                      "qf-label-chip",
                      i === active && "active",
                      l && "placed",
                    )}
                    aria-pressed={i === active}
                    onClick={() => setActive(i)}
                    data-testid="qf-label-chip"
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  type="button"
                  className="qf-label-chip clear"
                  disabled={placed === 0}
                  onClick={() => {
                    onLabels([]);
                    setActive(0);
                  }}
                  data-testid="qf-labels-clear"
                >
                  {t("ielts.admin.labelsClear")}
                </button>
              </span>
            </div>
            <div className="qf-labels-stage">
              <span className="qv-figure-box editable">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob / tashqi havola (o'lchami noma'lum) */}
                <img
                  src={src}
                  alt=""
                  onClick={place}
                  data-testid="qf-labels-img"
                />
                {slots.map((l, i) =>
                  l ? (
                    <span
                      key={i}
                      className={cn("qv-pin", i === active && "active")}
                      style={{ left: `${l.x}%`, top: `${l.y}%` }}
                    >
                      {i + 1}
                    </span>
                  ) : null,
                )}
              </span>
            </div>
            <p className="text-xs text-muted">
              {t("ielts.admin.labelsHint", { n: active + 1 })}
            </p>
          </div>
        )}
        {loaded.failed && !pendingSrc && (
          <p className="text-xs font-semibold text-danger">
            {t("ielts.imageFailed")}
          </p>
        )}
      </div>
    </Field>
  );
}
