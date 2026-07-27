import { useState } from "react";
import {
  runVerification,
  type CheckResult,
  type VerificationResult,
  CHECK_LABELS,
  CHECK_ICONS,
} from "../../lib/verify.js";

interface Props {
  machineId: string;
  sessionId: string;
  stepId: string;
  stepContent: string;
  existingResult?: VerificationResult;
  onVerified: (result: VerificationResult) => void;
}

export default function VerificationBadge({
  machineId,
  sessionId,
  stepId,
  existingResult,
  onVerified,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(
    existingResult || null
  );
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    setLoading(true);
    setError(null);
    try {
      const res = await runVerification(machineId, sessionId, stepId);
      setResult(res);
      onVerified(res);
    } catch (err: any) {
      setError(err.message || "Verifikacija neuspješna");
    } finally {
      setLoading(false);
    }
  }

  // No result yet — show verify button
  if (!result && !loading) {
    return (
      <div className="mt-1.5 flex items-center gap-2">
        <button
          onClick={handleVerify}
          className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md border border-accent/30 bg-accent/5 text-accent hover:bg-accent/10 transition-colors font-medium"
        >
          <span className="text-[11px]">✓</span>
          Automatski verifikuj
        </button>
        <span className="text-[9px] text-text-muted">
          provjeri build, testove, datoteke
        </span>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="mt-1.5 flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md border border-accent/20 bg-accent/5 text-accent">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Verifikacija u tijeku...
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[10px] px-2 py-1 rounded-md border border-red-500/30 bg-red-500/5 text-red-400">
          ✕ {error}
        </span>
        <button
          onClick={handleVerify}
          className="text-[9px] text-text-muted hover:text-text underline"
        >
          Pokušaj ponovo
        </button>
      </div>
    );
  }

  // Result
  const passed = result!.overallPassed;
  const passedCount = result!.checks.filter((c) => c.passed).length;
  const totalCount = result!.checks.length;

  return (
    <div className="mt-1.5">
      {/* Status bar */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md border transition-colors ${
          passed
            ? "border-green-500/30 bg-green-500/5 text-green-400"
            : "border-yellow-500/30 bg-yellow-500/5 text-yellow-400"
        }`}
      >
        <span className="text-[11px]">
          {passed ? "✅" : "⚠️"}
        </span>
        <span className="font-medium">
          {passed ? "Verifikovano" : "Potrebna revizija"}
        </span>
        <span className="text-[9px] opacity-70">
          ({passedCount}/{totalCount} checkova)
        </span>
        <span className="text-[10px] ml-0.5">
          {showDetails ? "▾" : "▸"}
        </span>
      </button>

      {/* Detail panel */}
      {showDetails && (
        <div className="mt-1.5 ml-1 border-l-2 border-border pl-2 space-y-1">
          {result!.checks.map((check) => (
            <CheckRow key={check.name} check={check} />
          ))}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleVerify}
              className="text-[9px] text-text-muted hover:text-text"
            >
              ↻ Ponovi verifikaciju
            </button>
            <span className="text-[8px] text-text-muted">
              {new Date(result!.timestamp).toLocaleTimeString("hr-HR")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckRow({ check }: { check: CheckResult }) {
  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <div>
      <button
        onClick={() => setShowEvidence(!showEvidence)}
        className="flex items-center gap-1.5 text-[10px] w-full text-left hover:bg-surface-2/50 rounded px-1 py-0.5 transition-colors"
      >
        <span>{check.passed ? "✅" : "❌"}</span>
        <span className="text-text-secondary">{CHECK_ICONS[check.name]}</span>
        <span className="font-medium text-text-secondary">
          {CHECK_LABELS[check.name]}
        </span>
        {check.duration !== undefined && (
          <span className="text-[8px] text-text-muted ml-auto">
            {check.duration}ms
          </span>
        )}
        <span className="text-[9px] text-text-muted ml-1">
          {showEvidence ? "▾" : "▸"}
        </span>
      </button>
      {showEvidence && (
        <div className="ml-5 text-[9px] text-text-muted bg-surface-2/30 rounded px-2 py-1 whitespace-pre-wrap font-mono leading-relaxed max-h-[120px] overflow-y-auto">
          {check.evidence}
        </div>
      )}
    </div>
  );
}
