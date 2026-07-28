import type { WebResearchQuery, WebResearchResponse, BraveOptions } from "../adapter.js";

export async function braveSearch(
  query: WebResearchQuery,
  opts?: BraveOptions
): Promise<WebResearchResponse> {
  const start = Date.now();
  const apiKey = opts?.apiKey || process.env.BRAVE_API_KEY;
  const baseUrl = opts?.baseUrl || "https://api.search.brave.com/res/v1";

  if (!apiKey) {
    return {
      query: query.query,
      provider: "brave",
      results: [],
      totalResults: 0,
      durationMs: Date.now() - start,
      cached: false,
    };
  }

  try {
    const params = new URLSearchParams({
      q: query.query,
      count: String(query.maxResults || 10),
    });
    if (query.language) params.set("lang", query.language);
    if (query.siteFilter) params.set("safesearch", "strict");

    const resp = await fetch(`${baseUrl}/web/search?${params}`, {
      headers: {
        "X-Subscription-Token": apiKey,
        Accept: "application/json",
      },
    });
    const data: any = await resp.json();
    const results = (data.web?.results || []).map((r: any, i: number) => ({
      id: `br_${Date.now()}_${i}`,
      title: r.title || "",
      url: r.url || "",
      snippet: r.description || "",
      content: r.description || "",
      score: 1 - i * 0.01,
      source: "brave" as const,
      publishedDate: r.age || r.meta_date,
      metadata: { language: r.lang, familyFriendly: String(r.family_friendly) },
    }));

    return {
      query: query.query,
      provider: "brave",
      results,
      totalResults: results.length,
      durationMs: Date.now() - start,
      cached: false,
    };
  } catch {
    return {
      query: query.query,
      provider: "brave",
      results: [],
      totalResults: 0,
      durationMs: Date.now() - start,
      cached: false,
    };
  }
}

export async function braveSuggest(
  query: string,
  opts?: BraveOptions
): Promise<string[]> {
  const apiKey = opts?.apiKey || process.env.BRAVE_API_KEY;
  if (!apiKey) return [];

  try {
    const resp = await fetch(
      `https://api.search.brave.com/res/v1/suggest?q=${encodeURIComponent(query)}`,
      { headers: { "X-Subscription-Token": apiKey, Accept: "application/json" } }
    );
    const data: any = await resp.json();
    return data?.results?.map((r: any) => r.phrase) || [];
  } catch {
    return [];
  }
}
