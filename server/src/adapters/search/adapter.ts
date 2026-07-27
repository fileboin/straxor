export type SearchMode = "filename" | "text" | "regex";

export interface SearchQuery {
  machineId: string;
  query: string;
  mode: SearchMode;
  rootPath?: string;
  filePattern?: string;   // e.g. "*.tsx", "*.ts"
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

export interface SearchAdapter {
  search(query: SearchQuery): Promise<SearchResponse>;
  searchFilename(machineId: string, pattern: string, rootPath?: string): Promise<SearchResult[]>;
}
