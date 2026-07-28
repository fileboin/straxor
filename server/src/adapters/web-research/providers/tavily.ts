import type { WebResearchQuery, WebResearchResponse, TavilyOptions } from "../adapter.js";

export async function tavilySearch(
  query: WebResearchQuery,
  opts?: TavilyOptions
): Promise<WebResearchResponse> {
  const start = Date.now();
  const apiKey = opts?.apiKey || process.env.TAVILY_API_KEY;
  const baseUrl = opts?.baseUrl || process.env.TAVILY_URL || "https://api.tavily.com";

  if (!apiKey) {
    return {
      query: query.query,
      provider: "tavily",
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query.query,
        max_results: query.maxResults || 10,
        include_answer: false,
        include_raw_content: query.includeRaw,
      }),
    });
    const data: any = await resp.json();
    const results = (data.results || []).map((r: any, i: number) => ({
      id: `tv_${Date.now()}_${i}`,
      title: r.title || "",
      url: r.url || "",
      snippet: r.content || r.snippet || "",
      content: r.content || "",
      rawContent: r.raw_content || "",
      score: r.score ?? 1 - i * 0.01,
      source: "tavily" as const,
      publishedDate: r.published_date,
    }));

    return {
      query: query.query,
      provider: "tavily",
      results,
      totalResults: results.length,
      durationMs: Date.now() - start,
      cached: false,
    };
  } catch {
    return {
      query: query.query,
      provider: "tavily",
      results: [],
      totalResults: 0,
      durationMs: Date.now() - start,
      cached: false,
    };
  }
}
