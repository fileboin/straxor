import { useState, useEffect, useCallback, useRef } from "react";
import { renameFile, createFile, createDir } from "../../lib/files";

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
  onRefresh?: () => void;
  searchFilter?: string;
}

type ContextMenu = { x: number; y: number; entry: FileEntry } | null;

export default function FileExplorer({ machineId, rootPath = ".", onFileSelect, selectedFile, refreshKey, onRefresh, searchFilter }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(["."]));
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [creatingIn, setCreatingIn] = useState<{ dirPath: string; type: "file" | "directory" } | null>(null);
  const [refreshSeq, setRefreshSeq] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const effectiveRefresh = (refreshKey || 0) + refreshSeq;

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
      if (!res.ok) throw new Error("Greška pri učitavanju");
      const data = await res.json();
      setEntries(data);
    } catch (err: any) {
      setError(err.message || "Greška");
    } finally {
      setLoading(false);
    }
  }, [machineId, rootPath, effectiveRefresh]);

  useEffect(() => { loadTree(); }, [loadTree]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
        setCreatingIn(null);
        setRenamingPath(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function triggerRefresh() {
    setRefreshSeq((s) => s + 1);
    onRefresh?.();
  }

  function toggleDir(path: string) {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function expandDir(path: string) {
    setExpandedDirs((prev) => new Set(prev).add(path));
  }

  function getIcon(entry: FileEntry, expanded: boolean): string {
    if (entry.type === "directory") return expanded ? "▾" : "▸";
    const ext = entry.name.split(".").pop()?.toLowerCase() || "";
    const map: Record<string, string> = {
      ts: "TS", tsx: "TX", js: "JS", jsx: "JX",
      css: "CS", scss: "SC", html: "HT", json: "JO",
      md: "MD", py: "PY", rs: "RS", go: "GO",
      java: "JV", svg: "SV", png: "IM", jpg: "IM", gif: "IM",
      lock: "LK", env: "EN", gitignore: "GI", yaml: "YL", yml: "YL",
    };
    return map[ext] || "··";
  }

  function getIconColor(entry: FileEntry): string {
    if (entry.type === "directory") return "text-[#dcb67a]";
    const ext = entry.name.split(".").pop()?.toLowerCase() || "";
    const colors: Record<string, string> = {
      ts: "text-[#3178c6]", tsx: "text-[#3178c6]",
      js: "text-[#f7df1e]", jsx: "text-[#f7df1e]",
      css: "text-[#264de4]", scss: "text-[#cd6799]",
      html: "text-[#e34c26]", json: "text-[#cbcb41]",
      md: "text-[#519aba]", py: "text-[#3572a5]",
      rs: "text-[#dea584]", go: "text-[#00add8]",
      lock: "text-text-muted", env: "text-[#ecd53f]",
    };
    return colors[ext] || "text-text-secondary";
  }

  // ── Context menu actions ──

  function handleContextMenu(e: React.MouseEvent, entry: FileEntry) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  }

  async function handleRename(entry: FileEntry, newName: string) {
    if (!machineId || !newName || newName === entry.name) {
      setRenamingPath(null);
      return;
    }

    const dir = entry.path.substring(0, entry.path.lastIndexOf("/"));
    const newPath = dir ? `${dir}/${newName}` : newName;

    try {
      await renameFile(machineId, entry.path, newPath);
      // Update open file tabs if renamed
      if (onFileRename) onFileRename(entry.path, newPath);
      triggerRefresh();
    } catch (err: any) {
      setError(`Rename failed: ${err.message}`);
    }
    setRenamingPath(null);
  }

  async function handleCreate(dirPath: string, type: "file" | "directory", name: string) {
    if (!machineId || !name) {
      setCreatingIn(null);
      return;
    }

    const fullPath = dirPath === "." ? name : `${dirPath}/${name}`;

    try {
      if (type === "directory") {
        await createDir(machineId, fullPath);
      } else {
        await createFile(machineId, fullPath);
      }
      expandDir(dirPath);
      triggerRefresh();
    } catch (err: any) {
      setError(`Create failed: ${err.message}`);
    }
    setCreatingIn(null);
  }

  if (!machineId) {
    return (
      <div className="h-full flex items-center justify-center text-[11px] text-text-muted p-3">
        Poveži VPS za pregled datoteka
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto font-mono text-[11.5px] leading-relaxed select-none">
      {loading && entries.length === 0 && (
        <div className="flex items-center gap-2 px-3 py-2 text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Učitavam...
        </div>
      )}
      {error && (
        <div className="px-3 py-2 text-red-400 text-[10px] flex items-center gap-2">
          <span className="flex-1 truncate">{error}</span>
          <button onClick={() => setError(null)} className="text-text-muted hover:text-text">✕</button>
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
          getIconColor={getIconColor}
          machineId={machineId}
          searchFilter={searchFilter}
          onContextMenu={handleContextMenu}
          renamingPath={renamingPath}
          setRenamingPath={setRenamingPath}
          onRename={handleRename}
          creatingIn={creatingIn}
          setCreatingIn={setCreatingIn}
          onCreate={handleCreate}
        />
      ))}
    </div>
  );
}

// ── Actions exposed to parent ──
let onFileRename: ((oldPath: string, newPath: string) => void) | undefined;

export function setFileActions(rename?: (old: string, next: string) => void) {
  onFileRename = rename;
}

// ── Tree Node ──

function TreeNode({
  entry, depth, expandedDirs, toggleDir, onFileSelect, selectedFile,
  getIcon, getIconColor, machineId, searchFilter,
  onContextMenu, renamingPath, setRenamingPath, onRename,
  creatingIn, setCreatingIn, onCreate,
}: {
  entry: FileEntry;
  depth: number;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
  onFileSelect: (path: string) => void;
  selectedFile?: string;
  getIcon: (entry: FileEntry, expanded: boolean) => string;
  getIconColor: (entry: FileEntry) => string;
  machineId: string | null;
  searchFilter?: string;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  renamingPath: string | null;
  setRenamingPath: (path: string | null) => void;
  onRename: (entry: FileEntry, newName: string) => void;
  creatingIn: { dirPath: string; type: "file" | "directory" } | null;
  setCreatingIn: (v: { dirPath: string; type: "file" | "directory" } | null) => void;
  onCreate: (dirPath: string, type: "file" | "directory", name: string) => void;
}) {
  const [children, setChildren] = useState<FileEntry[]>(entry.children || []);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [renameValue, setRenameValue] = useState(entry.name);
  const [createValue, setCreateValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const isExpanded = expandedDirs.has(entry.path);
  const isSelected = selectedFile === entry.path;
  const isRenaming = renamingPath === entry.path;
  const isCreating = creatingIn?.dirPath === entry.path;

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(entry.name);
      setTimeout(() => renameInputRef.current?.select(), 10);
    }
  }, [isRenaming, entry.name]);

  useEffect(() => {
    if (isCreating) {
      setCreateValue("");
      setTimeout(() => createInputRef.current?.focus(), 10);
    }
  }, [isCreating]);

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
      if (!isExpanded && children.length === 0) loadChildren();
    } else {
      onFileSelect(entry.path);
    }
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") onRename(entry, renameValue.trim());
    if (e.key === "Escape") setRenamingPath(null);
  }

  function handleCreateKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") onCreate(entry.path, creatingIn!.type, createValue.trim());
    if (e.key === "Escape") setCreatingIn(null);
  }

  // Filter: if search active, hide non-matching non-directory entries
  if (searchFilter && entry.type === "file") {
    const filter = searchFilter.toLowerCase();
    if (!entry.name.toLowerCase().includes(filter) && !entry.path.toLowerCase().includes(filter)) {
      return null;
    }
  }

  return (
    <div>
      <div
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, entry)}
        className={`group flex items-center h-[24px] cursor-pointer transition-colors ${
          isSelected
            ? "bg-accent/10 text-accent"
            : "text-text-secondary hover:bg-surface-2 hover:text-text"
        }`}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        <span className={`w-3.5 text-center text-[9px] shrink-0 font-mono ${getIconColor(entry)}`}>
          {getIcon(entry, isExpanded)}
        </span>
        <span className={`ml-0.5 text-[9px] shrink-0 font-bold tracking-wider uppercase ${getIconColor(entry)}`}>
          {entry.type === "directory" ? "" : getIcon(entry, false)}
        </span>
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={() => onRename(entry, renameValue.trim())}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 ml-1 px-0.5 -my-0.5 bg-[#111] text-text text-[11px] border border-accent outline-none rounded-sm"
          />
        ) : (
          <span className="flex-1 min-w-0 ml-1 truncate">{entry.name}</span>
        )}
        {loadingChildren && (
          <span className="mr-1 text-[9px] text-text-muted animate-pulse">…</span>
        )}
        {/* Hover action buttons */}
        {entry.type === "directory" && !isRenaming && !isCreating && (
          <div className="hidden group-hover:flex items-center gap-0.5 mr-1 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setCreatingIn({ dirPath: entry.path, type: "file" }); }}
              className="p-0.5 text-text-muted hover:text-accent text-[10px]"
              title="Nova datoteka"
            >+</button>
          </div>
        )}
      </div>

      {/* Creating input inside directory */}
      {entry.type === "directory" && isExpanded && isCreating && (
        <div
          className="flex items-center h-[24px] bg-accent/5"
          style={{ paddingLeft: `${(depth + 1) * 14 + 4}px` }}
        >
          <span className="w-3.5 text-center text-[9px] text-accent shrink-0">+</span>
          <span className="ml-0.5 text-[9px] text-accent shrink-0 font-bold">
            {creatingIn.type === "file" ? "FI" : "DI"}
          </span>
          <input
            ref={createInputRef}
            value={createValue}
            onChange={(e) => setCreateValue(e.target.value)}
            onKeyDown={handleCreateKeyDown}
            onBlur={() => {
              if (createValue.trim()) onCreate(entry.path, creatingIn.type, createValue.trim());
              else setCreatingIn(null);
            }}
            placeholder={creatingIn.type === "file" ? "ime-datoteke.ext" : "ime-mapa"}
            className="flex-1 min-w-0 ml-1 px-0.5 -my-0.5 bg-[#111] text-text text-[11px] border border-accent outline-none rounded-sm placeholder:text-text-muted/40"
          />
        </div>
      )}

      {/* Children */}
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
              getIconColor={getIconColor}
              machineId={machineId}
              searchFilter={searchFilter}
              onContextMenu={onContextMenu}
              renamingPath={renamingPath}
              setRenamingPath={setRenamingPath}
              onRename={onRename}
              creatingIn={creatingIn}
              setCreatingIn={setCreatingIn}
              onCreate={onCreate}
            />
          ))}
          {loadingChildren && children.length === 0 && (
            <div
              className="text-text-muted text-[10px] py-0.5"
              style={{ paddingLeft: `${(depth + 1) * 14 + 4}px` }}
            >
              Učitavam…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Context Menu Component ──

export function FileContextMenu({
  menu, onClose, onAction,
}: {
  menu: { x: number; y: number; entry: FileEntry };
  onClose: () => void;
  onAction: (action: string, entry: FileEntry) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const entry = menu.entry;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const items = [
    ...(entry.type === "file"
      ? [{ label: "Otvori", icon: "→", action: "open" }]
      : [{ label: "Proširi", icon: "▸", action: "expand" }]),
    { label: "Preimenuj", icon: "✎", action: "rename" },
    { label: "Obriši", icon: "✕", action: "delete", danger: true },
    ...(entry.type === "directory"
      ? [
          { divider: true } as const,
          { label: "Nova datoteka", icon: "+", action: "new-file" },
          { label: "Nova mapa", icon: "+", action: "new-dir" },
        ]
      : []),
  ];

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-[#111] border border-[#333] rounded-md shadow-xl shadow-black/50 py-1 min-w-[140px] text-[11px]"
      style={{ left: menu.x, top: menu.y }}
    >
      {items.map((item, i) => {
        if ("divider" in item && item.divider) {
          return <div key={i} className="my-1 border-t border-[#333]" />;
        }
        const it = item as { label: string; icon: string; action: string; danger?: boolean };
        return (
          <button
            key={it.action}
            onClick={() => { onAction(it.action, entry); onClose(); }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
              it.danger
                ? "text-red-400 hover:bg-red-500/10"
                : "text-text-secondary hover:bg-surface-2 hover:text-text"
            }`}
          >
            <span className="w-3.5 text-center text-[10px] opacity-60">{it.icon}</span>
            <span>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
