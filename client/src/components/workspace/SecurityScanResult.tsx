import { useState } from "react";
import type { ScanVerdict, Vulnerability, Severity } from "../../lib/security.js";
import { SEVERITY_COLORS, SEVERITY_BG, VERDICT_LABELS } from "../../lib/security.js";

interface Props {
  verdict: ScanVerdict;
  packageName?: string;
  onClose?: () => void;
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export default function SecurityScanResult({ verdict, packageName, onClose }: Props) {
  const [expandedVuln, setExpandedVuln] = useState<string | null>(null);
  const verdictInfo = VERDICT_LABELS[verdict.verdict];

  const sorted = [...verdict.vulnerabilities].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Verdict banner */}
      <div className={`flex items-center justify-between px-3 py-2.5 border-b border-border ${
        verdict.verdict === "block"
          ? "bg-red-500/5"
          : verdict.verdict === "warn"
            ? "bg-yellow-500/5"
            : "bg-green-500/5"
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm ${verdictInfo.color}`}>{verdictInfo.icon}</span>
          <span className={`text-[12px] font-semibold ${verdictInfo.color}`}>
            {verdictInfo.label}
          </span>
          {packageName && (
            <span className="text-[10px] text-text-muted">
              — {packageName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-text-muted">
          {verdict.summary.critical > 0 && (
            <span className="text-red-400 font-medium">{verdict.summary.critical} kritičnih</span>
          )}
          {verdict.summary.high > 0 && (
            <span className="text-orange-400 font-medium">{verdict.summary.high} visokih</span>
          )}
          {verdict.summary.medium > 0 && (
            <span className="text-yellow-400">{verdict.summary.medium} srednjih</span>
          )}
          {verdict.summary.low > 0 && (
            <span className="text-blue-400">{verdict.summary.low} niskih</span>
          )}
        </div>
      </div>

      {/* Scanners used */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border text-[9px] text-text-muted">
        <span>Skeniralo:</span>
        {verdict.scannersUsed.map((s) => (
          <span key={s.name} className={`px-1.5 py-0.5 rounded ${
            s.success ? "bg-surface-2" : "bg-red-500/10 text-red-400"
          }`}>
            {s.name} {s.success ? `(${s.found})` : "✕"}
          </span>
        ))}
      </div>

      {/* Vulnerability list */}
      {sorted.length > 0 ? (
        <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
          {sorted.map((v) => (
            <VulnRow
              key={v.id}
              vuln={v}
              expanded={expandedVuln === v.id}
              onToggle={() => setExpandedVuln(expandedVuln === v.id ? null : v.id)}
            />
          ))}
        </div>
      ) : (
        <div className="px-3 py-4 text-center text-[11px] text-green-400">
          ✓ Nije pronađena nijedna poznata ranjivost
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border text-[9px] text-text-muted">
        <span>{verdict.summary.total} ranjivosti ukupno</span>
        <span>{new Date(verdict.scannedAt).toLocaleTimeString("hr-HR")}</span>
      </div>

      {onClose && (
        <div className="px-3 py-2 border-t border-border">
          <button
            onClick={onClose}
            className="w-full text-[11px] text-text-muted hover:text-text py-1 rounded hover:bg-surface-2 transition-colors"
          >
            Zatvori
          </button>
        </div>
      )}
    </div>
  );
}

function VulnRow({
  vuln,
  expanded,
  onToggle,
}: {
  vuln: Vulnerability;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="px-3 py-2 hover:bg-surface-2/30 transition-colors cursor-pointer" onClick={onToggle}>
      <div className="flex items-start gap-2">
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${SEVERITY_BG[vuln.severity]} ${SEVERITY_COLORS[vuln.severity]}`}>
          {vuln.severity.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-text truncate">
              {vuln.packageName}
            </span>
            <span className="text-[9px] text-text-muted">{vuln.installedVersion}</span>
          </div>
          <div className="text-[10px] text-text-secondary mt-0.5 leading-relaxed">
            {vuln.summary}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {vuln.patchedVersions && (
            <span className="text-[9px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
              fix: {vuln.patchedVersions}
            </span>
          )}
          {vuln.url && (
            <a
              href={vuln.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-accent hover:text-accent-light px-1"
              onClick={(e) => e.stopPropagation()}
            >
              ↗
            </a>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-2 pl-6 space-y-1 text-[10px] text-text-muted">
          {vuln.cve && (
            <div>CVE: <span className="text-text-secondary">{vuln.cve}</span></div>
          )}
          <div>Scanner: <span className="text-text-secondary">{vuln.source}</span></div>
          {vuln.patchedVersions && (
            <div>Popravka: <span className="text-green-400">{vuln.patchedVersions}</span></div>
          )}
        </div>
      )}
    </div>
  );
}
