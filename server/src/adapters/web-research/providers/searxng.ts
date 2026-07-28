import type { WebResearchQuery, WebResearchResponse, SearXGNOptions } from "../adapter.js";

export async function searxngSearch(
  query: WebResearchQuery,
  opts?: SearXGNOptions
): Promise<WebResearchResponse> {
  const start = Date.now();
  const baseUrl = opts?.baseUrl || process.env.SEARXNG_URL || "http://localhost:8888";

  try {
    const params = new URLSearchParams({
      q: query.query,
      format: "json",
      language: query.language || "en",
      categories: query.siteFilter || "general",
      pageno: "1",
    });

    const resp = await fetch(`${baseUrl}/search?${params}`, {
      headers: { Accept: "application/json" },
    });
    const data: any = await resp.json();
    const results = (data.results || []).map((r: any, i: number) => ({
      id: `sx_${Date.now()}_${i}`,
      title: r.title || "",
      url: r.url || "",
      snippet: r.content || r.snippet || "",
      content: r.content || "",
      score: 1 - i * 0.01,
      source: "searxng" as const,
      publishedDate: r.publishedDate,
      metadata: { engine: r.engine, category: r.category },
    }));

    return {
      query: query.query,
      provider: "searxng",
      results,
      totalResults: results.length,
      durationMs: Date.now() - start,
      cached: false,
    };
  } catch {
    return {
      query: query.query,
      provider: "searxng",
      results: [],
      totalResults: 0,
      durationMs: Date.now() - start,
      cached: false,
    };
  }
}
