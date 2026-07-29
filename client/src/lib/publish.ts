const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface PublishLink {
  id: string;
  projectId: string;
  userId: string;
  slug: string;
  url: string;
  isEnabled: boolean;
  hasPassword: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getPublishLinks(projectId: string): Promise<PublishLink[]> {
  const res = await fetch(`${API_BASE}/api/publish/${projectId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch publish links");
  return res.json();
}

export async function createPublishLink(projectId: string, data?: { password?: string; expiresInHours?: number }): Promise<PublishLink> {
  const res = await fetch(`${API_BASE}/api/publish/${projectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data || {}),
  });
  if (!res.ok) throw new Error("Failed to create publish link");
  return res.json();
}

export async function updatePublishLink(projectId: string, linkId: string, data: { isEnabled?: boolean; password?: string | null; expiresInHours?: number | null }): Promise<PublishLink> {
  const res = await fetch(`${API_BASE}/api/publish/${projectId}/${linkId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update publish link");
  return res.json();
}

export async function deletePublishLink(projectId: string, linkId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/publish/${projectId}/${linkId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete publish link");
}
