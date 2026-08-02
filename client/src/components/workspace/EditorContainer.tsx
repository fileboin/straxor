import { useState, useCallback, useEffect, useRef } from "react";
import CodeEditor from "./CodeEditor";
import FileExplorer, { FileContextMenu, setFileActions } from "./FileExplorer";
import HistoryPanel from "./HistoryPanel";
import { readFile, writeFile, deleteFile, renameFile, createFile, createDir } from "../../lib/files";
import { changeHistory, describeChange, type ChangeEntry } from "../../lib/history";

interface OpenFile {
  path: string;
  name: string;
  content: string;
  dirty: boolean;
  loading: boolean;
}

interface EditorContainerProps {
  machineId: string | null;
}

export default function EditorContainer({ machineId }: EditorContainerProps) {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [showTree, setShowTree] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [treeRefresh, setTreeRefresh] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: { name: string; path: string; type: "file" | "directory" } } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Track previous content per file for change detection
  const prevContentRef = useRef<Map<string, string>>(new Map());
  // Track content loaded from disk (original baseline)
  const diskContentRef = useRef<Map<string, string>>(new Map());

  const current = openFiles.find((f) => f.path === activeFile);

  // ── File actions that update open tabs ──
  const handleFileRename = useCallback((oldPath: string, newPath: string) => {
    const newName = newPath.split("/").pop() || newPath;
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === oldPath ? { ...f, path: newPath, name: newName } : f))
    );
    setActiveFile((prev) => (prev === oldPath ? newPath : prev));
  }, []);

  const handleFileDelete = useCallback((path: string) => {
    setOpenFiles((prev) => prev.filter((f) => f.path !== path));
    setActiveFile((prev) => {
      if (prev !== path) return prev;
      const remaining = openFiles.filter((f) => f.path !== path);
      return remaining.length > 0 ? remaining[remaining.length - 1].path : null;
    });
  }, [openFiles]);

  // Register callbacks for FileExplorer
  useEffect(() => {
    setFileActions(handleFileRename);
  }, [handleFileRename]);

  const openFile = useCallback(async (path: string) => {
    if (!machineId) return;

    if (openFiles.some((f) => f.path === path)) {
      setActiveFile(path);
      return;
    }

    const name = path.split("/").pop() || path;
    setOpenFiles((prev) => [...prev, { path, name, content: "", dirty: false, loading: true }]);
    setActiveFile(path);

    try {
      const content = await readFile(machineId, path);
      setOpenFiles((prev) =>
        prev.map((f) => (f.path === path ? { ...f, content, loading: false } : f))
      );
      diskContentRef.current.set(path, content);
      prevContentRef.current.set(path, content);
    } catch (err: any) {
      setOpenFiles((prev) =>
        prev.map((f) =>
          f.path === path ? { ...f, content: `// Error: ${err.message}`, loading: false } : f
        )
      );
    }
  }, [machineId, openFiles]);

  const closeFile = useCallback((path: string) => {
    setOpenFiles((prev) => prev.filter((f) => f.path !== path));
    setActiveFile((prev) => {
      if (prev !== path) return prev;
      const remaining = openFiles.filter((f) => f.path !== path);
      return remaining.length > 0 ? remaining[remaining.length - 1].path : null;
    });
  }, [openFiles]);

  const updateContent = useCallback((path: string, content: string) => {
    setOpenFiles((prev) => {
      const file = prev.find((f) => f.path === path);
      if (!file) return prev;

      // Record the change if content actually differs from last tracked state
      const lastTracked = prevContentRef.current.get(path);
      if (lastTracked !== undefined && lastTracked !== content) {
        const fileName = path.split("/").pop() || path;
        changeHistory.record(
          path, fileName, lastTracked, content, "user",
          describeChange(lastTracked, content)
        );
      }

      return prev.map((f) => f.path === path ? { ...f, content, dirty: true } : f);
    });

    prevContentRef.current.set(path, content);
  }, []);

  const saveFile = useCallback(async () => {
    if (!machineId || !current || !current.dirty) return;
    setSaving(true);
    try {
      await writeFile(machineId, current.path, current.content);
      setOpenFiles((prev) =>
        prev.map((f) => (f.path === current.path ? { ...f, dirty: false } : f))
      );
    } catch (err: any) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [machineId, current]);

  const saveAll = useCallback(async () => {
    if (!machineId) return;
    const dirty = openFiles.filter((f) => f.dirty);
    setSaving(true);
    try {
      await Promise.all(dirty.map((f) => writeFile(machineId, f.path, f.content)));
      setOpenFiles((prev) => prev.map((f) => ({ ...f, dirty: false })));
    } finally {
      setSaving(false);
    }
  }, [machineId, openFiles]);

  // Ctrl+S to save, Ctrl+Shift+S to save all
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (e.shiftKey) saveAll();
        else saveFile();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveFile, saveAll]);

  // Ctrl+Shift+F for search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Ctrl+H for history panel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "h") {
        e.preventDefault();
        setShowHistory((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Context menu actions
  function handleContextAction(action: string, entry: { name: string; path: string; type: string }) {
    switch (action) {
      case "open":
        if (entry.type === "file") openFile(entry.path);
        break;
      case "rename": {
        const newName = window.prompt("Novo ime:", entry.name);
        if (newName && newName !== entry.name && machineId) {
          const dir = entry.path.substring(0, entry.path.lastIndexOf("/"));
          const newPath = dir ? `${dir}/${newName}` : newName;
          renameFile(machineId, entry.path, newPath)
            .then(() => { handleFileRename(entry.path, newPath); setTreeRefresh((s) => s + 1); })
            .catch(console.error);
        }
        break;
      }
      case "delete": {
        if (window.confirm(`Obrisati "${entry.name}"?`)) {
          deleteFile(machineId!, entry.path)
            .then(() => { handleFileDelete(entry.path); setTreeRefresh((s) => s + 1); })
            .catch(console.error);
        }
        break;
      }
      case "new-file": {
        const name = window.prompt("Ime nove datoteke:");
        if (name && machineId) {
          const fullPath = entry.path === "." ? name : `${entry.path}/${name}`;
          createFile(machineId, fullPath)
            .then(() => setTreeRefresh((s) => s + 1))
            .catch(console.error);
        }
        break;
      }
      case "new-dir": {
        const name = window.prompt("Ime nove mape:");
        if (name && machineId) {
          const fullPath = entry.path === "." ? name : `${entry.path}/${name}`;
          createDir(machineId, fullPath)
            .then(() => setTreeRefresh((s) => s + 1))
            .catch(console.error);
        }
        break;
      }
      case "expand":
        break;
    }
  }

  // History jump handler
  const handleHistoryJump = useCallback(async (entry: ChangeEntry, direction: "undo" | "redo") => {
    if (!machineId) return;

    // For undo: restore contentBefore. For redo: restore contentAfter.
    const restoreContent = direction === "undo" ? entry.contentBefore : entry.contentAfter;

    // Update open tabs
    setOpenFiles((prev) => {
      const file = prev.find((f) => f.path === entry.filePath);
      if (file) {
        return prev.map((f) => f.path === entry.filePath
          ? { ...f, content: restoreContent, dirty: true }
          : f
        );
      }
      // File not open — open it
      return [...prev, {
        path: entry.filePath,
        name: entry.fileName,
        content: restoreContent,
        dirty: true,
        loading: false,
      }];
    });
    setActiveFile(entry.filePath);
    prevContentRef.current.set(entry.filePath, restoreContent);

    // Write to disk
    try {
      await writeFile(machineId, entry.filePath, restoreContent);
    } catch (err) {
      console.error("History jump write failed:", err);
    }
  }, [machineId]);

  // Record agent actions (public API via window)
  useEffect(() => {
    (window as any).__straxor_history = {
      recordAgent: (filePath: string, fileName: string, before: string, after: string, desc: string) => {
        changeHistory.record(filePath, fileName, before, after, "agent", desc);
      },
    };
    return () => { delete (window as any).__straxor_history; };
  }, []);

  function getLangFromPath(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    const langMap: Record<string, string> = {
      js: "JavaScript", jsx: "React JSX", ts: "TypeScript",
      tsx: "React TSX", css: "CSS", scss: "SCSS",
      html: "HTML", json: "JSON", py: "Python",
      md: "Markdown", rs: "Rust", go: "Go",
    };
    return langMap[ext] || ext.toUpperCase();
  }

  const dirtyCount = openFiles.filter((f) => f.dirty).length;

  if (!machineId) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-text-muted">
        <div className="text-3xl opacity-30">📝</div>
        <div className="text-[12px]">Poveži GitHub repo ili VPS za uređivanje datoteka</div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden" onClick={() => setContextMenu(null)}>
      {/* File Explorer Sidebar */}
      {showTree && (
        <div className="w-56 border-r border-[#202838] bg-[#0a0e1a] flex flex-col shrink-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#202838]">
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
              Explorer
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => {
                  const name = window.prompt("Ime nove datoteke:");
                  if (name) createFile(machineId, name).then(() => setTreeRefresh((s) => s + 1));
                }}
                className="p-0.5 text-text-muted hover:text-accent text-[10px]"
                title="Nova datoteka"
              >+</button>
              <button
                onClick={() => setTreeRefresh((s) => s + 1)}
                className="p-0.5 text-text-muted hover:text-text text-[10px]"
                title="Osvježi"
              >↻</button>
              <button
                onClick={() => setSearchOpen((prev) => !prev)}
                className="p-0.5 text-text-muted hover:text-text text-[10px]"
                title="Pretraži (Ctrl+Shift+F)"
              >🔍</button>
              <button
                onClick={() => setShowTree(false)}
                className="p-0.5 text-text-muted hover:text-text text-[10px]"
                title="Sakrij panel"
              >✕</button>
            </div>
          </div>

          {/* Search */}
          {searchOpen && (
            <div className="px-2 py-1 border-b border-[#202838]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtriraj datoteke..."
                className="w-full px-2 py-1 bg-[#111] text-text text-[11px] rounded border border-[#333] focus:border-accent outline-none"
                autoFocus
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <FileExplorer
              machineId={machineId}
              onFileSelect={openFile}
              selectedFile={activeFile || undefined}
              refreshKey={treeRefresh}
              searchFilter={searchQuery || undefined}
            />
          </div>
        </div>
      )}

      {/* Editor area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center h-8 bg-[#0e1422] border-b border-[#202838] overflow-x-auto shrink-0">
          {!showTree && (
            <button
              onClick={() => setShowTree(true)}
              className="h-full px-2 text-text-muted hover:text-text text-[11px] border-r border-[#202838] shrink-0"
              title="Prikaži explorer"
            >📁</button>
          )}
          {openFiles.map((file) => (
            <div
              key={file.path}
              onClick={() => setActiveFile(file.path)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, entry: { ...file, type: "file" as const } });
              }}
              className={`group flex items-center gap-1.5 h-full px-3 text-[11px] border-r border-[#202838] cursor-pointer shrink-0 transition-colors ${
                file.path === activeFile
                  ? "bg-[#111] text-text"
                  : "text-text-muted hover:bg-[#141824] hover:text-text-secondary"
              }`}
            >
              {file.dirty && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
              <span className="truncate max-w-[100px]">{file.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); closeFile(file.path); }}
                className="opacity-0 group-hover:opacity-100 ml-1 text-text-muted hover:text-red-400 text-[10px] shrink-0"
              >✕</button>
            </div>
          ))}
          {openFiles.length === 0 && (
            <div className="px-3 text-[11px] text-text-muted italic">
              Otvori datoteku iz explorer-a
            </div>
          )}
        </div>

        {/* Editor content */}
        <div className="flex-1 overflow-hidden">
          {current ? (
            current.loading ? (
              <div className="flex items-center justify-center h-full gap-2 text-text-muted text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Učitavam {current.name}…
              </div>
            ) : (
              <CodeEditor
                key={current.path}
                content={current.content}
                filename={current.name}
                onChange={(content) => updateContent(current.path, content)}
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
              <div className="text-4xl opacity-10">📝</div>
              <div className="text-[12px]">Otvori datoteku iz explorer-a</div>
              <div className="text-[10px] opacity-50">
                Ctrl+S spremi &middot; Ctrl+Shift+S spremi sve &middot; Ctrl+Shift+F pretraga
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        {current && (
          <div className="flex items-center justify-between h-6 px-3 bg-[#0e1422] border-t border-[#202838] text-[10px] text-text-muted shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-accent/70">{getLangFromPath(current.path)}</span>
              <span className="truncate max-w-[250px] opacity-60">{current.path}</span>
            </div>
            <div className="flex items-center gap-3">
              {dirtyCount > 1 && (
                <span className="text-text-muted">{dirtyCount} nespremljenih</span>
              )}
              {saving && (
                <span className="text-accent animate-pulse">Spremam…</span>
              )}
              {current.dirty && !saving && (
                <span className="text-accent">● nespremljeno</span>
              )}
              <button
                onClick={saveFile}
                disabled={!current.dirty || saving}
                className={`hover:text-text ${!current.dirty || saving ? "opacity-30 cursor-not-allowed" : ""}`}
              >💾</button>
              <button
                onClick={() => setShowHistory(true)}
                className="text-text-muted hover:text-text"
                title="Povijest promjena (Ctrl+H)"
              >↶</button>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <FileContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onAction={(action) => handleContextAction(action, contextMenu.entry)}
        />
      )}

      {/* History Panel */}
      <HistoryPanel
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onJump={handleHistoryJump}
      />
    </div>
  );
}
