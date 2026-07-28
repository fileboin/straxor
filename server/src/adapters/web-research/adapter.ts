// ── Web Research Types ──

export type WebResearchProviderId = "firecrawl" | "tavily" | "brave" | "searxng" | "custom-crawler";

export const WEB_RESEARCH_PROVIDER_LABELS: Record<WebResearchProviderId, string> = {
  firecrawl: "Firecrawl",
  tavily: "Tavily",
  brave: "Brave Search",
  searxng: "SearXNG",
  "custom-crawler": "Custom Crawler",
};

export interface WebResearchQuery {
  query: string;
  provider: WebResearchProviderId;
  maxResults?: number;
  maxDepth?: number;
  includeRaw?: boolean;
  siteFilter?: string;
  dateFilter?: string;
  language?: string;
}

export interface WebResearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  content?: string;
  rawContent?: string;
  score: number;
  source: WebResearchProviderId;
  publishedDate?: string;
  metadata?: Record<string, string>;
}

export interface WebResearchResponse {
  query: string;
  provider: WebResearchProviderId;
  results: WebResearchResult[];
  totalResults: number;
  durationMs: number;
  cached: boolean;
}

export interface FirecrawlOptions {
  apiKey?: string;
  baseUrl?: string;
}

export interface TavilyOptions {
  apiKey?: string;
  baseUrl?: string;
}

export interface BraveOptions {
  apiKey?: string;
  baseUrl?: string;
}

export interface SearXGNOptions {
  baseUrl?: string;
}

export interface CustomCrawlerOptions {
  baseUrl?: string;
  userAgent?: string;
  rateLimitMs?: number;
}
