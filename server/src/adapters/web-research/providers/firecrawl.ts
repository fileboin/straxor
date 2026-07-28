import type { WebResearchQuery, WebResearchResponse, FirecrawlOptions } from "../adapter.js";

export async function firecrawlSearch(
  query: WebResearchQuery,
  opts?: FirecrawlOptions
): Promise<WebResearchResponse> {
  const start = Date.now();
  const apiKey = opts?.apiKey || process.env.FIRECRAWL_API_KEY;
  const baseUrl = opts?.baseUrl || process.env.FIRECRAWL_URL || "https://api.firecrawl.dev/v1";

  if (!apiKey) {
    return {
      query: query.query,
      provider: "firecrawl",
      results: [],
      totalResults: 0,
      durationMs: Date.now() - start,
      cached: false,
    };
  }

  try {
    const resp = await fetch(`${baseUrl}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: query.query,
        maxResults: query.maxResults || 10,
        scrapeOptions: { formats: query.includeRaw ? ["markdown", "rawHtml"] : ["markdown"] },
      }),
    });
    const data: any = await resp.json();
    const results = (data.data || []).map((r: any, i: number) => ({
      id: `fc_${Date.now()}_${i}`,
      title: r.title || r.metadata?.title || "",
      url: r.url || "",
      snippet: r.description || r.metadata?.description || "",
      content: r.markdown || "",
      rawContent: r.rawHtml || r.raw || "",
      score: 1 - i * 0.01,
      source: "firecrawl" as const,
      publishedDate: r.metadata?.publishedDate,
      metadata: r.metadata,
    }));

    return {
      query: query.query,
      provider: "firecrawl",
      results,
      totalResults: results.length,
      durationMs: Date.now() - start,
      cached: false,
    };
  } catch {
    return {
      query: query.query,
      provider: "firecrawl",
      results: [],
      totalResults: 0,
      durationMs: Date.now() - start,
      cached: false,
    };
  }
}
