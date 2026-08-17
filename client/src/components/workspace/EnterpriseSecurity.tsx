import { useState, useEffect, useCallback } from "react";
import {
  enterpriseApi,
  type AuditLog,
  type SsoConfig,
  type EncryptionKey,
  type ComplianceReport,
  type ComplianceFinding,
} from "../../lib/enterprise";

interface Props {
  onClose: () => void;
}

type Tab = "audit" | "sso" | "encryption" | "compliance" | "deployment";

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-500/20 text-blue-300",
  warn: "bg-yellow-500/20 text-yellow-300",
  error: "bg-red-500/20 text-red-300",
  critical: "bg-red-600/30 text-red-200",
};

const AUDIT_ACTIONS = ["", "login", "logout", "create", "update", "delete", "deploy", "config_change", "permission_change", "api_key_create", "export"];
const SEVERITIES = ["", "info", "warn", "error", "critical"];
const SSO_PROVIDERS = ["saml", "oidc", "oauth2"];
const COMPLIANCE_STANDARDS = [
  { id: "soc2", name: "SOC 2", icon: "🔒" },
  { id: "gdpr", name: "GDPR", icon: "🇪🇺" },
  { id: "hipaa", name: "HIPAA", icon: "🏥" },
  { id: "pci-dss", name: "PCI DSS", icon: "💳" },
  { id: "iso-27001", name: "ISO 27001", icon: "📜" },
];

