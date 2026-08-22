import { useState, useEffect, useRef, useCallback } from "react";
import {
  startTerminal,
  cancelTerminal,
  streamTerminal,
  type TerminalEvent,
} from "../../lib/terminal.js";

interface Props {
  machineId?: string | null;
  owner?: string | null;
  name?: string | null;
  taskId?: string | null;
}

interface ActiveRun {
  processId: string;
  command: string;
  lines: { kind: "out" | "err" | "exit" | "info"; text: string }[];
  status: string;
}

const HELP = [
  { cmd: "npm install", desc: "Instaliraj zavisnosti u sandbox" },
  { cmd: "npm run build", desc: "Build projekta" },
  { cmd: "npm test", desc: "Pokreni testove" },
  { cmd: "git status", desc: "Stanje repoa u sandboxu" },
  { cmd: "ls", desc: "Listaj fajlove workspace-a" },
];

export default function TerminalPanel({ owner, name, taskId }: Props) {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [runs, setRuns] = useState<ActiveRun[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [runs, autoScroll]);

  const appendLine = (processId: string, kind: ActiveRun["lines"][number]["kind"], text: string) => {
    setRuns((prev) =>
      prev.map((r) => (r.processId === processId ? { ...r, lines: [...r.lines, { kind, text }] } : r))
    );
  };

  const handleEvent = useCallback(
    (processId: string) => (event: TerminalEvent) => {
      if (event.processId !== processId) return;
      if (event.type === "stdout" && event.data) {
        appendLine(processId, "out", event.data);
      } else if (event.type === "stderr" && event.data) {
        appendLine(processId, "err", event.data);
      } else if (event.type === "exit") {
        setRuns((prev) =>
          prev.map((r) =>
            r.processId === processId
              ? {
                  ...r,
                  status: event.status || "finished",
                  lines: [
                    ...r.lines,
                    { kind: "exit" as const, text: `\n[proces završen: ${event.status || "finished"}${event.exitCode !== null ? `, exit ${event.exitCode}` : ""}]` },
                  ],
                }
              : r
          )
        );
        setRunningId((cur) => (cur === processId ? null : cur));
      }
    },
    []
  );

  const execute = async (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    setHistory((h) => [cmd, ...h.filter((x) => x !== cmd)].slice(0, 100));
    setHistoryIdx(-1);

    const processId = `tmp-${Date.now()}`;
    const run: ActiveRun = { processId, command: cmd, lines: [], status: "running" };
    setRuns((prev) => [...prev, run]);
    setRunningId(processId);

    const cwdHint = owner && name ? `${owner}/${name}` : "sandbox (bez repo-a)";

    try {
      const res = await startTerminal({
        owner: owner || undefined,
        name: name || undefined,
        command: cmd,
        taskId: taskId ?? undefined,
        slot: "agent",
      });
      appendLine(processId, "info", `$ ${cmd}   (u: ${cwdHint})`);
      // Open the SSE stream — it replays buffered output, streams live
      // stdout/stderr, and closes itself on the exit event.
      streamTerminal(res.processId, handleEvent(res.processId));
    } catch (err) {
      appendLine(processId, "err", `Greška: ${(err as Error)?.message || "neuspjeh"}`);
      setRuns((prev) =>
        prev.map((r) =>
          r.processId === processId ? { ...r, status: "failed", lines: [...r.lines, { kind: "exit" as const, text: "\n[neuspjeh]" }] } : r
        )
      );
      setRunningId((cur) => (cur === processId ? null : cur));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      void execute(command);
      setCommand("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, history.length - 1);
      if (next >= 0) {
        setHistoryIdx(next);
        setCommand(history[next]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = historyIdx - 1;
      if (next < 0) {
        setHistoryIdx(-1);
        setCommand("");
      } else {
        setHistoryIdx(next);
        setCommand(history[next]);
      }
    } else if (e.key === "c" && e.ctrlKey) {
      e.preventDefault();
      if (runningId) void cancelTerminal(runningId, "SIGINT");
    }
  };

  const focusInput = () => inputRef.current?.focus();

  return (
    <div className="flex flex-col h-full bg-bg" onClick={focusInput}>
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-surface shrink-0 sm:px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted shrink-0">
          Terminal
        </span>
        <span className="text-[10px] text-text-muted truncate shrink-0 max-w-[160px]">
          {owner && name ? `${owner}/${name}` : "sandbox (bez repo-a)"}
        </span>
        <div className="flex-1" />
        {runningId && (
          <span className="flex items-center gap-1 text-[10px] text-accent shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
            izvršavam…
          </span>
        )}
        <button
          onClick={() => setRuns([])}
          className="px-1.5 py-0.5 text-[10px] text-text-muted hover:text-text border border-border rounded transition-colors shrink-0"
          title="Očisti prikaz"
        >
          Clear
        </button>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors shrink-0 ${
            autoScroll ? "text-accent border-accent/30 bg-accent/10" : "text-text-muted border-border hover:text-text-secondary"
          }`}
        >
          Auto
        </button>
      </div>

      {/* Output */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto font-mono text-[11.5px] leading-[1.8] text-text-secondary p-3">
        {runs.length === 0 && (
          <div className="text-text-muted text-[11px] space-y-1">
            <div>Interaktivni terminal — kucaj komandu ispod i pritisni Enter.</div>
            <div>Izvršava se na serveru u tvom sandbox workspace-u (npm, git, build, test).</div>
            <div className="pt-2 space-y-0.5">
              {HELP.map((h) => (
                <button
                  key={h.cmd}
                  type="button"
                  onClick={() => { setCommand(h.cmd); inputRef.current?.focus(); }}
                  className="block text-left w-full px-1 py-0.5 rounded hover:bg-surface-2 transition-colors"
                >
                  <span className="text-accent">$ {h.cmd}</span>
                  <span className="text-text-muted"> — {h.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {runs.map((run, i) => (
          <div key={run.processId} className={i > 0 ? "mt-3 border-t border-border/40 pt-2" : ""}>
            {run.lines.map((line, j) => {
              if (line.kind === "out")
                return (
                  <div key={j} className="whitespace-pre-wrap text-text-secondary">
                    {line.text}
                  </div>
                );
              if (line.kind === "err")
                return (
                  <div key={j} className="whitespace-pre-wrap text-red-400">
                    {line.text}
                  </div>
                );
              if (line.kind === "info")
                return (
                  <div key={j} className="text-text">
                    <span className="text-accent">{line.text}</span>
                  </div>
                );
              return (
                <div key={j} className="text-text-muted text-[10px]">
                  {line.text}
                </div>
              );
            })}
            {run.status === "running" && (
              <div className="text-accent">
                <span className="inline-block w-[7px] h-[13px] bg-accent animate-pulse align-middle" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="px-2 py-1.5 border-t border-border bg-surface shrink-0 flex items-center gap-1.5 sm:px-3">
        <span className="text-accent text-[11.5px] font-mono shrink-0">$</span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="npr. npm install, git status, ls, npm run build"
          className="flex-1 bg-transparent text-text text-[12px] font-mono placeholder:text-text-muted outline-none border-none min-w-0"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Terminal komanda"
        />
        {runningId && (
          <button
            onClick={() => void cancelTerminal(runningId)}
            className="px-2 py-1 text-[10px] rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
            title="Prekini (SIGTERM); Ctrl+C = SIGINT"
          >
            ✕ Prekini
          </button>
        )}
        <button
          onClick={() => { void execute(command); setCommand(""); }}
          disabled={!command.trim()}
          className="px-2 py-1 text-[10px] rounded border border-accent/40 text-accent hover:bg-accent/10 transition-colors shrink-0 disabled:opacity-40"
        >
          Pokreni
        </button>
      </div>
    </div>
  );
}