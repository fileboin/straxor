import { useState, useEffect } from "react";
import LogViewer from "./LogViewer";
import ConsolePanel from "./ConsolePanel";
import EditorContainer from "./EditorContainer";
import PreviewPanel from "./PreviewPanel";
import DatabasePanel from "./DatabasePanel";
import TerminalPanel from "./TerminalPanel";

type Tab = "terminal" | "files" | "logs" | "console" | "preview" | "database";

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <>
      <button
        onClick={() => setTab("terminal")}
        className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
          tab === "terminal"
            ? "text-text border-accent"
            : "text-text-muted border-transparent hover:text-text-secondary"
        }`}
      >
        Terminal
      </button>
      <button
        onClick={() => setTab("files")}
        className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
          tab === "files"
            ? "text-text border-accent"
            : "text-text-muted border-transparent hover:text-text-secondary"
        }`}
      >
        Datoteke
      </button>
      <button
        onClick={() => setTab("logs")}
        className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
          tab === "logs"
            ? "text-text border-accent"
            : "text-text-muted border-transparent hover:text-text-secondary"
        }`}
      >
        Logovi
      </button>
      <button
        onClick={() => setTab("console")}
        className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
          tab === "console"
            ? "text-text border-accent"
            : "text-text-muted border-transparent hover:text-text-secondary"
        }`}
      >
        Konzola
      </button>
      <button
        onClick={() => setTab("preview")}
        className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
          tab === "preview"
            ? "text-text border-accent"
            : "text-text-muted border-transparent hover:text-text-secondary"
        }`}
      >
        Preview
      </button>
      <button
        onClick={() => setTab("database")}
        className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
          tab === "database"
            ? "text-text border-accent"
            : "text-text-muted border-transparent hover:text-text-secondary"
        }`}
      >
        Baza
      </button>
    </>
  );
}

interface BottomBarProps {
  machineId?: string | null;
  owner?: string | null;
  name?: string | null;
  taskId?: string | null;
}

export default function BottomBar({ machineId, owner, name, taskId }: BottomBarProps) {
  const [tab, setTab] = useState<Tab>("terminal");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sheet on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) setMobileOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop bottom bar — hidden on mobile */}
      <div className="hidden md:block border-t border-border bg-surface shrink-0">
        <div className="flex items-center px-3 border-b border-border">
          <TabBar tab={tab} setTab={setTab} />
          <div className="ml-auto">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="px-1.5 py-0.5 rounded text-text-muted text-sm hover:text-text-secondary transition-colors"
            >
              {collapsed ? "▸" : "▾"}
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className={`${tab === "preview" || tab === "database" ? "h-80" : "h-40"} overflow-hidden transition-all`}>
            {tab === "terminal" && <div className="h-full"><TerminalPanel machineId={machineId || null} owner={owner || null} name={name || null} taskId={taskId || null} /></div>}
            {tab === "files" && <div className="h-full"><EditorContainer machineId={machineId || null} /></div>}
            {tab === "logs" && <LogViewer />}
            {tab === "console" && <ConsolePanel />}
            {tab === "preview" && <div className="h-full"><PreviewPanel machineId={machineId || null} owner={owner || null} name={name || null} taskId={taskId || null} /></div>}
            {tab === "database" && <div className="h-full"><DatabasePanel machineId={machineId || null} /></div>}
          </div>
        )}
      </div>

      {/* Mobile floating toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed bottom-4 left-4 z-40 w-11 h-11 rounded-full border border-border bg-surface shadow-lg shadow-black/40 flex items-center justify-center text-text-secondary hover:text-text hover:border-border-light transition-colors"
        title="Terminal / Datoteke / Logovi / Konzola"
      >
        <span className="text-sm">▸</span>
      </button>

      {/* Mobile bottom sheet */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          {/* Sheet */}
          <div className="relative bg-surface border-t border-border rounded-t-2xl shadow-2xl flex flex-col max-h-[75vh] animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-8 h-1 rounded-full bg-text-muted/30" />
            </div>

            {/* Tabs */}
            <div className="flex items-center px-2 border-b border-border">
              <TabBar tab={tab} setTab={setTab} />
              <div className="ml-auto">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="px-2 py-1 text-text-muted text-xs hover:text-text transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {tab === "terminal" && <div className="h-full"><TerminalPanel machineId={machineId || null} owner={owner || null} name={name || null} taskId={taskId || null} /></div>}
              {tab === "files" && <div className="h-full"><EditorContainer machineId={machineId || null} /></div>}
              {tab === "logs" && <LogViewer />}
              {tab === "console" && <ConsolePanel />}
            {tab === "preview" && <div className="h-full"><PreviewPanel machineId={machineId || null} owner={owner || null} name={name || null} taskId={taskId || null} /></div>}
            {tab === "database" && <div className="h-full"><DatabasePanel machineId={machineId || null} /></div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
