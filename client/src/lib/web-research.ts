import { api } from "./api.js";

export interface WebResearchProviderInfo {
  id: string;
  name: string;
  enabled: boolean;
}

export interface WebResearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  content?: string;
  rawContent?: string;
  score: number;
  source: string;
  publishedDate?: string;
  metadata?: Record<string, string>;
}

export interface WebResearchResponse {
  query: string;
  provider: string;
  results: WebResearchResult[];
  totalResults: number;
  durationMs: number;
  cached: boolean;
}

export interface WebResearchSearchAllResponse {
  query: string;
  responses: WebResearchResponse[];
  totalResults: number;
}

export async function getWebResearchProviders(): Promise<WebResearchProviderInfo[]> {
  return api("/web-research/providers");
}

export async function webSearch(
  query: string,
  provider: string,
  maxResults?: number,
  includeRaw?: boolean,
  siteFilter?: string,
  language?: string
): Promise<WebResearchResponse> {
  return api("/web-research/search", {
    method: "POST",
    body: JSON.stringify({ query, provider, maxResults, includeRaw, siteFilter, language }),
  });
}

export async function webSearchAll(
  query: string,
  maxResults?: number,
  includeRaw?: boolean
): Promise<WebResearchSearchAllResponse> {
  return api("/web-research/search-all", {
    method: "POST",
    body: JSON.stringify({ query, maxResults, includeRaw }),
  });
}
