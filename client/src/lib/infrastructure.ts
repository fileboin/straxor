import { api } from "./api.js";

export type InfraType = "dns" | "ssl" | "proxy" | "tunnel" | "monitor" | "alert";

export type InfraStatus = "pending" | "active" | "error" | "disabled";

export interface InfraConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "select" | "number";
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

export interface InfraProviderDef {
  id: string;
  type: InfraType;
  name: string;
  description: string;
  icon: string;
  color: string;
  docsUrl?: string;
  configFields: InfraConfigField[];
  credentialFields: InfraConfigField[];
}

export interface InfraConfig {
  id: string;
  userId: string;
  projectId: string | null;
  machineId: string | null;
  type: InfraType;
  adapter: string;
  name: string;
  domain: string | null;
  status: InfraStatus;
  config: Record<string, unknown>;
  credentials: Record<string, string>;
  lastChecked: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InfraHealthCheck {
  configId: string;
  status: "ok" | "degraded" | "down" | "unknown";
  latency: number | null;
  message: string | null;
  checkedAt: string;
}

export const TYPE_META: Record<InfraType, { label: string; icon: string; color: string; description: string }> = {
  dns: { label: "DNS", icon: "🌐", color: "blue", description: "DNS provideri i record management" },
  ssl: { label: "SSL", icon: "🔒", color: "green", description: "SSL/TLS certifikati" },
  proxy: { label: "Proxy", icon: "↔", color: "orange", description: "Reverse proxy config" },
  tunnel: { label: "Tunnel", icon: "🔀", color: "purple", description: "Tuneliranje" },
  monitor: { label: "Monitor", icon: "📊", color: "red", description: "Uptime monitoring" },
  alert: { label: "Alert", icon: "🔔", color: "yellow", description: "Incident notifikacije" },
};

export async function listInfraProviders(): Promise<InfraProviderDef[]> {
  return api("/infrastructure/providers");
}

export async function listInfraConfigs(type?: InfraType): Promise<InfraConfig[]> {
  const params = type ? `?type=${type}` : "";
  return api(`/infrastructure${params}`);
}

export async function addInfraConfig(data: {
  type: InfraType;
  adapter: string;
  name: string;
  domain?: string;
  projectId?: string;
  machineId?: string;
  config?: Record<string, unknown>;
  credentials?: Record<string, string>;
}): Promise<InfraConfig> {
  return api("/infrastructure", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateInfraConfig(
  id: string,
  data: Partial<{
    name: string;
    domain: string;
    status: InfraStatus;
    config: Record<string, unknown>;
    credentials: Record<string, string>;
    lastError: string;
  }>
): Promise<InfraConfig> {
  return api(`/infrastructure/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteInfraConfig(id: string): Promise<void> {
  await api(`/infrastructure/${id}`, { method: "DELETE" });
}

export async function testInfraConfig(id: string): Promise<InfraHealthCheck> {
  return api(`/infrastructure/${id}/test`, { method: "POST" });
}
