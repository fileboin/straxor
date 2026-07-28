import type { CacheEntry, CacheStats } from "./adapter.js";

function hashPrompt(prompt: string, model: string): string {
  let hash = 0;
  const str = `${model}:${prompt}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `h_${Math.abs(hash).toString(36)}`;
}

// Simple semantic similarity (keyword overlap)
function semanticSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

export interface CacheConfig {
  maxEntries: number;
  ttlMs: number; // time to live
  semanticThreshold: number; // similarity threshold for semantic cache hits (0-1)
  enabled: boolean;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxEntries: 1000,
  ttlMs: 3600000, // 1 hour
  semanticThreshold: 0.85,
  enabled: true,
};

export class CacheLayer {
  private entries: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private totalHits = 0;
  private totalMisses = 0;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get(prompt: string, model: string): CacheEntry | null {
    if (!this.config.enabled) return null;

    const hash = hashPrompt(prompt, model);
    const entry = this.entries.get(hash);

    if (entry) {
      // Check TTL
      if (Date.now() - new Date(entry.createdAt).getTime() > this.config.ttlMs) {
        this.entries.delete(hash);
        this.totalMisses++;
        return null;
      }

      entry.hitCount++;
      entry.lastHitAt = new Date().toISOString();
      this.totalHits++;
      return entry;
    }

    // Semantic search — find similar prompts
    for (const [, entry] of this.entries) {
      if (entry.model !== model) continue;
      const sim = semanticSimilarity(prompt, entry.prompt);
      if (sim >= this.config.semanticThreshold) {
        entry.hitCount++;
        entry.lastHitAt = new Date().toISOString();
        this.totalHits++;
        return entry;
      }
    }

    this.totalMisses++;
    return null;
  }

  set(prompt: string, model: string, response: string, provider: string, tokens: number): CacheEntry {
    const hash = hashPrompt(prompt, model);

    // Evict oldest if at capacity
    if (this.entries.size >= this.config.maxEntries) {
      let oldest: string | null = null;
      let oldestTime = Infinity;
      for (const [key, entry] of this.entries) {
        const t = new Date(entry.createdAt).getTime();
        if (t < oldestTime) {
          oldestTime = t;
          oldest = key;
        }
      }
      if (oldest) this.entries.delete(oldest);
    }

    const entry: CacheEntry = {
      id: `cache_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      promptHash: hash,
      prompt: prompt.slice(0, 500),
      response,
      model,
      provider,
      tokens,
      hitCount: 0,
      createdAt: new Date().toISOString(),
      lastHitAt: new Date().toISOString(),
    };

    this.entries.set(hash, entry);
    return entry;
  }

  getStats(): CacheStats {
    const entries = Array.from(this.entries.values());
    const totalHits = this.totalHits;
    const totalMisses = this.totalMisses;
    const totalRequests = totalHits + totalMisses;
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
    const savedTokens = entries.reduce((sum, e) => sum + e.tokens * e.hitCount, 0);

    // Rough cost estimate ($3/1M tokens average)
    const savedCostUSD = savedTokens * 3 / 1_000_000;

    // Memory estimate (rough)
    const bytes = entries.reduce((sum, e) => sum + e.prompt.length + e.response.length, 0);
    const memUsage = bytes > 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
      : `${(bytes / 1024).toFixed(1)} KB`;

    return {
      totalEntries: entries.length,
      totalHits,
      totalMisses,
      hitRate,
      savedTokens,
      savedCostUSD,
      memoryUsage: memUsage,
    };
  }

  clear(pattern?: string): number {
    if (!pattern) {
      const size = this.entries.size;
      this.entries.clear();
      this.totalHits = 0;
      this.totalMisses = 0;
      return size;
    }

    let cleared = 0;
    const regex = new RegExp(pattern, "i");
    for (const [key, entry] of this.entries) {
      if (regex.test(entry.prompt) || regex.test(entry.model) || regex.test(entry.provider)) {
        this.entries.delete(key);
        cleared++;
      }
    }
    return cleared;
  }

  getAll(): CacheEntry[] {
    return Array.from(this.entries.values()).sort(
      (a, b) => new Date(b.lastHitAt).getTime() - new Date(a.lastHitAt).getTime()
    );
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
