import type { WebResearchQuery, WebResearchResponse, CustomCrawlerOptions } from "../adapter.js";

export async function customCrawlerSearch(
  query: WebResearchQuery,
  opts?: CustomCrawlerOptions
): Promise<WebResearchResponse> {
  const start = Date.now();
  const userAgent = opts?.userAgent || "STRAXOR-Crawler/1.0";
  const rateLimit = opts?.rateLimitMs || 500;

  const urls = extractUrls(query.query);
  if (urls.length === 0) {
    // Treat as a search query — do a basic web fetch
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query.query)}`;
    try {
      const resp = await fetch(searchUrl, {
        headers: { "User-Agent": userAgent },
      });
      const html = await resp.text();
      const results = parseDuckDuckGoResults(html);
      return {
        query: query.query,
        provider: "custom-crawler",
        results: results.slice(0, query.maxResults || 10),
        totalResults: results.length,
        durationMs: Date.now() - start,
        cached: false,
      };
    } catch {
      return {
        query: query.query,
        provider: "custom-crawler",
        results: [],
        totalResults: 0,
        durationMs: Date.now() - start,
        cached: false,
      };
    }
  }

  // Crawl specific URLs
  const results = [];
  for (let i = 0; i < Math.min(urls.length, query.maxResults || 5); i++) {
    try {
      await new Promise((r) => setTimeout(r, rateLimit));
      const resp = await fetch(urls[i], {
        headers: { "User-Agent": userAgent },
      });
      const html = await resp.text();
      const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] || urls[i];
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2000);

      results.push({
        id: `cc_${Date.now()}_${i}`,
        title,
        url: urls[i],
        snippet: text.slice(0, 300),
        content: text,
        rawContent: html.slice(0, 10000),
        score: 1 - i * 0.01,
        source: "custom-crawler" as const,
      });
    } catch {
      // Skip failed URLs
    }

    await new Promise((r) => setTimeout(r, rateLimit));
  }

  return {
    query: query.query,
    provider: "custom-crawler",
    results,
    totalResults: results.length,
    durationMs: Date.now() - start,
    cached: false,
  };
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s,;)]+/g;
  return [...new Set(text.match(urlRegex) || [])];
}

function parseDuckDuckGoResults(html: string): Array<{
  id: string; title: string; url: string; snippet: string; content: string; score: number; source: "custom-crawler";
}> {
  const results: Array<{
    id: string; title: string; url: string; snippet: string; content: string; score: number; source: "custom-crawler";
  }> = [];
  const resultRegex = /<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__url"[^>]*href="([^"]*)"[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  let i = 0;
  while ((match = resultRegex.exec(html)) !== null && i < 10) {
    results.push({
      id: `cc_${Date.now()}_${i}`,
      title: match[1].replace(/<[^>]+>/g, "").trim(),
      url: match[2],
      snippet: match[3].replace(/<[^>]+>/g, "").trim(),
      content: match[3].replace(/<[^>]+>/g, "").trim(),
      score: 1 - i * 0.01,
      source: "custom-crawler",
    });
    i++;
  }
  return results;
}
