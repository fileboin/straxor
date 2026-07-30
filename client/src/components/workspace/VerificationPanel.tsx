import { useState, useEffect, type FormEvent } from "react";
import {
  freezeSpec,
  submitEvidence,
  verifyTask,
  getTaskStatus,
  applyFix,
  cancelVerification,
  type TaskProof,
  STATUS_LABELS,
  STATUS_COLORS,
} from "../../lib/verification.js";

interface Props {
  sessionId: string | null;
  onClose: () => void;
}

export default function VerificationPanel({ sessionId, onClose }: Props) {
  const [proof, setProof] = useState<TaskProof | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Spec form state
  const [specTitle, setSpecTitle] = useState("");
  const [specTaskStatement, setSpecTaskStatement] = useState("");
  const [criteriaText, setCriteriaText] = useState("");
  const [constraintsText, setConstraintsText] = useState("");
  const [nonGoalsText, setNonGoalsText] = useState("");

  // Evidence form state
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");

  // Verify form state
  const [showVerifyForm, setShowVerifyForm] = useState(false);
  const [verifierSessionId, setVerifierSessionId] = useState("");

  // Fix form state
  const [showFixForm, setShowFixForm] = useState(false);
  const [fixNotes, setFixNotes] = useState("");

  useEffect(() => {
    if (sessionId) {
      loadStatus();
    }
  }, [sessionId]);

  const loadStatus = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError("");
    try {
      const p = await getTaskStatus(sessionId);
      setProof(p);
    } catch {
      setProof(null);
    } finally {
      setLoading(false);
    }
  };

  const parseCriteriaLines = (text: string): { id: string; description: string; verifyMethod: string }[] => {
    const lines = text.split("\n").filter((l) => l.trim());
    const criteria: { id: string; description: string; verifyMethod: string }[] = [];
    let currentId = "";

    for (const line of lines) {
      const acMatch = line.match(/^AC(\d+)[:\s]\s*(.+)/i);
      if (acMatch) {
        currentId = `AC${acMatch[1]}`;
        criteria.push({
          id: currentId,
          description: acMatch[2].trim(),
          verifyMethod: "Manual verification required",
        });
      } else if (line.toLowerCase().startsWith("verify:") && currentId) {
        const last = criteria[criteria.length - 1];
        if (last) {
          last.verifyMethod = line.replace(/^verify:\s*/i, "").trim();
        }
      }
    }

    return criteria;
  };

  const handleFreezeSpec = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    setLoading(true);
    setError("");
    try {
      const criteria = parseCriteriaLines(criteriaText);
      if (criteria.length === 0) {
        setError("Parse at least one AC (e.g. 'AC1: Description')");
        setLoading(false);
        return;
      }

      const constraints = constraintsText
        .split("\n")
        .map((l) => l.replace(/^- /, "").trim())
        .filter(Boolean);
      const nonGoals = nonGoalsText
        .split("\n")
        .map((l) => l.replace(/^- /, "").trim())
        .filter(Boolean);

      const result = await freezeSpec(sessionId, {
        title: specTitle || undefined,
        taskStatement: specTaskStatement || undefined,
        criteria,
        constraints: constraints.length > 0 ? constraints : undefined,
        nonGoals: nonGoals.length > 0 ? nonGoals : undefined,
      });
      setProof(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEvidence = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    setLoading(true);
    setError("");
    try {
      const result = await submitEvidence(sessionId, {
        summary: evidenceSummary,
        checks: [],
        notes: evidenceNotes,
      });
      setProof(result);
      setShowEvidenceForm(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    setLoading(true);
    setError("");
    try {
      await verifyTask(sessionId, verifierSessionId);
      setShowVerifyForm(false);
      await loadStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFix = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    setLoading(true);
    setError("");
    try {
      const result = await applyFix(sessionId, fixNotes);
      setProof(result);
      setShowFixForm(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      await cancelVerification(sessionId);
      await loadStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
          <p className="text-text-muted text-sm">Connect a VPS and start an agent session first.</p>
          <button onClick={onClose} className="mt-4 px-3 py-1.5 rounded-lg bg-surface-3 text-text-secondary text-xs">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold">Proof Loop Verification</h2>
            {proof && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md bg-surface-3 ${STATUS_COLORS[proof.status]}`}>
                {STATUS_LABELS[proof.status]}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text text-sm transition-colors">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">{error}</div>
          )}

          {loading && !proof && (
            <p className="text-text-muted text-sm">Loading...</p>
          )}

          {/* No proof yet — show frozen spec form */}
          {!proof && !loading && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-accent/5 border border-accent/20 text-sm text-text-secondary">
                <p className="font-semibold text-text mb-1">Phase 0: Freeze Spec</p>
                <p>Define acceptance criteria before any code is written. ACs cannot change after freezing.</p>
              </div>
              <SpecForm
                title={specTitle} onTitleChange={setSpecTitle}
                taskStatement={specTaskStatement} onTaskStatementChange={setSpecTaskStatement}
                criteriaText={criteriaText} onCriteriaTextChange={setCriteriaText}
                constraintsText={constraintsText} onConstraintsTextChange={setConstraintsText}
                nonGoalsText={nonGoalsText} onNonGoalsTextChange={setNonGoalsText}
                onSubmit={handleFreezeSpec}
                loading={loading}
              />
            </div>
          )}

          {/* Proof exists — show status and actions */}
          {proof && (
            <>
              {/* Spec display */}
              {proof.spec && (
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Spec</p>
                  <div className="space-y-2">
                    {proof.spec.criteria.map((c) => (
                      <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface-2 border border-border">
                        <CriterionBadge status={c.status} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text">{c.id}: {c.description}</p>
                          <p className="text-[11px] text-text-muted mt-0.5">Verify: {c.verifyMethod}</p>
                          {c.note && c.note !== "Not verified yet." && (
                            <p className="text-[11px] text-text-secondary mt-1 italic">{c.note}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence display */}
              {proof.evidence && (
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Evidence</p>
                  <div className="p-3 rounded-lg bg-surface-2 border border-border text-sm">
                    <p className="text-text">{proof.evidence.summary}</p>
                    {proof.evidence.notes && (
                      <p className="text-xs text-text-muted mt-1">{proof.evidence.notes}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Verdict display */}
              {proof.verdict && (
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                    Verdict
                    <span className={`ml-2 font-bold ${proof.status === "passed" ? "text-green-500" : proof.status === "failed" ? "text-red-500" : "text-yellow-500"}`}>
                      {proof.verdict.overall}
                    </span>
                  </p>
                  {proof.verdict.criteria.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <CriterionBadge status={c.status} />
                      <span className="text-text-secondary">{c.id}</span>
                      <span className="text-text-muted text-xs truncate">{c.note}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Problems display */}
              {proof.problems && proof.status !== "passed" && (
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Problems</p>
                  <pre className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-text-secondary whitespace-pre-wrap font-sans">
                    {proof.problems}
                  </pre>
                </div>
              )}

              {/* Phase-based action buttons */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                {proof.status === "spec_frozen" && (
                  <button
                    onClick={() => setShowEvidenceForm(true)}
                    className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    Submit Evidence
                  </button>
                )}
                {proof.status === "evidence_collected" && (
                  <button
                    onClick={() => setShowVerifyForm(true)}
                    className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    Launch Fresh Verifier
                  </button>
                )}
                {proof.status === "failed" && (
                  <button
                    onClick={() => setShowFixForm(true)}
                    className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    Apply Fix
                  </button>
                )}
                {(proof.status === "verifying" || proof.status === "fixing") && (
                  <button
                    onClick={loadStatus}
                    className="px-3 py-1.5 rounded-lg bg-surface-3 text-text-secondary text-xs hover:text-text transition-colors"
                  >
                    Refresh Status
                  </button>
                )}
                {proof.status === "passed" && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm font-semibold w-full text-center">
                    All acceptance criteria PASSED. Task is verified complete.
                  </div>
                )}
                {proof.status !== "passed" && proof.status !== "spec_frozen" && (
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-500 text-xs hover:bg-red-500/10 transition-colors"
                  >
                    Cancel Verification
                  </button>
                )}
              </div>
            </>
          )}

          {/* Evidence form modal */}
          {showEvidenceForm && (
            <form onSubmit={handleSubmitEvidence} className="p-4 rounded-lg bg-surface-2 border border-border space-y-3">
              <p className="text-xs font-semibold">Submit Evidence</p>
              <textarea
                value={evidenceSummary}
                onChange={(e) => setEvidenceSummary(e.target.value)}
                placeholder="What was done and how was it verified?"
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-text text-sm placeholder-text-muted outline-none focus:border-accent transition-colors min-h-[80px]"
                required
              />
              <textarea
                value={evidenceNotes}
                onChange={(e) => setEvidenceNotes(e.target.value)}
                placeholder="Additional notes for the verifier..."
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-text text-sm placeholder-text-muted outline-none focus:border-accent transition-colors min-h-[60px]"
              />
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {loading ? "Submitting..." : "Submit"}
                </button>
                <button type="button" onClick={() => setShowEvidenceForm(false)} className="px-3 py-1.5 rounded-lg bg-surface-3 text-text-secondary text-xs hover:text-text transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Verify form modal */}
          {showVerifyForm && (
            <form onSubmit={handleVerify} className="p-4 rounded-lg bg-surface-2 border border-border space-y-3">
              <p className="text-xs font-semibold">Launch Fresh Verifier Session</p>
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 text-xs">
                CRITICAL: The verifier MUST be a different session from the builder. Enter a session ID from a fresh, independent agent instance.
              </div>
              <input
                type="text"
                value={verifierSessionId}
                onChange={(e) => setVerifierSessionId(e.target.value)}
                placeholder="Enter verifier session ID (must differ from builder)"
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-text text-sm placeholder-text-muted outline-none focus:border-accent transition-colors"
                required
              />
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {loading ? "Launching..." : "Launch Verifier"}
                </button>
                <button type="button" onClick={() => setShowVerifyForm(false)} className="px-3 py-1.5 rounded-lg bg-surface-3 text-text-secondary text-xs hover:text-text transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Fix form modal */}
          {showFixForm && (
            <form onSubmit={handleApplyFix} className="p-4 rounded-lg bg-surface-2 border border-border space-y-3">
              <p className="text-xs font-semibold">Apply Fix</p>
              <textarea
                value={fixNotes}
                onChange={(e) => setFixNotes(e.target.value)}
                placeholder="Describe what needs to be fixed and how..."
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-text text-sm placeholder-text-muted outline-none focus:border-accent transition-colors min-h-[80px]"
                required
              />
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {loading ? "Applying..." : "Apply Fix"}
                </button>
                <button type="button" onClick={() => setShowFixForm(false)} className="px-3 py-1.5 rounded-lg bg-surface-3 text-text-secondary text-xs hover:text-text transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function CriterionBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PASS: "bg-green-500/20 text-green-500 border-green-500/30",
    FAIL: "bg-red-500/20 text-red-500 border-red-500/30",
    UNKNOWN: "bg-gray-500/20 text-gray-500 border-gray-500/30",
  };
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${colors[status] || colors.UNKNOWN}`}>
      {status}
    </span>
  );
}

function SpecForm({
  title, onTitleChange,
  taskStatement, onTaskStatementChange,
  criteriaText, onCriteriaTextChange,
  constraintsText, onConstraintsTextChange,
  nonGoalsText, onNonGoalsTextChange,
  onSubmit, loading,
}: {
  title: string; onTitleChange: (v: string) => void;
  taskStatement: string; onTaskStatementChange: (v: string) => void;
  criteriaText: string; onCriteriaTextChange: (v: string) => void;
  constraintsText: string; onConstraintsTextChange: (v: string) => void;
  nonGoalsText: string; onNonGoalsTextChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  loading: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Task title"
        className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-text text-sm placeholder-text-muted outline-none focus:border-accent transition-colors"
      />
      <textarea
        value={taskStatement}
        onChange={(e) => onTaskStatementChange(e.target.value)}
        placeholder="Task statement (what needs to be done)"
        className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-text text-sm placeholder-text-muted outline-none focus:border-accent transition-colors min-h-[60px]"
      />
      <div>
        <label className="text-[11px] text-text-muted block mb-1">
          Acceptance Criteria (one per line, format: <code className="text-accent">AC1: description</code>, next line <code className="text-accent">Verify: method</code>)
        </label>
        <textarea
          value={criteriaText}
          onChange={(e) => onCriteriaTextChange(e.target.value)}
          placeholder={`AC1: User with locale=de sees German navigation labels\nVerify: Browser check against German-locale test user\nAC2: Language preference survives page reload\nVerify: Reload and confirm saved locale`}
          className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-text text-sm placeholder-text-muted outline-none focus:border-accent transition-colors min-h-[120px] font-mono text-xs"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-text-muted block mb-1">Constraints (one per line)</label>
          <textarea
            value={constraintsText}
            onChange={(e) => onConstraintsTextChange(e.target.value)}
            placeholder="- Must not break existing tests"
            className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-text text-sm placeholder-text-muted outline-none focus:border-accent transition-colors min-h-[60px] text-xs"
          />
        </div>
        <div>
          <label className="text-[11px] text-text-muted block mb-1">Non-Goals (one per line)</label>
          <textarea
            value={nonGoalsText}
            onChange={(e) => onNonGoalsTextChange(e.target.value)}
            placeholder="- Out of scope items"
            className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-text text-sm placeholder-text-muted outline-none focus:border-accent transition-colors min-h-[60px] text-xs"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? "Freezing..." : "Freeze Spec & Start Proof Loop"}
      </button>
    </form>
  );
}
