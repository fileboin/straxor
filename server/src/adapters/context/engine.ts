import type { ContextEngine, ContextSource, AssembledContext } from "./adapter.js";

// Simple token estimator (~4 chars per token for English/code)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Extract keywords from prompt
function extractKeywords(prompt: string): string[] {
  const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "can", "shall", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into", "through", "during", "before", "after", "above", "below", "between", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", "all", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "just", "don", "now", "i", "me", "my", "we", "our", "you", "your", "he", "him", "his", "she", "her", "it", "its", "they", "them", "their", "what", "which", "who", "whom", "this", "that", "these", "those", "am", "if", "or", "because", "until", "while", "about", "against", "and", "but", "nor", "up", "down", "out", "off", "over", "under", "again", "further", "also", "any"]);

  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w))
    .slice(0, 20);
}

// Score file relevance based on keyword overlap
function scoreFile(path: string, content: string, keywords: string[]): number {
  const pathLower = path.toLowerCase();
  const contentLower = content.toLowerCase();
  let score = 0;

  for (const kw of keywords) {
    // Path match = high score
    if (pathLower.includes(kw)) score += 3;
    // Content match = medium score
    const contentMatches = (contentLower.match(new RegExp(`\\b${kw}\\b`, "g")) || []).length;
    score += Math.min(contentMatches, 5);
  }

  // Bonus for common source files
  if (/\.(ts|tsx|js|jsx|py|go|rs)$/.test(path)) score += 1;
  if (/package\.json|tsconfig|\.env|README/i.test(path)) score += 2;

  return score;
}

export function createContextEngine(): ContextEngine {
  return {
    async assemble(params): Promise<AssembledContext> {
      const {
        prompt,
        rules,
        memories,
        relevantFiles = [],
        webResults = [],
        searchResults = [],
        systemPrompt = "",
        maxTokens = 8000,
      } = params;

      const sources: ContextSource[] = [];

      // 1. System prompt (highest priority)
      if (systemPrompt) {
        sources.push({
          type: "system",
          label: "System Prompt",
          content: systemPrompt,
          tokenCount: estimateTokens(systemPrompt),
          priority: 100,
        });
      }

      // 2. Project rules (high priority)
      for (const rule of rules) {
        const content = `[Pravilo: ${rule.name}] ${rule.content}`;
        sources.push({
          type: "rules",
          label: `Pravilo: ${rule.name}`,
          content,
          tokenCount: estimateTokens(content),
          priority: 90,
        });
      }

      // 3. Memories (medium-high priority)
      for (const mem of memories) {
        const content = `[Sjećanje: ${mem.key}] ${mem.content}`;
        sources.push({
          type: "memory",
          label: `Sjećanje: ${mem.key}`,
          content,
          tokenCount: estimateTokens(content),
          priority: 80,
        });
      }

      // 4. Search results (medium priority)
      for (const sr of searchResults.slice(0, 5)) {
        sources.push({
          type: "search",
          label: `Rezultat: ${sr.path}`,
          content: `// ${sr.path}\n${sr.content.slice(0, 2000)}`,
          tokenCount: estimateTokens(sr.content.slice(0, 2000)),
          priority: 70 + sr.score,
        });
      }

      // 5. Relevant files (medium priority)
      for (const file of relevantFiles.slice(0, 10)) {
        const truncated = file.content.slice(0, 3000);
        sources.push({
          type: "files",
          label: `Datoteka: ${file.path}`,
          content: `// ${file.path}\n${truncated}`,
          tokenCount: estimateTokens(truncated),
          priority: 60,
        });
      }

      // 6. Web research (lower priority)
      for (const web of webResults.slice(0, 3)) {
        const truncated = web.content.slice(0, 2000);
        sources.push({
          type: "web",
          label: `Web: ${web.title || web.url}`,
          content: `[Izvor: ${web.url}]\n${truncated}`,
          tokenCount: estimateTokens(truncated),
          priority: 50,
        });
      }

      // Sort by priority (highest first)
      sources.sort((a, b) => b.priority - a.priority);

      // Truncate to fit within token limit
      let totalTokens = 0;
      let truncated = false;
      const included: ContextSource[] = [];

      for (const source of sources) {
        if (totalTokens + source.tokenCount <= maxTokens) {
          included.push(source);
          totalTokens += source.tokenCount;
        } else {
          truncated = true;
          break;
        }
      }

      // Build system prompt from assembled context
      const contextParts = included.map((s) => `--- ${s.label} ---\n${s.content}`);
      const assembledPrompt = contextParts.join("\n\n");

      // Summary
      const summary = `${included.length} izvora konteksta · ${estimateTokens(assembledPrompt)} tokena${truncated ? ` · Truncirano (${sources.length - included.length} izvora preskočeno)` : ""}`;

      return {
        sources: included,
        totalTokens: estimateTokens(assembledPrompt),
        truncated,
        systemPrompt: assembledPrompt,
        summary,
      };
    },

    countTokens(text: string): number {
      return estimateTokens(text);
    },

    async summarize(text: string, maxTokens: number): Promise<string> {
      const currentTokens = estimateTokens(text);
      if (currentTokens <= maxTokens) return text;

      // Simple truncation with ellipsis
      const charsPerToken = 4;
      const maxChars = maxTokens * charsPerToken;
      return text.slice(0, maxChars) + "\n\n[... sažeto — originalni sadržaj skraćen na " + maxTokens + " tokena]";
    },

    findRelevantFiles(prompt, files, maxFiles = 10) {
      const keywords = extractKeywords(prompt);
      if (keywords.length === 0 || files.length === 0) return [];

      return files
        .map((f) => ({
          ...f,
          score: scoreFile(f.path, f.content, keywords),
        }))
        .filter((f) => f.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxFiles);
    },
  };
}
