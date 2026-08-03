import { useState, useEffect } from "react";
import LogViewer from "./LogViewer";
import ConsolePanel from "./ConsolePanel";
import EditorContainer from "./EditorContainer";
import PreviewPanel from "./PreviewPanel";
import DatabasePanel from "./DatabasePanel";

type Tab = "terminal" | "files" | "logs" | "console" | "preview" | "database";

const MOCK_TERMINAL = [
  { type: "cmd" as const, text: "~/straxor-landing $ npm create vite@latest . -- --template react-ts" },
  { type: "output" as const, text: "✓ Scaffolding project in ..." },
  { type: "success" as const, text: "✓ Done." },
  { type: "blank" as const, text: "" },
  { type: "cmd" as const, text: "~/straxor-landing $ npm install && npm install -D tailwindcss" },
  { type: "output" as const, text: "added 145 packages in 9s" },
  { type: "blank" as const, text: "" },
  { type: "cmd" as const, text: "~/straxor-landing $ npm run build" },
  { type: "output" as const, text: "vite v6.0.0 building for production..." },
  { type: "success" as const, text: "✓ built in 1.24s" },
  { type: "blank" as const, text: "" },
  { type: "cursor" as const, text: "~/straxor-landing $" },
];

function TerminalContent() {
  return (
    <div className="h-full overflow-y-auto font-mono text-[11.5px] leading-[1.8] text-text-secondary bg-bg p-3">
      {MOCK_TERMINAL.map((line, i) => {
        if (line.type === "blank") return <div key={i}>&nbsp;</div>;
        if (line.type === "cursor")
          return (
            <div key={i}>
              <span className="text-accent">{line.text} </span>
              <span className="inline-block w-[7px] h-[13px] bg-accent animate-pulse align-middle" />
            </div>
          );
        return (
          <div key={i} className="whitespace-pre-wrap">
            {line.type === "cmd" && (
              <>
                <span className="text-accent">$ </span>
                <span className="text-text">{line.text.replace("~/straxor-landing $ ", "")}</span>
              </>
            )}
            {line.type === "output" && <span className="text-text-muted">{line.text}</span>}
            {line.type === "success" && <span className="text-accent">{line.text}</span>}
          </div>
        );
      })}
    </div>
  );
}

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
}

export default function BottomBar({ machineId }: BottomBarProps) {
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
            {tab === "terminal" && <TerminalContent />}
            {tab === "files" && <div className="h-full"><EditorContainer machineId={machineId || null} /></div>}
            {tab === "logs" && <LogViewer />}
            {tab === "console" && <ConsolePanel />}
            {tab === "preview" && <div className="h-full"><PreviewPanel machineId={machineId || null} /></div>}
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
              {tab === "terminal" && <TerminalContent />}
              {tab === "files" && <div className="h-full"><EditorContainer machineId={machineId || null} /></div>}
              {tab === "logs" && <LogViewer />}
              {tab === "console" && <ConsolePanel />}
            {tab === "preview" && <div className="h-full"><PreviewPanel machineId={machineId || null} /></div>}
            {tab === "database" && <div className="h-full"><DatabasePanel machineId={machineId || null} /></div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
