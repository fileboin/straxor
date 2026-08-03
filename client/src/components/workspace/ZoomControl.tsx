import { useEffect, useRef, useState } from "react";
import { t } from "../../lib/i18n.js";

interface Props {
  zoom: number;
  onZoomChange: (z: number) => void;
}

export const ZOOM_MIN = 0.7;
export const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.05;

export const ZOOM_PRESETS = [
  { id: "tiny", value: 0.7, labelKey: "zoom.tiny" },
  { id: "small", value: 0.85, labelKey: "zoom.small" },
  { id: "medium", value: 1, labelKey: "zoom.medium" },
  { id: "large", value: 1.25, labelKey: "zoom.large" },
  { id: "xlarge", value: 1.5, labelKey: "zoom.xlarge" },
] as const;

export function clampZoom(z: number) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z * 20) / 20));
}

export const VZOOM_MIN = 0.5;
export const VZOOM_MAX = 1.5;
export const VZOOM_PRESETS = [
  { id: "v-squeeze", value: 0.6, labelKey: "vzoom.squeeze" },
  { id: "v-compact", value: 0.8, labelKey: "vzoom.compact" },
  { id: "v-normal", value: 1, labelKey: "vzoom.normal" },
  { id: "v-tall", value: 1.25, labelKey: "vzoom.tall" },
  { id: "v-full", value: 1.5, labelKey: "vzoom.full" },
] as const;

export function clampVerticalZoom(z: number) {
  return Math.max(VZOOM_MIN, Math.min(VZOOM_MAX, Math.round(z * 20) / 20));
}

export default function ZoomControl({ zoom, onZoomChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pct = Math.round(zoom * 100);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const btnClass =
    "w-6 h-6 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 border border-transparent hover:border-border transition-colors text-[13px]";

  return (
    <div ref={rootRef} className="relative flex items-center gap-0.5 shrink-0">
      <button
        type="button"
        onClick={() => onZoomChange(clampZoom(zoom - ZOOM_STEP))}
        disabled={zoom <= ZOOM_MIN}
        className={btnClass + " disabled:opacity-30"}
        title={t("zoom.decrease")}
        aria-label={t("zoom.decrease")}
      >
        −
      </button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-12 h-6 rounded-md flex items-center justify-center gap-1 text-[11px] font-medium text-text-muted hover:text-text hover:bg-surface-2 border border-transparent hover:border-border transition-colors"
        title={t("zoom.title")}
        aria-label={t("zoom.title")}
      >
        <span className="text-[11px]">🔍</span>
        <span className="tabular-nums">{pct}%</span>
      </button>
      <button
        type="button"
        onClick={() => onZoomChange(clampZoom(zoom + ZOOM_STEP))}
        disabled={zoom >= ZOOM_MAX}
        className={btnClass + " disabled:opacity-30"}
        title={t("zoom.increase")}
        aria-label={t("zoom.increase")}
      >
        +
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-border bg-surface shadow-xl shadow-black/40 p-1.5">
          <div className="text-[10px] uppercase tracking-wider text-text-muted px-1.5 pb-1">
            {t("zoom.presets")}
          </div>
          {ZOOM_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onZoomChange(p.value);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-1.5 py-1 rounded-lg text-[11px] transition-colors ${
                Math.abs(zoom - p.value) < 0.001
                  ? "bg-accent/15 text-accent font-semibold"
                  : "text-text hover:bg-surface-2"
              }`}
            >
              <span>{t(p.labelKey)}</span>
              <span className="tabular-nums">{Math.round(p.value * 100)}%</span>
            </button>
          ))}
          {Math.abs(zoom - 1) >= 0.001 && (
            <button
              type="button"
              onClick={() => {
                onZoomChange(1);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-1.5 py-1 rounded-lg text-[11px] text-text-muted hover:bg-surface-2 hover:text-text transition-colors mt-0.5"
            >
              <span>{t("zoom.reset")}</span>
              <span>100%</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
