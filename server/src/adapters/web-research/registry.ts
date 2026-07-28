import type { WebResearchProviderId, WebResearchQuery, WebResearchResponse } from "./adapter.js";
import { firecrawlSearch } from "./providers/firecrawl.js";
import { tavilySearch } from "./providers/tavily.js";
import { braveSearch } from "./providers/brave.js";
import { searxngSearch } from "./providers/searxng.js";
import { customCrawlerSearch } from "./providers/custom-crawler.js";

export interface WebResearchAdapter {
  search(query: WebResearchQuery): Promise<WebResearchResponse>;
  getProviders(): WebResearchProviderId[];
}

export function createWebResearchAdapter(): WebResearchAdapter {
  const providerMap: Record<WebResearchProviderId, (q: WebResearchQuery) => Promise<WebResearchResponse>> = {
    firecrawl: (q) => firecrawlSearch(q),
    tavily: (q) => tavilySearch(q),
    brave: (q) => braveSearch(q),
    searxng: (q) => searxngSearch(q),
    "custom-crawler": (q) => customCrawlerSearch(q),
  };

  return {
    async search(query: WebResearchQuery): Promise<WebResearchResponse> {
      const handler = providerMap[query.provider];
      if (!handler) {
        return {
          query: query.query,
          provider: query.provider,
          results: [],
          totalResults: 0,
          durationMs: 0,
          cached: false,
        };
      }
      return handler(query);
    },

    getProviders(): WebResearchProviderId[] {
      return Object.keys(providerMap) as WebResearchProviderId[];
    },
  };
}
