const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

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
  if (!res.ok) throw new Error("Failed to list files");
  return res.json();
}

// Read file content
export async function readFile(machineId: string, filePath: string): Promise<string> {
  const res = await fetch(
    `${API_BASE}/api/files/read?machineId=${machineId}&path=${encodeURIComponent(filePath)}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error("Failed to read file");
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
  if (!res.ok) throw new Error("Failed to write file");
}

// Delete file
export async function deleteFile(machineId: string, filePath: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/files/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ machineId, path: filePath }),
  });
  if (!res.ok) throw new Error("Failed to delete file");
}

// Create directory
export async function createDir(machineId: string, dirPath: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/files/mkdir`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ machineId, path: dirPath }),
  });
  if (!res.ok) throw new Error("Failed to create directory");
}

// Search files by content
export async function searchFiles(machineId: string, query: string, rootPath: string = "."): Promise<Array<{ path: string; line: number; content: string }>> {
  const res = await fetch(
    `${API_BASE}/api/files/search?machineId=${machineId}&query=${encodeURIComponent(query)}&rootPath=${encodeURIComponent(rootPath)}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error("Failed to search files");
  return res.json();
}
