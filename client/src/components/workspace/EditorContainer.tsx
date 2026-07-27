import { useState, useCallback, useEffect } from "react";
import CodeEditor from "./CodeEditor";
import FileTree from "./FileTree";
import { readFile, writeFile } from "../../lib/files";

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

  const current = openFiles.find((f) => f.path === activeFile);

  const openFile = useCallback(async (path: string) => {
    if (!machineId) return;

    // If already open, just select it
    if (openFiles.some((f) => f.path === path)) {
      setActiveFile(path);
      return;
    }

    const name = path.split("/").pop() || path;

    // Add loading placeholder
    setOpenFiles((prev) => [...prev, { path, name, content: "", dirty: false, loading: true }]);
    setActiveFile(path);

    try {
      const content = await readFile(machineId, path);
      setOpenFiles((prev) =>
        prev.map((f) => (f.path === path ? { ...f, content, loading: false } : f))
      );
    } catch (err: any) {
      setOpenFiles((prev) =>
        prev.map((f) =>
          f.path === path
            ? { ...f, content: `// Error: ${err.message}`, loading: false }
            : f
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
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, content, dirty: true } : f))
    );
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

  // Ctrl+S to save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveFile]);

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

  if (!machineId) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-text-muted">
        <div className="text-3xl opacity-30">📝</div>
        <div className="text-[12px]">Poveži VPS za uređivanje datoteka</div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* File Tree Sidebar */}
      {showTree && (
        <div className="w-52 border-r border-[#1a1a1a] bg-[#050505] flex flex-col shrink-0 overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1a1a1a]">
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
              Explorer
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSearchOpen((prev) => !prev)}
                className="p-0.5 text-text-muted hover:text-text"
                title="Search (Ctrl+Shift+F)"
              >
                🔍
              </button>
              <button
                onClick={() => setShowTree(false)}
                className="p-0.5 text-text-muted hover:text-text"
                title="Hide tree"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Search bar */}
          {searchOpen && (
            <div className="px-2 py-1 border-b border-[#1a1a1a]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pretraži datoteke..."
                className="w-full px-2 py-1 bg-[#111] text-text text-[11px] rounded border border-[#333] focus:border-accent outline-none"
                autoFocus
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <FileTree
              machineId={machineId}
              onFileSelect={openFile}
              selectedFile={activeFile || undefined}
            />
          </div>
        </div>
      )}

      {/* Editor area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center h-8 bg-[#0a0a0a] border-b border-[#1a1a1a] overflow-x-auto shrink-0">
          {!showTree && (
            <button
              onClick={() => setShowTree(true)}
              className="h-full px-2 text-text-muted hover:text-text text-[11px] border-r border-[#1a1a1a] shrink-0"
              title="Show file tree"
            >
              📁
            </button>
          )}
          {openFiles.map((file) => (
            <div
              key={file.path}
              onClick={() => setActiveFile(file.path)}
              className={`group flex items-center gap-1.5 h-full px-3 text-[11px] border-r border-[#1a1a1a] cursor-pointer shrink-0 transition-colors ${
                file.path === activeFile
                  ? "bg-[#111] text-text"
                  : "text-text-muted hover:bg-[#0d0d0d] hover:text-text-secondary"
              }`}
            >
              {file.dirty && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
              <span className="truncate max-w-[100px]">{file.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); closeFile(file.path); }}
                className="opacity-0 group-hover:opacity-100 ml-1 text-text-muted hover:text-red-400 text-[10px] shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
          {openFiles.length === 0 && (
            <div className="px-3 text-[11px] text-text-muted italic">
              Otvori datoteku iz stabla
            </div>
          )}
        </div>

        {/* Editor content */}
        <div className="flex-1 overflow-hidden">
          {current ? (
            current.loading ? (
              <div className="flex items-center justify-center h-full gap-2 text-text-muted text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Učitavam {current.name}...
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
              <div className="text-[12px]">
                Otvori datoteku iz bočnog panela
              </div>
              <div className="text-[10px] opacity-50">
                Ctrl+S za spremanje &middot; Ctrl+Shift+F za pretragu
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        {current && (
          <div className="flex items-center justify-between h-6 px-3 bg-[#0a0a0a] border-t border-[#1a1a1a] text-[10px] text-text-muted shrink-0">
            <div className="flex items-center gap-3">
              <span>{getLangFromPath(current.path)}</span>
              <span className="truncate max-w-[200px]">{current.path}</span>
            </div>
            <div className="flex items-center gap-3">
              {saving && (
                <span className="text-accent animate-pulse">Spremam...</span>
              )}
              {current.dirty && !saving && (
                <span className="text-accent">● nespremljeno</span>
              )}
              <button
                onClick={saveFile}
                disabled={!current.dirty || saving}
                className={`hover:text-text ${!current.dirty || saving ? "opacity-30 cursor-not-allowed" : ""}`}
              >
                💾
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
