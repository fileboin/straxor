import { api } from "./api.js";

export interface AuditLog {
  id: string;
  userId: string | null;
  orgId: string | null;
  action: string;
  resource: string | null;
  details: string | null;
  ip: string | null;
  userAgent: string | null;
  severity: string;
  createdAt: string;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface SsoConfig {
  id: string;
  orgId: string;
  provider: string;
  label: string | null;
  config: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EncryptionKey {
  id: string;
  orgId: string | null;
  name: string;
  algorithm: string;
  keyData: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceReport {
  id: string;
  orgId: string;
  standard: string;
  status: string;
  findings: string | { control: string; passed: boolean; detail: string }[];
  summary: string | null;
  generatedAt: string;
}

export interface ComplianceFinding {
  control: string;
  passed: boolean;
  detail: string;
}

export const enterpriseApi = {
  // ── Audit Logs ──
  getAuditLogs: (params?: { orgId?: string; action?: string; severity?: string; limit?: number; offset?: number }) =>
    api<AuditLogsResponse>("GET", `/api/enterprise/audit-logs?${new URLSearchParams((params as Record<string, string>) || {}).toString()}`),

  createAuditLog: (data: { orgId?: string; action: string; resource?: string; details?: string; ip?: string; userAgent?: string; severity?: string }) =>
    api<AuditLog>("POST", "/api/enterprise/audit-logs", data),

  // ── SSO ──
  getSsoConfigs: (orgId: string) =>
    api<SsoConfig[]>("GET", `/api/enterprise/sso?orgId=${orgId}`),

  createSsoConfig: (data: { orgId: string; provider: string; label?: string; config?: string }) =>
    api<SsoConfig>("POST", "/api/enterprise/sso", data),

  updateSsoConfig: (id: string, data: { label?: string; config?: string; isEnabled?: boolean }) =>
    api<SsoConfig>("PUT", `/api/enterprise/sso/${id}`, data),

  deleteSsoConfig: (id: string) =>
    api<{ success: boolean }>("DELETE", `/api/enterprise/sso/${id}`),

  // ── Encryption Keys ──
  getEncryptionKeys: (orgId?: string) =>
    api<EncryptionKey[]>("GET", `/api/enterprise/encryption-keys${orgId ? `?orgId=${orgId}` : ""}`),

  createEncryptionKey: (data: { orgId?: string; name: string; algorithm?: string; keyData?: string }) =>
    api<EncryptionKey>("POST", "/api/enterprise/encryption-keys", data),

  updateEncryptionKey: (id: string, data: { name?: string; algorithm?: string; keyData?: string; isActive?: boolean }) =>
    api<EncryptionKey>("PUT", `/api/enterprise/encryption-keys/${id}`, data),

  deleteEncryptionKey: (id: string) =>
    api<{ success: boolean }>("DELETE", `/api/enterprise/encryption-keys/${id}`),

  // ── Compliance ──
  getComplianceReports: (orgId?: string, standard?: string) =>
    api<ComplianceReport[]>("GET", `/api/enterprise/compliance?${new URLSearchParams({ ...(orgId && { orgId }), ...(standard && { standard }) } as Record<string, string>).toString()}`),

  generateComplianceReport: (data: { orgId: string; standard: string; hasEncryption?: boolean }) =>
    api<ComplianceReport>("POST", "/api/enterprise/compliance", data),

  getComplianceStandards: () =>
    api<{ standards: { id: string; name: string; description: string }[] }>("GET", "/api/enterprise/compliance/standards"),

  // ── Deployment Config ──
  getDeploymentConfig: () =>
    api<{ supported: boolean; modes: { id: string; name: string; description: string }[]; features: Record<string, boolean> }>("GET", "/api/enterprise/deployment-config"),
};
