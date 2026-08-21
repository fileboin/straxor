import { api } from "./api.js";

// ── Types ──

export type DirectProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "moonshot"
  | "mistral"
  | "deepseek"
  | "xai"
  | "groq"
  | "together"
  | "ollama";

export interface DirectProviderDef {
  id: DirectProviderId;
  name: string;
  icon: string;
  baseUrl: string;
  authMethod: "api-key" | "none";
  healthEndpoint: string;
  models: { id: string; name: string; thinking?: boolean }[];
  description: string;
}

export interface DirectProviderStatus {
  providerId: DirectProviderId;
  hasKey: boolean;
  isEnabled: boolean;
  isHealthy: boolean | null;
  baseUrl: string;
  latencyMs: number | null;
  lastChecked: string | null;
  lastError: string | null;
  keyPreview: string | null;
  def?: DirectProviderDef;
}

export const PROVIDER_ICONS: Record<string, string> = {
  openai: "🟢",
  anthropic: "🟠",
  google: "🔵",
  moonshot: "🌙",
  mistral: "🌫",
  deepseek: "🐋",
  xai: "⚡",
  groq: "⚙",
  together: "🤝",
  ollama: "🦙",
};

export const PROVIDER_COLORS: Record<string, string> = {
  openai: "text-green-400",
  anthropic: "text-orange-400",
  google: "text-blue-400",
  moonshot: "text-yellow-400",
  mistral: "text-purple-400",
  deepseek: "text-cyan-400",
  xai: "text-yellow-300",
  groq: "text-amber-400",
  together: "text-pink-400",
  ollama: "text-emerald-400",
};

// ── API ──

export async function listProviders(): Promise<DirectProviderStatus[]> {
  return api("/providers");
}

export async function saveProviderKey(providerId: string, key: string): Promise<void> {
  await api(`/providers/${providerId}/key`, {
    method: "POST",
    body: JSON.stringify({ key }),
  });
}

export async function deleteProviderKey(providerId: string): Promise<void> {
  await api(`/providers/${providerId}/key`, { method: "DELETE" });
}

export async function updateProviderConfig(providerId: string, config: { baseUrl?: string; isEnabled?: boolean }): Promise<void> {
  await api(`/providers/${providerId}/config`, {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export async function checkProviderHealth(providerId: string): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
  return api(`/providers/${providerId}/health`, { method: "POST" });
}

export async function checkAllProvidersHealth(): Promise<Record<string, { healthy: boolean; latencyMs: number; error?: string }>> {
  return api("/providers/health-all", { method: "POST" });
}

export async function toggleProvider(providerId: string, enabled: boolean): Promise<void> {
  await api(`/providers/${providerId}/toggle`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
}

export async function getProviderKey(providerId: string): Promise<{ key: string }> {
  return api(`/providers/${providerId}/key`);
}
