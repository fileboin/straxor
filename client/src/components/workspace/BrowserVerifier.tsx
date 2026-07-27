import { useState } from "react";
import {
  runBrowserVerification,
  takeScreenshot,
  type BrowserVerificationResult,
  type BrowserCheckResult,
  type FormInteraction,
  BROWSER_CHECK_LABELS,
  BROWSER_CHECK_ICONS,
} from "../../lib/browser-verify.js";

interface Props {
  machineId: string;
  defaultUrl?: string;
  onClose?: () => void;
  onResult?: (result: BrowserVerificationResult) => void;
}

export default function BrowserVerifier({
  machineId,
  defaultUrl = "",
  onClose,
  onResult,
}: Props) {
  const [url, setUrl] = useState(defaultUrl);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BrowserVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeScreenshot, setActiveScreenshot] = useState<number>(0);

  // Form interactions config
  const [showFormConfig, setShowFormConfig] = useState(false);
  const [forms, setForms] = useState<FormInteraction[]>([]);
  const [formSelector, setFormSelector] = useState("");
  const [formValue, setFormValue] = useState("");

  function addForm() {
    if (!formSelector.trim()) return;
    setForms((prev) => [
      ...prev,
      { selector: formSelector.trim(), value: formValue.trim() },
    ]);
    setFormSelector("");
    setFormValue("");
  }

  async function handleVerify() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await runBrowserVerification(
        machineId,
        url.trim(),
        undefined,
        undefined,
        undefined,
        forms.length > 0 ? forms : undefined
      );
      setResult(res);
      onResult?.(res);
    } catch (err: any) {
      setError(err.message || "Browser verifikacija neuspješna");
    } finally {
      setLoading(false);
    }
  }

  async function handleScreenshot() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const entry = await takeScreenshot(machineId, url.trim());
      setResult((prev) => {
        if (!prev) {
          const newResult: BrowserVerificationResult = {
            id: `browser-${Date.now()}`,
            url: url.trim(),
            checks: [],
            screenshots: [entry],
            overallPassed: true,
            timestamp: new Date().toISOString(),
          };
          onResult?.(newResult);
          return newResult;
        }
        const updated = {
          ...prev,
          screenshots: [...prev.screenshots, entry],
        };
        onResult?.(updated);
        return updated;
      });
    } catch (err: any) {
      setError(err.message || "Screenshot neuspješan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-[800px] mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text">
              🌐 Browser Verifikacija
            </span>
            {result && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  result.overallPassed
                    ? "border-green-500/30 bg-green-500/10 text-green-400"
                    : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                }`}
              >
                {result.overallPassed ? "PROŠLO" : "PROBLEMI"}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* URL input */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-text-muted">
                🔗
              </span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-surface-2 border border-border rounded-lg pl-7 pr-2.5 py-1.5 text-[11px] text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              />
            </div>
            <button
              onClick={handleVerify}
              disabled={loading || !url.trim()}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-light text-white transition-colors disabled:opacity-40 font-medium shrink-0"
            >
              {loading ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Testiram...
                </>
              ) : (
                <>▶ Pokreni</>
              )}
            </button>
            <button
              onClick={handleScreenshot}
              disabled={loading || !url.trim()}
              className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-transparent text-text-secondary hover:text-text hover:border-border-light transition-colors disabled:opacity-40 shrink-0"
              title="Screenshot"
            >
              📸
            </button>
          </div>

          {/* Form config toggle */}
          <button
            onClick={() => setShowFormConfig(!showFormConfig)}
            className="mt-1.5 text-[9px] text-text-muted hover:text-text-secondary transition-colors"
          >
            {showFormConfig ? "▾" : "▸"} Testiraj forme
          </button>

          {showFormConfig && (
            <div className="mt-2 space-y-1.5">
              {forms.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-text-muted font-mono">{f.selector}</span>
                  <span className="text-text-muted">=</span>
                  <span className="text-text-secondary">{f.value}</span>
                  <button
                    onClick={() => setForms((prev) => prev.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-300 ml-auto"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={formSelector}
                  onChange={(e) => setFormSelector(e.target.value)}
                  placeholder="input[name=email]"
                  className="flex-1 bg-surface-2 border border-border rounded px-2 py-1 text-[10px] text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
                <input
                  type="text"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder="test@example.com"
                  className="flex-1 bg-surface-2 border border-border rounded px-2 py-1 text-[10px] text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
                <button
                  onClick={addForm}
                  disabled={!formSelector.trim()}
                  className="text-[10px] text-accent hover:text-accent-light disabled:opacity-40"
                >
                  + Dodaj
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Error */}
          {error && (
            <div className="mb-3 text-[11px] px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/5 text-red-400">
              {error}
            </div>
          )}

          {/* No result yet */}
          {!result && !loading && !error && (
            <div className="text-center py-12">
              <div className="text-text-muted text-[11px] mb-2">
                Unesi URL i pokreni verifikaciju
              </div>
              <div className="text-[9px] text-text-muted space-y-1">
                <div>Provjerava: učitavanje, JS greške, 5xx, forme</div>
                <div>Zahtijeva Playwright na VPS-u</div>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && !result && (
            <div className="text-center py-12">
              <div className="flex items-center justify-center gap-2 text-accent text-[11px]">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                Browser test u tijeku...
              </div>
              <div className="text-[9px] text-text-muted mt-2">
                Playwright pokreće headless Chrome
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Check results */}
              {result.checks.length > 0 && (
                <div>
                  <div className="text-[9px] text-text-muted uppercase tracking-wider font-medium mb-2">
                    Rezultati ({result.checks.filter((c) => c.passed).length}/
                    {result.checks.length} prošlo)
                  </div>
                  <div className="space-y-1">
                    {result.checks.map((check) => (
                      <BrowserCheckRow key={check.name} check={check} />
                    ))}
                  </div>
                </div>
              )}

              {/* Screenshots */}
              {result.screenshots.length > 0 && (
                <div>
                  <div className="text-[9px] text-text-muted uppercase tracking-wider font-medium mb-2">
                    Screenshotovi ({result.screenshots.length})
                  </div>
                  {/* Screenshot tabs */}
                  {result.screenshots.length > 1 && (
                    <div className="flex items-center gap-1 mb-2">
                      {result.screenshots.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveScreenshot(i)}
                          className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${
                            activeScreenshot === i
                              ? "bg-accent/10 text-accent border border-accent/30"
                              : "text-text-muted hover:text-text-secondary border border-transparent"
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Screenshot display */}
                  {result.screenshots[activeScreenshot]?.data && (
                    <div className="rounded-lg border border-border overflow-hidden bg-surface-2">
                      <img
                        src={`data:image/png;base64,${result.screenshots[activeScreenshot].data}`}
                        alt={result.screenshots[activeScreenshot].name}
                        className="w-full h-auto"
                      />
                      <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-border">
                        <span className="text-[9px] text-text-muted">
                          {result.screenshots[activeScreenshot].name}
                        </span>
                        <span className="text-[8px] text-text-muted">
                          {result.screenshots[activeScreenshot].viewport?.width}×
                          {result.screenshots[activeScreenshot].viewport?.height}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Timestamp */}
              <div className="text-[8px] text-text-muted text-right">
                {new Date(result.timestamp).toLocaleString("hr-HR")}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border shrink-0">
          <span className="text-[9px] text-text-muted">
            Playwright • Headless Chromium
          </span>
          <button
            onClick={onClose}
            className="text-[11px] text-text-muted hover:text-text px-3 py-1 rounded-lg hover:bg-surface-2 transition-colors"
          >
            Zatvori
          </button>
        </div>
      </div>
    </div>
  );
}

function BrowserCheckRow({ check }: { check: BrowserCheckResult }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-surface hover:bg-surface-2 transition-colors text-left"
      >
        <span>{check.passed ? "✅" : "❌"}</span>
        <span className="text-[11px]">
          {BROWSER_CHECK_ICONS[check.name]}
        </span>
        <span className="text-[11px] font-medium text-text-secondary">
          {BROWSER_CHECK_LABELS[check.name]}
        </span>
        {check.duration !== undefined && (
          <span className="text-[9px] text-text-muted ml-auto">
            {check.duration}ms
          </span>
        )}
        <span className="text-[10px] text-text-muted">
          {showDetails ? "▾" : "▸"}
        </span>
      </button>
      {showDetails && (
        <div className="border-t border-border px-2.5 py-2 bg-surface space-y-1.5">
          <div className="text-[10px] text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
            {check.evidence}
          </div>
          {/* Console errors */}
          {check.consoleErrors && check.consoleErrors.length > 0 && (
            <div>
              <div className="text-[9px] text-text-muted uppercase tracking-wider font-medium mb-0.5">
                Console Errors
              </div>
              <div className="text-[9px] text-red-400 font-mono whitespace-pre-wrap max-h-[80px] overflow-y-auto">
                {check.consoleErrors.join("\n")}
              </div>
            </div>
          )}
          {/* Network errors */}
          {check.networkErrors && check.networkErrors.length > 0 && (
            <div>
              <div className="text-[9px] text-text-muted uppercase tracking-wider font-medium mb-0.5">
                Network Errors
              </div>
              <div className="text-[9px] text-red-400 font-mono whitespace-pre-wrap max-h-[80px] overflow-y-auto">
                {check.networkErrors.join("\n")}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
