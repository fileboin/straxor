import { useState } from "react";

type Tab = "terminal" | "files";

const MOCK_FILES = [
  { name: "src/", folder: true, indent: 0 },
  { name: "App.tsx", folder: false, indent: 1 },
  { name: "main.tsx", folder: false, indent: 1 },
  { name: "index.css", folder: false, indent: 1 },
  { name: "components/", folder: true, indent: 1 },
  { name: "Hero.tsx", folder: false, indent: 2 },
  { name: "Features.tsx", folder: false, indent: 2 },
  { name: "CTA.tsx", folder: false, indent: 2 },
  { name: "index.html", folder: false, indent: 0 },
  { name: "package.json", folder: false, indent: 0 },
  { name: "vite.config.ts", folder: false, indent: 0 },
];

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

export default function BottomBar() {
  const [tab, setTab] = useState<Tab>("terminal");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border-t border-border bg-surface shrink-0">
      <div className="flex items-center px-3 border-b border-border">
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
        <div className="h-40 overflow-y-auto font-mono text-[11.5px] leading-[1.8] text-text-secondary bg-bg p-3">
          {tab === "terminal" &&
            MOCK_TERMINAL.map((line, i) => {
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

          {tab === "files" && (
            <div>
              {MOCK_FILES.map((f, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-1.5 py-0.5 px-0 hover:bg-surface-2 cursor-pointer transition-colors ${
                    f.folder ? "text-text font-medium" : "text-text-secondary"
                  }`}
                  style={{ paddingLeft: `${f.indent * 16 + 4}px` }}
                >
                  <span className="w-3.5 text-center text-[11px]">
                    {f.folder ? "📁" : "📄"}
                  </span>
                  <span>{f.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
