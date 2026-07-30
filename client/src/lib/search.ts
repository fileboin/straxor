export type SearchMode = "filename" | "text" | "regex";

export interface SearchQuery {
  machineId: string;
  query: string;
  mode: SearchMode;
  rootPath?: string;
  filePattern?: string;
  caseSensitive?: boolean;
  maxResults?: number;
}

export interface SearchResult {
  path: string;
  line: number;
  column?: number;
  content: string;
  matchStart?: number;
  matchEnd?: number;
}

export interface SearchStats {
  totalMatches: number;
  filesSearched: number;
  duration: number;
}

export interface SearchResponse {
  results: SearchResult[];
  stats: SearchStats;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function searchProject(query: SearchQuery): Promise<SearchResponse> {
  const params = new URLSearchParams({
    machineId: query.machineId,
    query: query.query,
    mode: query.mode,
  });
  if (query.rootPath) params.set("rootPath", query.rootPath);
  if (query.filePattern) params.set("filePattern", query.filePattern);
  if (query.caseSensitive) params.set("caseSensitive", "true");
  if (query.maxResults) params.set("maxResults", String(query.maxResults));

  const res = await fetch(`${API_BASE}/api/search?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Pretraga nije uspjela");
  return res.json();
}

export async function searchFilenames(machineId: string, pattern: string, rootPath?: string): Promise<SearchResponse> {
  const params = new URLSearchParams({ machineId, pattern });
  if (rootPath) params.set("rootPath", rootPath);

  const res = await fetch(`${API_BASE}/api/search/filename?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Pretraga datoteka nije uspjela");
  return res.json();
}

export const SEARCH_MODE_LABELS: Record<SearchMode, string> = {
  filename: "Naziv datoteke",
  text: "Tekst u kodu",
  regex: "Regex",
};

export const SEARCH_MODE_ICONS: Record<SearchMode, string> = {
  filename: "📄",
  text: "🔍",
  regex: ".*",
};

export function highlightMatch(text: string, start?: number, end?: number): { before: string; match: string; after: string } {
  if (start === undefined || end === undefined) {
    return { before: "", match: text, after: "" };
  }
  return {
    before: text.slice(0, start),
    match: text.slice(start, end),
    after: text.slice(end),
  };
}
