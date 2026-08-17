import { useEffect, useRef, useState } from "react";
import {
  approveTeamTask,
  fetchTeamTask,
  startTeamRun,
  type TeamJobStatus,
  type TeamRunResult,
  type TeamTaskDetail,
} from "../../lib/team.js";

const TEAM_ROLES: { id: string; name: string; icon: string }[] = [
  { id: "coding", name: "Coding", icon: "💻" },
  { id: "testing", name: "Testing", icon: "🧪" },
  { id: "security", name: "Security", icon: "🛡️" },
  { id: "research", name: "Research", icon: "🔍" },
  { id: "documentation", name: "Docs", icon: "📝" },
];

const TASK_STATUS_STYLES: Record<string, string> = {
  QUEUED: "bg-border text-text-muted border-border",
  RUNNING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  VERIFYING: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  WAITING_APPROVAL: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  VERIFIED: "bg-green-500/10 text-green-400 border-green-500/20",
  FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
  CANCELLED: "bg-border text-text-muted border-border",
};

const JOB_STATUS_STYLES: Record<TeamJobStatus, string> = {
  queued: "bg-border text-text-muted border-border",
  running: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  done: "bg-green-500/10 text-green-400 border-green-500/20",
  error: "bg-red-500/10 text-red-400 border-red-500/20",
};

function roleName(id: string): string {
  return TEAM_ROLES.find((r) => r.id === id)?.name || id;
}

function jobSummary(timeline: { t: string; content?: string }[]): string {
  const text = timeline
    .filter((e) => e.t === "text")
    .map((e) => e.content || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > 160) return text.slice(0, 160) + "…";
  const toolCalls = timeline.filter((e) => e.t === "tool_call").length;
  if (!text && toolCalls > 0) return `${toolCalls} alata pozvano`;
  return text;
}

export interface TeamRunPanelProps {
  open: boolean;
  onClose: () => void;
  machineId: string | null;
  defaultPrompt?: string;
}

export default function TeamRunPanel({
  open,
  onClose,
  machineId,
  defaultPrompt,
}: TeamRunPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(
    () => new Set(["coding", "testing", "security"])
  );
  const [result, setResult] = useState<TeamRunResult | null>(null);
  const [detail, setDetail] = useState<TeamTaskDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (open && defaultPrompt && !prompt) setPrompt(defaultPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultPrompt]);

  // Poll the team task while it is running.
  useEffect(() => {
    if (!open || !result) return;
    const poll = async () => {
      try {
        const d = await fetchTeamTask(result.taskId);
        setDetail(d);
        const terminal = ["VERIFIED", "FAILED", "CANCELLED"].includes(d.task.status);
        if (terminal) {
          setBusy(false);
          if (timerRef.current) window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } catch {}
    };
    poll();
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(poll, 1500);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [open, result]);

  if (!open) return null;

  const taskStatus = detail?.task.status ?? result?.status ?? "RUNNING";
  const isWaitingApproval = taskStatus === "WAITING_APPROVAL";
  const isTerminal = ["VERIFIED", "FAILED", "CANCELLED"].includes(taskStatus);

  const toggleRole = (id: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const run = async () => {
    if (!prompt.trim() || selectedRoles.size === 0) return;
    setBusy(true);
    setError(null);
    setDetail(null);
    try {
      const res = await startTeamRun({
        prompt: prompt.trim(),
        machineId: machineId || undefined,
        roles: Array.from(selectedRoles),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pokretanje tima nije uspjelo");
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!result) return;
    try {
      await approveTeamTask(result.taskId);
      setDetail((prev) =>
        prev ? { ...prev, task: { ...prev.task, status: "VERIFIED" } } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Odobravanje nije uspjelo");
    }
  };

  const jobs = detail?.jobs ?? result?.jobs ?? [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-[560px] mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-[13px] font-semibold text-text">
            👥 Tim agenta
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            title="Zatvori"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {!result ? (
            <>
              <div>
                <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                  Zadatak za tim
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Npr. Dodaj dark mode toggle i pokrij testovima…"
                  rows={4}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12px] text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                  Uloge
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {TEAM_ROLES.map((r) => {
                    const active = selectedRoles.has(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRole(r.id)}
                        className={`px-2.5 h-7 rounded-lg border text-[11px] font-medium transition-colors ${
                          active
                            ? "border-accent/50 bg-accent/10 text-accent"
                            : "border-border bg-transparent text-text-muted hover:text-text hover:border-border-light"
                        }`}
                      >
                        {r.icon} {r.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-[11px]">
                  {error}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span
                  className={`px-2 py-1 rounded-md border text-[10px] font-semibold ${
                    TASK_STATUS_STYLES[taskStatus] || TASK_STATUS_STYLES.QUEUED
                  }`}
                >
                  {taskStatus}
                </span>
                {!isTerminal && (
                  <span className="text-[10px] text-text-muted animate-pulse">
                    {busy ? "Pokreće se…" : "Radi…"}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {jobs.map((job) => {
                  const roleId = "role" in job ? job.role : "";
                  const status = job.status as TeamJobStatus;
                  const timeline =
                    "timeline" in job && Array.isArray(job.timeline) ? job.timeline : [];
                  const jobError = "error" in job ? job.error : undefined;
                  return (
                    <div
                      key={"jobId" in job ? job.jobId : roleId}
                      className="rounded-lg border border-border bg-surface-2 p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-text">
                          {roleName(roleId)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[9px] font-semibold ${
                            JOB_STATUS_STYLES[status] || JOB_STATUS_STYLES.queued
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                      {jobError && (
                        <div className="mt-1.5 text-[10px] text-red-400">{jobError}</div>
                      )}
                      {!jobError && timeline.length > 0 && (
                        <div className="mt-1.5 text-[10px] text-text-muted leading-relaxed">
                          {jobSummary(timeline)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {error && (
                <div className="px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-[11px]">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border shrink-0">
          {isWaitingApproval && (
            <button
              onClick={approve}
              className="px-3 h-8 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 text-[11px] font-medium transition-colors"
            >
              ✓ Odobri rad tima
            </button>
          )}
          {!result && (
            <button
              onClick={run}
              disabled={!prompt.trim() || selectedRoles.size === 0 || busy}
              className="px-3 h-8 rounded-lg bg-accent text-white text-[11px] font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Pokreni tim
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 h-8 rounded-lg border border-border text-text-muted hover:text-text hover:border-border-light text-[11px] font-medium transition-colors"
          >
            Zatvori
          </button>
        </div>
      </div>
    </div>
  );
}
