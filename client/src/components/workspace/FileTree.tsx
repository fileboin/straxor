import { useState, useEffect, useCallback } from "react";

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileEntry[];
  size?: number;
}

interface Props {
  machineId: string | null;
  rootPath?: string;
  onFileSelect: (path: string) => void;
  selectedFile?: string;
  refreshKey?: number;
}

export default function FileTree({ machineId, rootPath = ".", onFileSelect, selectedFile, refreshKey }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(["."]));
  const [error, setError] = useState<string | null>(null);

  const loadTree = useCallback(async () => {
    if (!machineId) return;
    setLoading(true);
    setError(null);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_BASE}/api/files/tree?machineId=${machineId}&rootPath=${encodeURIComponent(rootPath)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) throw new Error("Failed to load file tree");
      const data = await res.json();
      setEntries(data);
    } catch (err: any) {
      setError(err.message || "Greška pri učitavanju");
    } finally {
      setLoading(false);
    }
  }, [machineId, rootPath, refreshKey]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  function toggleDir(path: string) {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function getIcon(entry: FileEntry): string {
    if (entry.type === "directory") {
      return expandedDirs.has(entry.path) ? "📂" : "📁";
    }
    const ext = entry.name.split(".").pop()?.toLowerCase() || "";
    const iconMap: Record<string, string> = {
      ts: "💎", tsx: "💎", js: "📦", jsx: "📦",
      css: "🎨", scss: "🎨", html: "🌐",
      json: "📋", md: "📝", py: "🐍",
      rs: "🦀", go: "🔵", java: "☕",
      svg: "🖼️", png: "🖼️", jpg: "🖼️", gif: "🖼️",
    };
    return iconMap[ext] || "📄";
  }

  if (!machineId) {
    return (
      <div className="h-full flex items-center justify-center text-[11px] text-text-muted p-3">
        Poveži VPS za pregled datoteka
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto font-mono text-[11.5px] leading-relaxed">
      {loading && entries.length === 0 && (
        <div className="flex items-center gap-2 px-3 py-2 text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Učitavam...
        </div>
      )}
      {error && (
        <div className="px-3 py-2 text-red-400 text-[10px]">
          {error}
          <button onClick={loadTree} className="ml-2 text-text-muted hover:text-text underline">
            ↻
          </button>
        </div>
      )}
      {entries.map((entry) => (
        <TreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          expandedDirs={expandedDirs}
          toggleDir={toggleDir}
          onFileSelect={onFileSelect}
          selectedFile={selectedFile}
          getIcon={getIcon}
          machineId={machineId}
        />
      ))}
    </div>
  );
}

function TreeNode({
  entry,
  depth,
  expandedDirs,
  toggleDir,
  onFileSelect,
  selectedFile,
  getIcon,
  machineId,
}: {
  entry: FileEntry;
  depth: number;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
  onFileSelect: (path: string) => void;
  selectedFile?: string;
  getIcon: (entry: FileEntry) => string;
  machineId: string | null;
}) {
  const [children, setChildren] = useState<FileEntry[]>(entry.children || []);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const isExpanded = expandedDirs.has(entry.path);
  const isSelected = selectedFile === entry.path;

  async function loadChildren() {
    if (!machineId || entry.type !== "directory") return;
    setLoadingChildren(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_BASE}/api/files/tree?machineId=${machineId}&rootPath=${encodeURIComponent(entry.path)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (res.ok) {
        const data = await res.json();
        setChildren(data);
      }
    } finally {
      setLoadingChildren(false);
    }
  }

  function handleClick() {
    if (entry.type === "directory") {
      toggleDir(entry.path);
      if (!isExpanded && children.length === 0) {
        loadChildren();
      }
    } else {
      onFileSelect(entry.path);
    }
  }

  return (
    <div>
      <div
        onClick={handleClick}
        className={`flex items-center gap-1.5 py-0.5 px-1 cursor-pointer transition-colors ${
          isSelected
            ? "bg-accent/10 text-accent"
            : "text-text-secondary hover:bg-surface-2 hover:text-text"
        }`}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        <span className="w-3.5 text-center text-[10px] shrink-0">
          {entry.type === "directory" ? (isExpanded ? "▾" : "▸") : ""}
        </span>
        <span className="w-4 text-center text-[11px] shrink-0">
          {getIcon(entry)}
        </span>
        <span className="truncate">{entry.name}</span>
        {loadingChildren && (
          <span className="ml-auto text-[9px] text-text-muted animate-pulse">...</span>
        )}
      </div>
      {entry.type === "directory" && isExpanded && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
              getIcon={getIcon}
              machineId={machineId}
            />
          ))}
          {loadingChildren && children.length === 0 && (
            <div
              className="text-text-muted text-[10px] py-0.5"
              style={{ paddingLeft: `${(depth + 1) * 14 + 4}px` }}
            >
              Učitavam...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
