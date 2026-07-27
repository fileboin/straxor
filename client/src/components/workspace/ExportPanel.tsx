import { useState, useEffect } from "react";
import {
  EXPORT_SCOPES,
  generateExport,
  fetchExportManifest,
  getExportDownloadUrl,
  formatBytes,
  SCOPE_COLORS,
  type ExportScope,
  type ExportManifest,
} from "../../lib/export.js";

interface Props {
  projectId: string;
  machineId?: string;
  onClose: () => void;
}

export default function ExportPanel({ projectId, machineId, onClose }: Props) {
  const [selectedScopes, setSelectedScopes] = useState<Set<ExportScope>>(
    new Set(["all"])
  );
  const [manifest, setManifest] = useState<ExportManifest | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    fileSize: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    loadManifest();
  }, [selectedScopes]);

  async function loadManifest() {
    setLoadingManifest(true);
    try {
      const scopes = selectedScopes.has("all")
        ? undefined
        : Array.from(selectedScopes);
      const m = await fetchExportManifest(projectId, scopes, machineId);
      setManifest(m);
    } catch {
      setManifest(null);
    } finally {
      setLoadingManifest(false);
    }
  }

  function toggleScope(scope: ExportScope) {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (scope === "all") {
        if (next.has("all")) {
          next.clear();
        } else {
          next.clear();
          next.add("all");
        }
      } else {
        next.delete("all");
        if (next.has(scope)) {
          next.delete(scope);
        } else {
          next.add(scope);
          // If all individual scopes are selected, switch to "all"
          if (
            next.has("source") &&
            next.has("assets") &&
            next.has("config") &&
            next.has("docs")
          ) {
            next.clear();
            next.add("all");
          }
        }
      }
      return next;
    });
  }

  async function handleExport() {
    setExporting(true);
    setExportResult(null);
    try {
      const scopes: ExportScope[] = selectedScopes.has("all")
        ? ["all"]
        : Array.from(selectedScopes) as ExportScope[];
      const result = await generateExport(projectId, scopes, machineId);
      setExportResult({
        success: result.success,
        fileSize: result.fileSize,
      });

      if (result.success) {
        // Trigger download
        const url = getExportDownloadUrl(projectId);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${projectId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      setExportResult({
        success: false,
        fileSize: 0,
        error: err instanceof Error ? err.message : "Export failed",
      });
    } finally {
      setExporting(false);
    }
  }

  const filesByScope = manifest
    ? manifest.files.reduce(
        (acc, f) => {
          acc[f.scope] = (acc[f.scope] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      )
    : {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-[550px] mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text">📦 Export projekta</span>
            <span className="text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded">
              ZIP
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Scope selection */}
          <div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider font-medium mb-2">
              Što uključiti
            </div>
            <div className="grid grid-cols-2 gap-2">
              {EXPORT_SCOPES.map((scope) => {
                const active =
                  selectedScopes.has("all") || selectedScopes.has(scope.id);
                return (
                  <button
                    key={scope.id}
                    onClick={() => toggleScope(scope.id)}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border transition-colors text-left ${
                      active
                        ? "border-accent/40 bg-accent/5"
                        : "border-border bg-surface-2 hover:border-border-light"
                    }`}
                  >
                    <span className={`text-sm mt-0.5 ${active ? SCOPE_COLORS[scope.id] : "text-text-muted"}`}>
                      {scope.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-medium ${active ? "text-text" : "text-text-secondary"}`}>
                          {scope.label}
                        </span>
                        {active && (
                          <span className="text-[9px] text-accent">●</span>
                        )}
                      </div>
                      <div className="text-[9px] text-text-muted mt-0.5 leading-snug">
                        {scope.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manifest preview */}
          {manifest && (
            <div className="bg-surface-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                  Pregled
                </span>
                {loadingManifest && (
                  <span className="text-[9px] text-text-muted">Učitavam...</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <div>
                  <span className="text-text font-medium">{manifest.totalFiles}</span>{" "}
                  <span className="text-text-muted">datoteka</span>
                </div>
                <div>
                  <span className="text-text font-medium">{formatBytes(manifest.totalSize)}</span>
                </div>
              </div>

              {/* Files by scope */}
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(filesByScope).map(([scope, count]) => (
                  <span
                    key={scope}
                    className={`text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border ${SCOPE_COLORS[scope as ExportScope]}`}
                  >
                    {scope}: {count}
                  </span>
                ))}
              </div>

              {/* File list (first 8) */}
              <div className="mt-2 space-y-0.5 max-h-[150px] overflow-y-auto">
                {manifest.files.slice(0, 8).map((f) => (
                  <div
                    key={f.path}
                    className="flex items-center justify-between text-[10px] text-text-secondary"
                  >
                    <span className="truncate font-mono">{f.path}</span>
                    <span className="text-text-muted shrink-0 ml-2">
                      {formatBytes(f.size)}
                    </span>
                  </div>
                ))}
                {manifest.files.length > 8 && (
                  <div className="text-[9px] text-text-muted text-center py-1">
                    ... i još {manifest.files.length - 8} datoteka
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Export result */}
          {exportResult && (
            <div
              className={`rounded-lg border p-3 ${
                exportResult.success
                  ? "bg-green-500/5 border-green-500/30"
                  : "bg-red-500/5 border-red-500/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={
                    exportResult.success ? "text-green-400" : "text-red-400"
                  }
                >
                  {exportResult.success ? "✓" : "✕"}
                </span>
                <span
                  className={`text-[11px] font-medium ${
                    exportResult.success ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {exportResult.success
                    ? `Export uspješan (${formatBytes(exportResult.fileSize)})`
                    : `Greška: ${exportResult.error}`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
          <div className="text-[9px] text-text-muted">
            Format: ZIP • Kasnije: Git, Cloud, Backup
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-[11px] text-text-muted hover:text-text px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors"
            >
              Otkaži
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || selectedScopes.size === 0}
              className="text-[11px] text-white bg-accent hover:bg-accent-light px-4 py-1.5 rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              {exporting ? (
                <>
                  <span className="animate-spin">⟳</span> Exportiram...
                </>
              ) : (
                <>📦 Export ZIP</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
