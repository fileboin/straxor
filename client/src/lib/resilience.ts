import { api } from "./api.js";

export interface VaultSecret {
  id: string;
  orgId: string | null;
  name: string;
  type: string;
  encryptedValue: string;
  algorithm: string;
  metadata: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedSecret {
  id: string;
  name: string;
  value: string;
}

export interface SessionGuardrail {
  id: string;
  sessionId: string | null;
  projectId: string | null;
  maxTokens: number | null;
  maxCost: number | null;
  currentTokens: number;
  currentCost: number;
  isPaused: boolean;
  triggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSnapshot {
  id: string;
  name: string;
  type: string;
  filePath: string | null;
  size: number | null;
  checksum: string | null;
  encryptionKey: string | null;
  metadata: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineConfig {
  id?: string;
  isEnabled: boolean;
  localModelProvider: string;
  localModelName: string;
  localGitPath: string | null;
  localRuntime: string;
  airGapped: boolean;
  allowedDomains: string;
  syncOnReconnect: boolean;
  lastSyncAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResilienceStatus {
  vault: { totalSecrets: number; encryption: string };
  guardrails: { activeLimits: number; hardStopEnabled: boolean };
  disasterRecovery: { snapshots: number; lastRestore: null | string };
  offlineMode: { enabled: boolean; airGapped: boolean; model: string };
}

export const resilienceApi = {
  getStatus: () => api<ResilienceStatus>("GET", "/api/resilience/status"),

  // Vault
  getSecrets: (params?: { orgId?: string; type?: string }) =>
    api<VaultSecret[]>("GET", `/api/resilience/vault?${new URLSearchParams((params as Record<string, string>) || {}).toString()}`),
  createSecret: (data: { orgId?: string; name: string; type?: string; value: string; algorithm?: string; metadata?: Record<string, unknown> }) =>
    api<VaultSecret>("POST", "/api/resilience/vault", data),
  updateSecret: (id: string, data: { name?: string; value?: string; type?: string; algorithm?: string; isActive?: boolean }) =>
    api<VaultSecret>("PUT", `/api/resilience/vault/${id}`, data),
  deleteSecret: (id: string) => api<{ success: boolean }>("DELETE", `/api/resilience/vault/${id}`),
  decryptSecret: (id: string) => api<DecryptedSecret>("GET", `/api/resilience/vault/${id}/decrypt`),

  // Guardrails
  getGuardrails: (params?: { sessionId?: string; projectId?: string }) =>
    api<SessionGuardrail[]>("GET", `/api/resilience/guardrails?${new URLSearchParams((params as Record<string, string>) || {}).toString()}`),
  createGuardrail: (data: { sessionId?: string; projectId?: string; maxTokens?: number; maxCost?: number }) =>
    api<SessionGuardrail>("POST", "/api/resilience/guardrails", data),
  updateGuardrail: (id: string, data: { maxTokens?: number; maxCost?: number; currentTokens?: number; currentCost?: number; isPaused?: boolean }) =>
    api<SessionGuardrail>("PUT", `/api/resilience/guardrails/${id}`, data),
  pauseGuardrail: (id: string) => api<{ message: string; guardrail: SessionGuardrail }>("POST", `/api/resilience/guardrails/${id}/pause`),
  resumeGuardrail: (id: string) => api<{ message: string; guardrail: SessionGuardrail }>("POST", `/api/resilience/guardrails/${id}/resume`),

  // Snapshots
  getSnapshots: () => api<SystemSnapshot[]>("GET", "/api/resilience/snapshots"),
  createSnapshot: (data: { name: string; type?: string }) => api<SystemSnapshot>("POST", "/api/resilience/snapshots", data),
  updateSnapshot: (id: string, data: { name?: string; status?: string; filePath?: string; checksum?: string }) =>
    api<SystemSnapshot>("PUT", `/api/resilience/snapshots/${id}`, data),
  deleteSnapshot: (id: string) => api<{ success: boolean }>("DELETE", `/api/resilience/snapshots/${id}`),
  restoreSnapshot: (snapshotId: string) => api<{ message: string; snapshot: SystemSnapshot; status: string; timestamp: string }>("POST", `/api/resilience/restore/${snapshotId}`),

  // Offline Mode
  getOfflineConfig: () => api<OfflineConfig>("GET", "/api/resilience/offline"),
  updateOfflineConfig: (data: Partial<OfflineConfig>) => api<OfflineConfig>("PUT", "/api/resilience/offline", data),
  syncOffline: () => api<{ message: string; lastSyncAt: string }>("POST", "/api/resilience/offline/sync"),
};
