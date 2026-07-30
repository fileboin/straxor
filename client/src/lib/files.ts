const API_BASE = import.meta.env.VITE_API_URL || "";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileEntry[];
  size?: number;
}

// List directory tree
export async function listFiles(machineId: string, rootPath: string = "."): Promise<FileEntry[]> {
  const res = await fetch(
    `${API_BASE}/api/files/tree?machineId=${machineId}&rootPath=${encodeURIComponent(rootPath)}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error("Greška pri učitavanju");
  return res.json();
}

// Read file content
export async function readFile(machineId: string, filePath: string): Promise<string> {
  const res = await fetch(
    `${API_BASE}/api/files/read?machineId=${machineId}&path=${encodeURIComponent(filePath)}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error("Greška pri čitanju");
  const data = await res.json();
  return data.content;
}

// Write file content
export async function writeFile(machineId: string, filePath: string, content: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/files/write`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ machineId, path: filePath, content }),
  });
  if (!res.ok) throw new Error("Greška pri spremanju");
}

// Delete file or directory
export async function deleteFile(machineId: string, filePath: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/files/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ machineId, path: filePath }),
  });
  if (!res.ok) throw new Error("Greška pri brisanju");
}

// Create directory
export async function createDir(machineId: string, dirPath: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/files/mkdir`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ machineId, path: dirPath }),
  });
  if (!res.ok) throw new Error("Greška pri kreiranju mape");
}

// Create empty file (touch)
export async function createFile(machineId: string, filePath: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/files/touch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ machineId, path: filePath }),
  });
  if (!res.ok) throw new Error("Greška pri kreiranju datoteke");
}

// Rename / move file or directory
export async function renameFile(machineId: string, oldPath: string, newPath: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/files/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ machineId, oldPath, newPath }),
  });
  if (!res.ok) throw new Error("Greška pri preimenovanju");
}

// Search files by content
export async function searchFiles(machineId: string, query: string, rootPath: string = "."): Promise<Array<{ path: string; line: number; content: string }>> {
  const res = await fetch(
    `${API_BASE}/api/files/search?machineId=${machineId}&query=${encodeURIComponent(query)}&rootPath=${encodeURIComponent(rootPath)}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error("Greška pri pretraživanju");
  return res.json();
}
