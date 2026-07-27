import { useState, useEffect, useCallback } from "react";

export interface DiffFile {
  path: string;
  additions: string[];
  deletions: string[];
  before?: string;
  after?: string;
}

interface Props {
  files: DiffFile[];
  onApprove: (paths: string[]) => void;
  onReject: (paths: string[]) => void;
  onClose: () => void;
  loading?: boolean;
}

type ViewMode = "unified" | "before" | "after";

function FileIcon({ path }: { path: string }) {
  const ext = path.split(".").pop()?.toLowerCase();
  const colors: Record<string, string> = {
    tsx: "text-accent-blue",
    ts: "text-accent-blue",
    jsx: "text-accent-blue",
    js: "text-yellow-400",
    css: "text-purple-400",
    html: "text-orange-400",
    json: "text-green-400",
    md: "text-text-muted",
  };
  return <span className={`text-[10px] ${colors[ext || ""] || "text-text-muted"}`}>●</span>;
}

function FileList({
  files,
  selected,
  onSelect,
  selectedFiles,
  onToggleFile,
}: {
  files: DiffFile[];
  selected: number;
  onSelect: (idx: number) => void;
  selectedFiles: Set<string>;
  onToggleFile: (path: string) => void;
}) {
  return (
    <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-border overflow-y-auto shrink-0">
      <div className="px-2.5 py-2 border-b border-border">
        <div className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
          {files.length} {files.length === 1 ? "datoteka" : "datoteke"}
        </div>
      </div>
      {files.map((f, i) => {
        const isSelected = selected === i;
        const isChecked = selectedFiles.has(f.path);
        return (
          <div
            key={f.path}
            className={`flex items-center gap-2 px-2.5 py-2 border-b border-border/50 cursor-pointer transition-colors ${
              isSelected ? "bg-surface-2" : "hover:bg-surface-2/50"
            }`}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => {
                e.stopPropagation();
                onToggleFile(f.path);
              }}
              className="rounded border-border accent-accent shrink-0"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => onSelect(i)}
              className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
            >
              <FileIcon path={f.path} />
              <span className="text-[11px] text-text truncate">{f.path}</span>
            </button>
            <div className="flex items-center gap-1 shrink-0">
              {f.deletions.length > 0 && (
                <span className="text-[9px] text-red-400">-{f.deletions.length}</span>
              )}
              {f.additions.length > 0 && (
                <span className="text-[9px] text-green-400">+{f.additions.length}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UnifiedDiff({ file }: { file: DiffFile }) {
  return (
    <div className="font-mono text-[11px] leading-[1.7]">
      {/* File header */}
      <div className="px-3 py-1.5 bg-surface-2 border-b border-border text-text-muted text-[10px]">
        --- {file.path}
      </div>
      <div className="px-3 py-1.5 bg-surface-2 border-b border-border text-text-muted text-[10px]">
        +++ {file.path}
      </div>
      {/* Deletions */}
      {file.deletions.length > 0 && (
        <div className="bg-red-500/5">
          {file.deletions.map((line, i) => (
            <div key={`d-${i}`} className="px-3 flex">
              <span className="w-6 text-right text-text-muted/50 shrink-0 select-none">-</span>
              <span className="text-red-400 whitespace-pre-wrap break-all">{line}</span>
            </div>
          ))}
        </div>
      )}
      {/* Additions */}
      {file.additions.length > 0 && (
        <div className="bg-green-500/5">
          {file.additions.map((line, i) => (
            <div key={`a-${i}`} className="px-3 flex">
              <span className="w-6 text-right text-text-muted/50 shrink-0 select-none">+</span>
              <span className="text-green-400 whitespace-pre-wrap break-all">{line}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BeforeAfterView({
  file,
  mode,
}: {
  file: DiffFile;
  mode: "before" | "after";
}) {
  const content = mode === "before" ? file.before : file.after;

  if (!content) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-text-muted text-[11px]">
        {mode === "before"
          ? "Sadržaj prije promjena nije dostupan"
          : "Sadržaj nakon promjena nije dostupan"}
      </div>
    );
  }

  const lines = content.split("\n");
  return (
    <div className="font-mono text-[11px] leading-[1.7] overflow-y-auto">
      <div className="px-3 py-1.5 bg-surface-2 border-b border-border text-text-muted text-[10px]">
        {mode === "before" ? "◄ Prije" : "► Poslije"} — {file.path}
      </div>
      {lines.map((line, i) => {
        const isDeleted = mode === "before" && file.deletions.includes(line);
        const isAdded = mode === "after" && file.additions.includes(line);
        return (
          <div
            key={i}
            className={`px-3 flex ${
              isDeleted ? "bg-red-500/10 text-red-400" : isAdded ? "bg-green-500/10 text-green-400" : ""
            }`}
          >
            <span className="w-8 text-right text-text-muted/40 shrink-0 select-none">{i + 1}</span>
            <span className="whitespace-pre-wrap break-all">{line}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DiffReview({
  files,
  onApprove,
  onReject,
  onClose,
  loading,
}: Props) {
  const [selectedFile, setSelectedFile] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("unified");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(() => {
    return new Set(files.map((f) => f.path));
  });

  useEffect(() => {
    setSelectedFiles(new Set(files.map((f) => f.path)));
  }, [files]);

  const toggleFile = useCallback((path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map((f) => f.path)));
    }
  }, [files, selectedFiles.size]);

  const handleApprove = () => {
    onApprove(Array.from(selectedFiles));
  };

  const handleReject = () => {
    onReject(Array.from(selectedFiles));
  };

  const totalAdd = files.reduce((sum, f) => sum + f.additions.length, 0);
  const totalDel = files.reduce((sum, f) => sum + f.deletions.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-[900px] max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border sm:px-4">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm font-semibold text-text">Pregled promjena</h2>
            <div className="flex items-center gap-2 text-[11px] shrink-0">
              <span className="text-green-400">+{totalAdd}</span>
              <span className="text-red-400">-{totalDel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleAll}
              className="px-2 py-1 text-[10px] rounded border border-border text-text-muted hover:text-text transition-colors"
            >
              {selectedFiles.size === files.length ? "Odznači sve" : "Označi sve"}
            </button>
            <button
              onClick={onClose}
              className="px-2 py-1 text-[10px] rounded border border-border text-text-muted hover:text-text transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* View mode tabs */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-surface-2/30 sm:px-4">
          {(["unified", "before", "after"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                viewMode === mode
                  ? "bg-accent-dim text-accent"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {mode === "unified" ? "Unified" : mode === "before" ? "Prije" : "Poslije"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          <FileList
            files={files}
            selected={selectedFile}
            onSelect={setSelectedFile}
            selectedFiles={selectedFiles}
            onToggleFile={toggleFile}
          />
          <div className="flex-1 overflow-y-auto min-h-0">
            {files[selectedFile] && viewMode === "unified" && (
              <UnifiedDiff file={files[selectedFile]} />
            )}
            {files[selectedFile] && viewMode === "before" && (
              <BeforeAfterView file={files[selectedFile]} mode="before" />
            )}
            {files[selectedFile] && viewMode === "after" && (
              <BeforeAfterView file={files[selectedFile]} mode="after" />
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-border bg-surface sm:px-4">
          <span className="text-[10px] text-text-muted">
            {selectedFiles.size} od {files.length} označeno
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReject}
              disabled={selectedFiles.size === 0 || loading}
              className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Odbacujem..." : "Odbaci"}
            </button>
            <button
              onClick={handleApprove}
              disabled={selectedFiles.size === 0 || loading}
              className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Odobravam..." : "Odobri"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
