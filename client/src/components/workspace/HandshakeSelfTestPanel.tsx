import type { AgentBusEnvelope } from "../../lib/agent-bus.js";
import type { RepoConnection } from "../../lib/repos.js";

export interface HandshakeSelfTestResult {
  checkedAt: string;
  ok: boolean;
  repoCheck: { ok: boolean; askRepo: string | null; agentRepo: string | null; distinct: boolean };
  runtimeCheck: { ok: boolean; askMachineId: string | null; agentMachineId: string | null; distinct: boolean };
  busCheck: { ok: boolean; eventId: string | null; chainId: string | null; status: string | null; createdAt: string | null };
  autoReviewCheck: { ok: boolean; status: string | null };
  auditSyncCheck: { ok: boolean; uiCount: number; auditCount: number };
  notes: string[];
}

interface Props {
  open: boolean;
  loading: boolean;
  result: HandshakeSelfTestResult | null;
  askRepo: RepoConnection | null;
  agentRepo: RepoConnection | null;
  askMachineId: string | null;
  agentMachineId: string | null;
  onRun: () => void;
  onClose: () => void;
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ok ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
      {ok ? "✓" : "✕"} {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2 border-b border-border/40 last:border-b-0">
      <span className="text-[11px] text-text-muted">{label}</span>
      <span className="text-[11px] text-text text-right break-all">{value}</span>
    </div>
  );
}

export default function HandshakeSelfTestPanel({
  open,
  loading,
  result,
  askRepo,
  agentRepo,
  askMachineId,
  agentMachineId,
  onRun,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-4xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div>
            <div className="text-sm font-semibold text-text">Handshake self-test</div>
            <div className="text-[11px] text-text-muted mt-0.5">Automatska provjera dva panela, repo slotova, runtime-a, bus eventa i audit/UI sinhronizacije</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRun}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-accent/30 bg-accent/10 text-accent text-[11px] font-medium hover:bg-accent/15 disabled:opacity-50 transition-colors"
            >
              {loading ? "Pokrećem…" : "Pokreni test"}
            </button>
            <button onClick={onClose} className="text-text-muted hover:text-text text-sm transition-colors">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-surface-2/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface/60 flex items-center justify-between">
                <div className="text-[12px] font-semibold text-text">Trenutni slotovi</div>
                <div className="flex items-center gap-2">
                  <StatusPill ok={!!askRepo} label="Ask repo" />
                  <StatusPill ok={!!agentRepo} label="Agent repo" />
                </div>
              </div>
              <InfoRow label="Ask repo" value={askRepo?.fullName || "Nije povezan"} />
              <InfoRow label="Agent repo" value={agentRepo?.fullName || "Nije povezan"} />
              <InfoRow label="Ask runtime" value={askMachineId || "N/A"} />
              <InfoRow label="Agent runtime" value={agentMachineId || "N/A"} />
            </div>

            <div className="rounded-2xl border border-border bg-surface-2/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface/60 flex items-center justify-between">
                <div className="text-[12px] font-semibold text-text">Zadnji rezultat</div>
                {result ? <StatusPill ok={result.ok} label={result.ok ? "PASS" : "FAIL"} /> : <span className="text-[10px] text-text-muted">Nije pokrenuto</span>}
              </div>
              <InfoRow label="Checked at" value={result ? new Date(result.checkedAt).toLocaleString() : "N/A"} />
              <InfoRow label="Bus event" value={result?.busCheck.eventId || "N/A"} />
              <InfoRow label="Chain" value={result?.busCheck.chainId || "N/A"} />
              <InfoRow label="Status" value={result?.busCheck.status || "N/A"} />
            </div>
          </div>

          {result && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border bg-surface px-3 py-2">
                  <div className="flex items-center justify-between"><span className="text-[10px] text-text-muted">Repo check</span><StatusPill ok={result.repoCheck.ok} label={result.repoCheck.ok ? "OK" : "FAIL"} /></div>
                  <div className="mt-2 text-[11px] text-text-muted">Distinct: {result.repoCheck.distinct ? "Yes" : "No"}</div>
                </div>
                <div className="rounded-xl border border-border bg-surface px-3 py-2">
                  <div className="flex items-center justify-between"><span className="text-[10px] text-text-muted">Runtime check</span><StatusPill ok={result.runtimeCheck.ok} label={result.runtimeCheck.ok ? "OK" : "FAIL"} /></div>
                  <div className="mt-2 text-[11px] text-text-muted">Distinct: {result.runtimeCheck.distinct ? "Yes" : "No"}</div>
                </div>
                <div className="rounded-xl border border-border bg-surface px-3 py-2">
                  <div className="flex items-center justify-between"><span className="text-[10px] text-text-muted">Auto-review</span><StatusPill ok={result.autoReviewCheck.ok} label={result.autoReviewCheck.ok ? "OK" : "FAIL"} /></div>
                  <div className="mt-2 text-[11px] text-text-muted">Status: {result.autoReviewCheck.status || "N/A"}</div>
                </div>
                <div className="rounded-xl border border-border bg-surface px-3 py-2">
                  <div className="flex items-center justify-between"><span className="text-[10px] text-text-muted">Audit/UI sync</span><StatusPill ok={result.auditSyncCheck.ok} label={result.auditSyncCheck.ok ? "OK" : "FAIL"} /></div>
                  <div className="mt-2 text-[11px] text-text-muted">UI {result.auditSyncCheck.uiCount} / Audit {result.auditSyncCheck.auditCount}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface-2/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-surface/60 text-[12px] font-semibold text-text">Notes</div>
                <div className="p-4 space-y-2">
                  {result.notes.length === 0 ? (
                    <div className="text-[11px] text-text-muted">Nema dodatnih napomena.</div>
                  ) : (
                    result.notes.map((note, index) => (
                      <div key={`${index}-${note}`} className="text-[11px] text-text bg-surface border border-border rounded-lg px-3 py-2">
                        {note}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
