import { useEffect, useState } from "react";
import { getLastRestoreMeta } from "../../lib/app-state.js";
import { getResumeMeta, getResumeToken, getServiceWorkerDiagnostics, isStandalone, type PwaResumeMeta } from "../../lib/pwa.js";

interface Props {
  onClose: () => void;
}

interface SwDiagnostics {
  supported: boolean;
  registered: boolean;
  controller: boolean;
  scope: string | null;
}

export default function PwaDiagnosticsPanel({ onClose }: Props) {
  const [resumeToken, setResumeToken] = useState<string | null>(null);
  const [resumeMeta, setResumeMeta] = useState<PwaResumeMeta | null>(null);
  const [restoreMeta, setRestoreMeta] = useState<{ source: "remote" | "mirror"; savedAt: number; restoredAt: number } | null>(null);
  const [sw, setSw] = useState<SwDiagnostics>({ supported: false, registered: false, controller: false, scope: null });

  useEffect(() => {
    setResumeToken(getResumeToken());
    setResumeMeta(getResumeMeta());
    setRestoreMeta(getLastRestoreMeta());
    getServiceWorkerDiagnostics().then(setSw).catch(() => {});
  }, []);

  const row = (label: string, value: string, accent = false) => (
    <div className="flex items-start justify-between gap-3 px-3 py-2 border-b border-border/40 last:border-b-0">
      <span className="text-[11px] text-text-muted">{label}</span>
      <span className={`text-[11px] text-right break-all ${accent ? "text-accent font-medium" : "text-text"}`}>{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm">📱</span>
            <span className="text-[13px] font-semibold text-text">PWA Diagnostics</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setResumeToken(getResumeToken());
                setResumeMeta(getResumeMeta());
                setRestoreMeta(getLastRestoreMeta());
                getServiceWorkerDiagnostics().then(setSw).catch(() => {});
              }}
              className="text-[11px] text-text-muted hover:text-text px-2 py-1 rounded-lg hover:bg-surface-2 transition-colors"
            >
              ↻
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors">✕</button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="rounded-xl border border-border bg-surface-2/30 overflow-hidden">
            <div className="px-3 py-2 border-b border-border/50 text-[10px] font-medium text-text">App resume</div>
            {row("Resume token", resumeToken || "N/A", true)}
            {row("Standalone mode", isStandalone() ? "Yes" : "No")}
            {row("Last restore source", restoreMeta ? (restoreMeta.source === "mirror" ? "Local mirror" : "Backend remote") : "Unknown")}
            {row("Last restore savedAt", restoreMeta?.savedAt ? new Date(restoreMeta.savedAt).toLocaleString() : "N/A")}
            {row("Last restore restoredAt", restoreMeta?.restoredAt ? new Date(restoreMeta.restoredAt).toLocaleString() : "N/A")}
          </div>

          <div className="rounded-xl border border-border bg-surface-2/30 overflow-hidden">
            <div className="px-3 py-2 border-b border-border/50 text-[10px] font-medium text-text">Service Worker</div>
            {row("Supported", sw.supported ? "Yes" : "No")}
            {row("Registered", sw.registered ? "Yes" : "No")}
            {row("Controlling page", sw.controller ? "Yes" : "No")}
            {row("Scope", sw.scope || "N/A")}
          </div>

          <div className="rounded-xl border border-border bg-surface-2/30 overflow-hidden">
            <div className="px-3 py-2 border-b border-border/50 text-[10px] font-medium text-text">Resume metadata</div>
            {row("Reason", resumeMeta?.reason || "N/A")}
            {row("Saved at", resumeMeta?.savedAt ? new Date(resumeMeta.savedAt).toLocaleString() : "N/A")}
            {row("Path", resumeMeta?.path || "N/A")}
            {row("URL", resumeMeta?.href || "N/A")}
          </div>
        </div>
      </div>
    </div>
  );
}
