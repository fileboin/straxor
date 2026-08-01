import { useState, useEffect, useCallback, useRef } from "react";
import {
  startPreview, stopPreview, getPreviewStatus, getPreviewLogs,
  detectFramework, type PreviewStatus, type PreviewLog, type DeviceSize,
  DEVICE_PRESETS,
} from "../../lib/preview";

interface Props {
  machineId: string | null;
}

export default function PreviewPanel({ machineId }: Props) {
  const [status, setStatus] = useState<PreviewStatus | null>(null);
  const [logs, setLogs] = useState<PreviewLog[]>([]);
  const [device, setDevice] = useState<DeviceSize>("desktop");
  const [loading, setLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [framework, setFramework] = useState<string | null>(null);
  const [_error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const preset = DEVICE_PRESETS.find((d) => d.id === device)!;

  // Poll status
  const refreshStatus = useCallback(async () => {
    if (!machineId) return;
    try {
      const s = await getPreviewStatus(machineId);
      setStatus(s);
      if (s.running) {
        const l = await getPreviewLogs(machineId, 50);
        setLogs(l);
      }
    } catch { /* ok */ }
  }, [machineId]);

  useEffect(() => {
    if (!machineId) return;
    refreshStatus();
    pollRef.current = setInterval(refreshStatus, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [machineId, refreshStatus]);

  // Detect framework on mount
  useEffect(() => {
    if (!machineId) return;
    detectFramework(machineId).then(setFramework);
  }, [machineId]);

  const handleStart = useCallback(async () => {
    if (!machineId) return;
    setLoading(true);
    setError(null);
    try {
      const s = await startPreview({ machineId, framework: framework || undefined });
      setStatus(s);
      if (!s.running && s.error) setError(s.error);
      // Refresh iframe after a delay
      setTimeout(() => {
        if (iframeRef.current && s.url) {
          iframeRef.current.src = s.url;
        }
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Greška");
    } finally {
      setLoading(false);
    }
  }, [machineId, framework]);

  const handleStop = useCallback(async () => {
    if (!machineId) return;
    setLoading(true);
    try {
      await stopPreview(machineId);
      setStatus(null);
      setLogs([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current && status?.url) {
      iframeRef.current.src = status.url;
    }
    refreshStatus();
  }, [status, refreshStatus]);

  if (!machineId) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-text-muted">
        <div className="text-3xl opacity-20">👁</div>
        <div className="text-[12px]">Poveži GitHub repo ili VPS za preview</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#1a1a1a] bg-[#0a0a0a] shrink-0">
        {/* Start / Stop */}
        {status?.running ? (
          <button
            onClick={handleStop}
            disabled={loading}
            className="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] rounded hover:bg-red-500/20 disabled:opacity-30 transition-colors"
          >
            {loading ? "…" : "⏹ Zaustavi"}
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={loading}
            className="px-2 py-0.5 bg-accent/10 text-accent text-[10px] rounded hover:bg-accent/20 disabled:opacity-30 transition-colors"
          >
            {loading ? "…" : "▶ Pokreni"}
          </button>
        )}

        {/* Framework badge */}
        {framework && (
          <span className="text-[9px] px-1.5 py-0.5 bg-surface-2 text-text-muted rounded">
            {framework}
          </span>
        )}

        {/* Status */}
        {status?.running && (
          <span className="text-[9px] text-accent flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Aktivno
          </span>
        )}
        {status && !status.running && status.error && (
          <span className="text-[9px] text-red-400">{status.error}</span>
        )}

        <div className="flex-1" />

        {/* Device toggle */}
        <div className="flex items-center bg-[#111] rounded border border-[#222] overflow-hidden">
          {DEVICE_PRESETS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDevice(d.id)}
              className={`px-1.5 py-0.5 text-[9px] transition-colors ${
                device === d.id
                  ? "bg-accent/15 text-accent"
                  : "text-text-muted hover:text-text-secondary"
              }`}
              title={d.label}
            >
              {d.icon}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          className="px-1 py-0.5 text-text-muted hover:text-text text-[10px]"
          title="Osvježi"
        >↻</button>

        {/* Logs toggle */}
        <button
          onClick={() => setShowLogs((v) => !v)}
          className={`px-1 py-0.5 text-[10px] ${showLogs ? "text-accent" : "text-text-muted hover:text-text"}`}
          title="Logovi"
        >📋</button>
      </div>

      {/* Content area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Iframe */}
        <div className="flex-1 flex items-start justify-center bg-[#0d0d0d] overflow-auto p-2">
          {status?.running && status.url ? (
            <div
              className="bg-white rounded-lg overflow-hidden shadow-2xl shadow-black/40 border border-[#222] transition-all duration-300"
              style={{
                width: device === "desktop" ? "100%" : `${preset.width}px`,
                maxWidth: "100%",
                height: `${preset.height}px`,
              }}
            >
              <iframe
                ref={iframeRef}
                src={status.url}
                className="w-full h-full border-0"
                title="Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
              <div className="text-4xl opacity-10">👁</div>
              <div className="text-[12px]">Klikni "Pokreni" za preview</div>
              {framework && (
                <div className="text-[10px] opacity-40">
                  Detektiran framework: <span className="text-accent/60">{framework}</span>
                </div>
              )}
              <div className="text-[9px] opacity-30 max-w-[200px] text-center">
                Preview pokreće dev server na VPS-u i prikazuje ga u iframe-u
              </div>
            </div>
          )}
        </div>

        {/* Logs sidebar */}
        {showLogs && (
          <div className="w-64 border-l border-[#1a1a1a] bg-[#0a0a0a] flex flex-col overflow-hidden shrink-0">
            <div className="px-2 py-1 border-b border-[#1a1a1a] text-[9px] text-text-muted uppercase tracking-wider">
              Preview logovi
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-[10px] leading-relaxed p-2">
              {logs.length === 0 ? (
                <div className="text-text-muted/40 text-center py-4">Nema logova</div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={`py-0.5 ${
                      log.level === "error" || log.level === "stderr"
                        ? "text-red-400"
                        : log.level === "warn"
                        ? "text-yellow-400"
                        : "text-text-secondary"
                    }`}
                  >
                    <span className="text-text-muted/30 mr-1">
                      {new Date(log.timestamp).toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                    {log.message}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* URL bar */}
      {status?.running && status.url && (
        <div className="flex items-center gap-2 px-3 py-1 border-t border-[#1a1a1a] bg-[#0a0a0a] text-[10px] shrink-0">
          <span className="text-text-muted/40">URL:</span>
          <a
            href={status.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent/70 hover:text-accent truncate flex-1"
          >
            {status.url}
          </a>
          <button
            onClick={() => navigator.clipboard.writeText(status.url!)}
            className="text-text-muted hover:text-text text-[9px]"
          >📋</button>
        </div>
      )}
    </div>
  );
}
