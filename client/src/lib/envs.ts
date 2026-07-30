export interface EnvVar {
  id: string;
  key: string;
  value: string;
  rawValue: string;
  description?: string;
  isSecret: boolean;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EnvHistoryEntry {
  id: string;
  envId: string | null;
  action: "create" | "update" | "delete";
  key: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface EnvValidationResult {
  valid: boolean;
  errors: { key: string; error: string }[];
}

const API_BASE = import.meta.env.VITE_API_URL || "";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchEnvs(projectId: string): Promise<EnvVar[]> {
  const res = await fetch(`${API_BASE}/api/envs/${projectId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch envs");
  return res.json();
}

export async function createEnv(
  projectId: string,
  data: { key: string; value: string; description?: string; isSecret?: boolean; isRequired?: boolean }
): Promise<EnvVar> {
  const res = await fetch(`${API_BASE}/api/envs/${projectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed" }));
    throw new Error(err.error || "Failed to create env");
  }
  return res.json();
}

export async function updateEnv(
  projectId: string,
  envId: string,
  data: { value?: string; description?: string; isSecret?: boolean; isRequired?: boolean }
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/envs/${projectId}/${envId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed" }));
    throw new Error(err.error || "Failed to update env");
  }
}

export async function deleteEnv(projectId: string, envId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/envs/${projectId}/${envId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete env");
}

export async function fetchEnvHistory(
  projectId: string,
  limit?: number
): Promise<EnvHistoryEntry[]> {
  const query = limit ? `?limit=${limit}` : "";
  const res = await fetch(`${API_BASE}/api/envs/${projectId}/history${query}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function validateEnvs(projectId: string): Promise<EnvValidationResult> {
  const res = await fetch(`${API_BASE}/api/envs/${projectId}/validate`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to validate envs");
  return res.json();
}
