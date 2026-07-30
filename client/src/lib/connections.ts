const BASE = "/api/connections";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface AdapterInfo {
  name: string;
  displayName: string;
  category: string;
  description: string;
  icon: string;
  authType: string;
  configSchema: any[];
  operations: any[];
}

export interface ConnectionInstance {
  id: string;
  adapterName: string;
  name: string;
  category: string;
  config: Record<string, any>;
  status: "connected" | "disconnected" | "error" | "pending";
  lastTestedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Stats ──
export function getConnectionStats() {
  return fetchJSON<any>(`${BASE}/stats`);
}

// ── Adapters ──
export function listAdapters(category?: string) {
  const params = category ? `?category=${category}` : "";
  return fetchJSON<{ adapters: AdapterInfo[] }>(`${BASE}/adapters${params}`);
}

export function getAdapter(name: string) {
  return fetchJSON<AdapterInfo>(`${BASE}/adapters/${encodeURIComponent(name)}`);
}

export function getAdapterOperations(name: string) {
  return fetchJSON<{ operations: any[] }>(`${BASE}/adapters/${encodeURIComponent(name)}/operations`);
}

// ── Instances ──
export function listInstances(category?: string) {
  const params = category ? `?category=${category}` : "";
  return fetchJSON<{ instances: ConnectionInstance[] }>(`${BASE}/instances${params}`);
}

export function createInstance(adapterName: string, name: string, config: Record<string, any>) {
  return fetchJSON<ConnectionInstance>(`${BASE}/instances`, {
    method: "POST",
    body: JSON.stringify({ adapterName, name, config }),
  });
}

export function getInstance(id: string) {
  return fetchJSON<ConnectionInstance>(`${BASE}/instances/${id}`);
}

export function updateInstance(id: string, updates: Partial<ConnectionInstance>) {
  return fetchJSON<ConnectionInstance>(`${BASE}/instances/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export function deleteInstance(id: string) {
  return fetchJSON<{ success: boolean }>(`${BASE}/instances/${id}`, { method: "DELETE" });
}

// ── Test / Execute ──
export function testConnection(id: string) {
  return fetchJSON<{ success: boolean; latency: number; message: string }>(
    `${BASE}/instances/${id}/test`,
    { method: "POST" }
  );
}

export function executeConnection(id: string, operation: string, payload?: any) {
  return fetchJSON<any>(`${BASE}/instances/${id}/execute`, {
    method: "POST",
    body: JSON.stringify({ operation, payload }),
  });
}

// ── Categories ──
export function getConnectionCategories() {
  return fetchJSON<{ categories: Array<{ id: string; name: string; count: number; adapters: any[] }> }>(
    `${BASE}/categories`
  );
}

// ── Events ──
export function getConnectionEvents(limit = 50) {
  return fetchJSON<{ events: any[] }>(`${BASE}/events?limit=${limit}`);
}
