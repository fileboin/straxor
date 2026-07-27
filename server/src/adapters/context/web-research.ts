export interface WebResearchAdapter {
  // Fetch and extract text content from a URL
  fetchUrl(url: string): Promise<{ title: string; content: string; tokenCount: number }>;

  // Search the web for a query
  search(query: string, maxResults?: number): Promise<{ url: string; title: string; snippet: string }[]>;

  // Fetch multiple URLs in parallel
  fetchUrls(urls: string[]): Promise<{ url: string; title: string; content: string; tokenCount: number }[]>;
}

// Simple token estimator
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Extract readable text from HTML
function extractText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 10000);
}

// Extract title from HTML
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : "";
}

export function createWebResearchAdapter(): WebResearchAdapter {
  return {
    async fetchUrl(url) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(url, {
          headers: {
            "User-Agent": "Straxor/1.0 (Context Research)",
            "Accept": "text/html,application/xhtml+xml,text/plain",
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          return { title: url, content: "", tokenCount: 0 };
        }

        const html = await res.text();
        const title = extractTitle(html) || url;
        const content = extractText(html);
        const tokenCount = estimateTokens(content);

        return { title, content, tokenCount };
      } catch {
        return { title: url, content: "", tokenCount: 0 };
      }
    },

    async search(query, maxResults = 5) {
      // Use DuckDuckGo HTML search (no API key needed)
      try {
        const encoded = encodeURIComponent(query);
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
          headers: {
            "User-Agent": "Straxor/1.0 (Context Research)",
          },
        });

        const html = await res.text();

        // Extract results from DuckDuckGo HTML
        const results: { url: string; title: string; snippet: string }[] = [];
        const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

        let match;
        while ((match = resultRegex.exec(html)) && results.length < maxResults) {
          const rawUrl = match[1];
          const title = match[2].replace(/<[^>]+>/g, "").trim();
          const snippet = match[3].replace(/<[^>]+>/g, "").trim();

          // DuckDuckGo wraps URLs in redirects
          const urlMatch = rawUrl.match(/uddg=([^&]+)/);
          const url = urlMatch ? decodeURIComponent(urlMatch[1]) : rawUrl;

          if (url && title) {
            results.push({ url, title, snippet });
          }
        }

        return results;
      } catch {
        return [];
      }
    },

    async fetchUrls(urls) {
      const results = await Promise.allSettled(
        urls.map((url) => this.fetchUrl(url).then((r) => ({ ...r, url })))
      );

      return results
        .filter((r): r is PromiseFulfilledResult<{ url: string; title: string; content: string; tokenCount: number }> => r.status === "fulfilled")
        .map((r) => r.value);
    },
  };
}
