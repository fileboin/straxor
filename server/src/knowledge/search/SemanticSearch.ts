import type { KnowledgeItem, DecisionRecord, DocSection, SearchResult } from "../core/types.js";

interface TokenScore {
  token: string;
  score: number;
}

export class SemanticSearch {
  private stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all", "each",
    "every", "both", "few", "more", "most", "other", "some", "such", "no",
    "nor", "not", "only", "own", "same", "so", "than", "too", "very",
    "just", "because", "but", "and", "or", "if", "while", "that", "this",
    "it", "its", "what", "which", "who", "whom",
  ]);

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !this.stopWords.has(t));
  }

  private termFrequency(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    const max = Math.max(...tf.values(), 1);
    for (const [k, v] of tf) tf.set(k, v / max);
    return tf;
  }

  private inverseDocFrequency(terms: string[], allDocs: Set<string>[]): Map<string, number> {
    const idf = new Map<string, number>();
    const n = allDocs.length;
    for (const term of terms) {
      let count = 0;
      for (const doc of allDocs) { if (doc.has(term)) count++; }
      idf.set(term, Math.log((n + 1) / (count + 1)) + 1);
    }
    return idf;
  }

  private cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0, na = 0, nb = 0;
    for (const [k, v] of a) { dot += v * (b.get(k) ?? 0); na += v * v; }
    for (const v of b.values()) nb += v * v;
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  private extractText(item: KnowledgeItem | DecisionRecord | DocSection, type: string): string {
    let text = "";
    if (type === "knowledge") {
      const k = item as KnowledgeItem;
      text = `${k.key} ${k.summary} ${JSON.stringify(k.value)} ${k.tags.join(" ")}`;
    } else if (type === "decision") {
      const d = item as DecisionRecord;
      text = `${d.title} ${d.context} ${d.decision} ${d.reason} ${d.alternatives.join(" ")} ${d.tags.join(" ")}`;
    } else if (type === "documentation") {
      const doc = item as DocSection;
      text = `${doc.title} ${doc.content}`;
    }
    return text;
  }

  search(
    query: string,
    knowledge: KnowledgeItem[],
    decisions: DecisionRecord[],
    docs: DocSection[]
  ): SearchResult[] {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const queryTf = this.termFrequency(queryTokens);
    const allItems: { item: KnowledgeItem | DecisionRecord | DocSection; type: string; text: string }[] = [];
    const allTermSets: Set<string>[] = [];

    for (const k of knowledge) {
      const text = this.extractText(k, "knowledge");
      allItems.push({ item: k, type: "knowledge", text });
      allTermSets.push(new Set(this.tokenize(text)));
    }
    for (const d of decisions) {
      const text = this.extractText(d, "decision");
      allItems.push({ item: d, type: "decision", text });
      allTermSets.push(new Set(this.tokenize(text)));
    }
    for (const d of docs) {
      const text = this.extractText(d, "documentation");
      allItems.push({ item: d, type: "documentation", text });
      allTermSets.push(new Set(this.tokenize(text)));
    }

    const idf = this.inverseDocFrequency(queryTokens, allTermSets);

    const results: SearchResult[] = [];

    for (let i = 0; i < allItems.length; i++) {
      const { item, type, text } = allItems[i];
      const tokens = this.tokenize(text);
      const docTf = this.termFrequency(tokens);

      // Compute TF-IDF weighted vector
      const queryVec = new Map<string, number>();
      for (const [token, tf] of queryTf) {
        queryVec.set(token, tf * (idf.get(token) ?? 1));
      }
      const docVec = new Map<string, number>();
      for (const [token, tf] of docTf) {
        docVec.set(token, tf * (idf.get(token) ?? 1));
      }

      const score = this.cosineSimilarity(queryVec, docVec);
      if (score > 0) {
        const matches = queryTokens.filter((t) => text.toLowerCase().includes(t));
        results.push({ item, type, score, matches });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 20);
  }
}