export default function EnterpriseSecurity({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("audit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  // Audit
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditFilter, setAuditFilter] = useState({ action: "", severity: "", orgId: "" });
  const [auditPage, setAuditPage] = useState(0);

  // SSO
  const [ssoConfigs, setSsoConfigs] = useState<SsoConfig[]>([]);
  const [ssoOrgId, setSsoOrgId] = useState("");
  const [ssoForm, setSsoForm] = useState({ provider: "saml", label: "", config: "{}" });
  const [showSsoForm, setShowSsoForm] = useState(false);

  // Encryption
  const [encKeys, setEncKeys] = useState<EncryptionKey[]>([]);
  const [encForm, setEncForm] = useState({ name: "", algorithm: "aes-256-gcm", keyData: "" });
  const [showEncForm, setShowEncForm] = useState(false);

  // Compliance
  const [complianceReports, setComplianceReports] = useState<ComplianceReport[]>([]);
  const [complianceOrgId, setComplianceOrgId] = useState("");
  const [showComplianceForm, setShowComplianceForm] = useState(false);
  const [compStandard, setCompStandard] = useState("soc2");
  const [compResult, setCompResult] = useState<ComplianceReport | null>(null);

  // Deployment
  const [deployConfig, setDeployConfig] = useState<any>(null);

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 2500);
  };

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: "25", offset: String(auditPage * 25) };
      if (auditFilter.action) params.action = auditFilter.action;
      if (auditFilter.severity) params.severity = auditFilter.severity;
      const res = await enterpriseApi.getAuditLogs(params);
      setAuditLogs(res.logs);
      setAuditTotal(res.total);
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  }, [auditPage, auditFilter]);

  const loadSso = useCallback(async () => {
    if (!ssoOrgId) return;
    try {
      const configs = await enterpriseApi.getSsoConfigs(ssoOrgId);
      setSsoConfigs(configs);
    } catch (err: any) { flash(err.message); }
  }, [ssoOrgId]);

  const loadEncKeys = useCallback(async () => {
    try {
      const keys = await enterpriseApi.getEncryptionKeys();
      setEncKeys(keys);
    } catch (err: any) { flash(err.message); }
  }, []);

  const loadCompliance = useCallback(async () => {
    try {
      const reports = await enterpriseApi.getComplianceReports(complianceOrgId || undefined);
      setComplianceReports(reports);
    } catch (err: any) { flash(err.message); }
  }, [complianceOrgId]);

  const loadDeployConfig = useCallback(async () => {
    try {
      const cfg = await enterpriseApi.getDeploymentConfig();
      setDeployConfig(cfg);
    } catch (err: any) { flash(err.message); }
  }, []);

  useEffect(() => { if (tab === "audit") loadAuditLogs(); }, [tab, loadAuditLogs]);
  useEffect(() => { if (tab === "sso" && ssoOrgId) loadSso(); }, [tab, ssoOrgId, loadSso]);
  useEffect(() => { if (tab === "encryption") loadEncKeys(); }, [tab, loadEncKeys]);
  useEffect(() => { if (tab === "compliance") loadCompliance(); }, [tab, complianceOrgId, loadCompliance]);
  useEffect(() => { if (tab === "deployment") loadDeployConfig(); }, [tab, loadDeployConfig]);

  const handleAddSso = async () => {
    try {
      const sso = await enterpriseApi.createSsoConfig({ orgId: ssoOrgId, ...ssoForm });
      setSsoConfigs((prev) => [...prev, sso]);
      setShowSsoForm(false);
      setSsoForm({ provider: "saml", label: "", config: "{}" });
      flash("SSO config added");
    } catch (err: any) { flash(err.message); }
  };

  const handleToggleSso = async (sso: SsoConfig) => {
    try {
      const updated = await enterpriseApi.updateSsoConfig(sso.id, { isEnabled: !sso.isEnabled });
      setSsoConfigs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err: any) { flash(err.message); }
  };

  const handleDeleteSso = async (id: string) => {
    try {
      await enterpriseApi.deleteSsoConfig(id);
      setSsoConfigs((prev) => prev.filter((s) => s.id !== id));
      flash("SSO config deleted");
    } catch (err: any) { flash(err.message); }
  };

  const handleAddEncKey = async () => {
    try {
      const key = await enterpriseApi.createEncryptionKey(encForm);
      setEncKeys((prev) => [...prev, key]);
      setShowEncForm(false);
      setEncForm({ name: "", algorithm: "aes-256-gcm", keyData: "" });
      flash("Encryption key created");
    } catch (err: any) { flash(err.message); }
  };

  const handleToggleEncKey = async (key: EncryptionKey) => {
    try {
      const updated = await enterpriseApi.updateEncryptionKey(key.id, { isActive: !key.isActive });
      setEncKeys((prev) => prev.map((k) => (k.id === updated.id ? updated : k)));
    } catch (err: any) { flash(err.message); }
  };

  const handleDeleteEncKey = async (id: string) => {
    try {
      await enterpriseApi.deleteEncryptionKey(id);
      setEncKeys((prev) => prev.filter((k) => k.id !== id));
      flash("Encryption key deleted");
    } catch (err: any) { flash(err.message); }
  };

  const handleGenerateCompliance = async () => {
    try {
      const report = await enterpriseApi.generateComplianceReport({ orgId: complianceOrgId || "default", standard: compStandard });
      setComplianceReports((prev) => [report, ...prev]);
      setCompResult(report);
      setShowComplianceForm(false);
      flash(`${compStandard.toUpperCase()} report generated`);
    } catch (err: any) { flash(err.message); }
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "audit", label: "Audit Logs", icon: "📋" },
    { id: "sso", label: "SSO / SAML", icon: "🔐" },
    { id: "encryption", label: "Encryption", icon: "🔑" },
    { id: "compliance", label: "Compliance", icon: "✅" },
    { id: "deployment", label: "Private Deploy", icon: "🏭" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-5xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <span className="text-lg">🏢</span>
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-text">Enterprise Security & Compliance</h1>
              <p className="text-[10px] text-text-muted">Audit, SSO, enkripcija, compliance, privatni deployment</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text text-sm px-2 py-1 rounded-lg hover:bg-surface-dim transition-colors">✕</button>
        </div>

        {actionMsg && (
          <div className="mx-5 mt-2 px-3 py-1.5 bg-accent/10 text-accent text-[11px] rounded-lg">{actionMsg}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 border-b border-border shrink-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                tab === t.id ? "bg-accent/10 text-accent border-b-2 border-accent" : "text-text-muted hover:text-text hover:bg-surface-dim"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ── AUDIT LOGS ── */}
          {tab === "audit" && (
            <>
              <div className="flex items-center gap-3 mb-3">
                <select value={auditFilter.action} onChange={(e) => { setAuditFilter((p) => ({ ...p, action: e.target.value })); setAuditPage(0); }}
                  className="px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-[11px] text-text">
                  <option value="">All Actions</option>
                  {AUDIT_ACTIONS.filter(Boolean).map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
                </select>
                <select value={auditFilter.severity} onChange={(e) => { setAuditFilter((p) => ({ ...p, severity: e.target.value })); setAuditPage(0); }}
                  className="px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-[11px] text-text">
                  <option value="">All Severities</option>
                  {SEVERITIES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="text-[10px] text-text-muted ml-auto">{auditTotal} entries</span>
              </div>

              {loading ? (
                <div className="text-text-muted text-[11px] py-8 text-center">Loading...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-text-muted text-[11px] py-8 text-center">No audit logs found</div>
              ) : (
                <div className="space-y-1">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 px-3 py-2 bg-surface-dim rounded-lg">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${SEVERITY_COLORS[log.severity] || "bg-gray-500/20 text-gray-300"}`}>
                        {log.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-text font-medium">{log.action.replace(/_/g, " ")}</div>
                        {log.resource && <div className="text-[10px] text-text-muted truncate">{log.resource}</div>}
                      </div>
                      <div className="text-[9px] text-text-muted shrink-0">{new Date(log.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}

              {auditTotal > 25 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button disabled={auditPage === 0} onClick={() => setAuditPage((p) => p - 1)}
                    className="px-3 py-1 bg-surface-dim border border-border rounded-lg text-[11px] text-text disabled:opacity-40">Prev</button>
                  <span className="text-[10px] text-text-muted">Page {auditPage + 1} of {Math.ceil(auditTotal / 25)}</span>
                  <button disabled={(auditPage + 1) * 25 >= auditTotal} onClick={() => setAuditPage((p) => p + 1)}
                    className="px-3 py-1 bg-surface-dim border border-border rounded-lg text-[11px] text-text disabled:opacity-40">Next</button>
                </div>
              )}
            </>
          )}

          {/* ── SSO ── */}
          {tab === "sso" && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <input value={ssoOrgId} onChange={(e) => setSsoOrgId(e.target.value)} placeholder="Organization ID"
                  className="flex-1 px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                <button onClick={loadSso} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">Load</button>
                {ssoOrgId && <button onClick={() => setShowSsoForm(true)} className="px-3 py-1.5 bg-surface-dim border border-border text-text text-[11px] rounded-lg hover:bg-border">+ Add SSO</button>}
              </div>

              {showSsoForm && (
                <div className="p-3 bg-surface-dim rounded-lg space-y-2 mb-3">
                  <select value={ssoForm.provider} onChange={(e) => setSsoForm((p) => ({ ...p, provider: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text">
                    {SSO_PROVIDERS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                  </select>
                  <input value={ssoForm.label} onChange={(e) => setSsoForm((p) => ({ ...p, label: e.target.value }))} placeholder="Label (e.g. Company SSO)"
                    className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                  <textarea value={ssoForm.config} onChange={(e) => setSsoForm((p) => ({ ...p, config: e.target.value }))} placeholder='JSON config (e.g. {"issuer":"...","entryPoint":"..."})' rows={3}
                    className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted font-mono" />
                  <div className="flex gap-2">
                    <button onClick={handleAddSso} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">Save</button>
                    <button onClick={() => setShowSsoForm(false)} className="px-3 py-1.5 text-text-muted text-[11px]">Cancel</button>
                  </div>
                </div>
              )}

              {ssoConfigs.length === 0 ? (
                <div className="text-text-muted text-[11px] py-8 text-center">{ssoOrgId ? "No SSO configs" : "Enter an Organization ID and click Load"}</div>
              ) : (
                <div className="space-y-2">
                  {ssoConfigs.map((sso) => (
                    <div key={sso.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-dim rounded-lg">
                      <span className="text-lg">{sso.provider === "saml" ? "🔐" : sso.provider === "oidc" ? "🔑" : "🔗"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-text font-medium">{sso.label || sso.provider.toUpperCase()}</div>
                        <div className="text-[10px] text-text-muted">{sso.provider.toUpperCase()}{sso.isEnabled ? " • Enabled" : " • Disabled"}</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={sso.isEnabled} onChange={() => handleToggleSso(sso)} className="sr-only peer" />
                        <div className="w-7 h-4 bg-border rounded-full peer peer-checked:bg-accent peer-checked:after:translate-x-3 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:w-3 after:h-3 after:rounded-full after:bg-white transition-all"></div>
                      </label>
                      <button onClick={() => handleDeleteSso(sso.id)} className="text-red-400 hover:text-red-300 text-[11px]">Delete</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── ENCRYPTION ── */}
          {tab === "encryption" && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-text-muted">Manage encryption keys for data at rest</p>
                <button onClick={() => setShowEncForm(true)} className="px-3 py-1.5 bg-surface-dim border border-border text-text text-[11px] rounded-lg hover:bg-border">+ Add Key</button>
              </div>

              {showEncForm && (
                <div className="p-3 bg-surface-dim rounded-lg space-y-2 mb-3">
                  <input value={encForm.name} onChange={(e) => setEncForm((p) => ({ ...p, name: e.target.value }))} placeholder="Key name"
                    className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                  <select value={encForm.algorithm} onChange={(e) => setEncForm((p) => ({ ...p, algorithm: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text">
                    <option value="aes-256-gcm">AES-256-GCM</option>
                    <option value="aes-128-gcm">AES-128-GCM</option>
                    <option value="chacha20-poly1305">ChaCha20-Poly1305</option>
                    <option value="rsa-4096">RSA-4096</option>
                  </select>
                  <textarea value={encForm.keyData} onChange={(e) => setEncForm((p) => ({ ...p, keyData: e.target.value }))} placeholder="Key data (base64 encoded)" rows={2}
                    className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted font-mono" />
                  <div className="flex gap-2">
                    <button onClick={handleAddEncKey} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">Save</button>
                    <button onClick={() => setShowEncForm(false)} className="px-3 py-1.5 text-text-muted text-[11px]">Cancel</button>
                  </div>
                </div>
              )}

              {encKeys.length === 0 ? (
                <div className="text-text-muted text-[11px] py-8 text-center">No encryption keys</div>
              ) : (
                <div className="space-y-2">
                  {encKeys.map((key) => (
                    <div key={key.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-dim rounded-lg">
                      <span className="text-lg">{key.isActive ? "🔓" : "🔒"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-text font-medium">{key.name}</div>
                        <div className="text-[10px] text-text-muted">{key.algorithm}{key.isActive ? " • Active" : " • Inactive"}</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={key.isActive} onChange={() => handleToggleEncKey(key)} className="sr-only peer" />
                        <div className="w-7 h-4 bg-border rounded-full peer peer-checked:bg-accent peer-checked:after:translate-x-3 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:w-3 after:h-3 after:rounded-full after:bg-white transition-all"></div>
                      </label>
                      <button onClick={() => handleDeleteEncKey(key.id)} className="text-red-400 hover:text-red-300 text-[11px]">Delete</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── COMPLIANCE ── */}
          {tab === "compliance" && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <input value={complianceOrgId} onChange={(e) => setComplianceOrgId(e.target.value)} placeholder="Organization ID (optional)"
                  className="flex-1 px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                <button onClick={() => setShowComplianceForm(true)} className="px-3 py-1.5 bg-surface-dim border border-border text-text text-[11px] rounded-lg hover:bg-border">+ Generate Report</button>
              </div>

              {showComplianceForm && (
                <div className="p-3 bg-surface-dim rounded-lg space-y-2 mb-3">
                  <div className="flex gap-2">
                    {COMPLIANCE_STANDARDS.map((s) => (
                      <button key={s.id} onClick={() => setCompStandard(s.id)}
                        className={`px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                          compStandard === s.id ? "bg-accent text-white" : "bg-surface text-text-muted hover:text-text"
                        }`}>
                        {s.icon} {s.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleGenerateCompliance} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">Generate</button>
                    <button onClick={() => setShowComplianceForm(false)} className="px-3 py-1.5 text-text-muted text-[11px]">Cancel</button>
                  </div>
                </div>
              )}

              {compResult && (
                <div className="p-3 bg-surface-dim rounded-lg mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[13px] font-bold text-text">{compResult.summary}</h3>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${
                      compResult.status === "passed" ? "bg-green-500/20 text-green-300" :
                      compResult.status === "partial" ? "bg-yellow-500/20 text-yellow-300" :
                      "bg-red-500/20 text-red-300"
                    }`}>{compResult.status}</span>
                  </div>
                  {(() => {
                    const findings = typeof compResult.findings === "string"
                      ? JSON.parse(compResult.findings)
                      : compResult.findings as ComplianceFinding[];
                    return (
                      <div className="space-y-1">
                        {findings.map((f: ComplianceFinding, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-[11px]">
                            <span>{f.passed ? "✅" : "❌"}</span>
                            <span className="text-text font-medium">{f.control}</span>
                            <span className="text-text-muted text-[10px]">{f.detail}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {complianceReports.length === 0 ? (
                <div className="text-text-muted text-[11px] py-8 text-center">No compliance reports yet</div>
              ) : (
                <div className="space-y-2">
                  {complianceReports.map((report) => (
                    <div key={report.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-dim rounded-lg cursor-pointer hover:bg-surface-dim/80"
                      onClick={() => setCompResult(report)}>
                      <span className="text-lg">{COMPLIANCE_STANDARDS.find((s) => s.id === report.standard)?.icon || "📋"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-text font-medium uppercase">{report.standard}</div>
                        <div className="text-[10px] text-text-muted">{report.summary || report.status}</div>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                        report.status === "passed" ? "bg-green-500/20 text-green-300" :
                        report.status === "partial" ? "bg-yellow-500/20 text-yellow-300" :
                        "bg-red-500/20 text-red-300"
                      }`}>{report.status}</span>
                      <div className="text-[9px] text-text-muted">{new Date(report.generatedAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── PRIVATE DEPLOYMENT ── */}
          {tab === "deployment" && (
            <>
              {!deployConfig ? (
                <div className="text-text-muted text-[11px] py-8 text-center">Loading...</div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-[13px] font-bold text-text mb-2">Deployment Modes</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {deployConfig.modes.map((mode: any) => (
                        <div key={mode.id} className="p-3 bg-surface-dim rounded-lg">
                          <div className="text-[12px] font-medium text-text">{mode.name}</div>
                          <div className="text-[10px] text-text-muted mt-1">{mode.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[13px] font-bold text-text mb-2">Available Features</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(deployConfig.features).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2 px-3 py-2 bg-surface-dim rounded-lg">
                          <span>{val ? "✅" : "❌"}</span>
                          <span className="text-[11px] text-text">{key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
                    <h3 className="text-[13px] font-bold text-accent mb-1">Air-Gapped Ready</h3>
                    <p className="text-[11px] text-text-muted">Straxor podržava potpuno izolovano okruženje bez internet pristupa. Svi modeli se pokreću lokalno, a podaci nikada ne napuštaju tvoju infrastrukturu.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
