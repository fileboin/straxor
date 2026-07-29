import type { KnowledgeStore } from "../storage/interfaces.js";
import type { KnowledgeItem, DecisionRecord, DocSection, ContextBuildOptions, ContextResult } from "./types.js";

export class ContextBuilder {
  constructor(private store: KnowledgeStore) {}

  async buildContext(projectId: string, options: ContextBuildOptions = {}): Promise<ContextResult> {
    const maxTokens = options.maxTokens ?? 4000;
    const includeTypes = options.includeTypes;
    const includeDecisions = options.includeDecisions ?? true;
    const includeDocs = options.includeDocs ?? true;
    const focusTags = options.focusTags;
    const recencyWeight = options.recencyWeight ?? 1.0;

    const items = await this.store.listKnowledge(projectId);
    const decisions = includeDecisions ? await this.store.listDecisions(projectId) : [];
    const docs = includeDocs ? await this.store.listDocs(projectId) : [];

    let filtered = items;
    if (includeTypes) filtered = items.filter((i) => includeTypes.includes(i.type));
    if (focusTags && focusTags.length > 0) {
      filtered = filtered.filter((i) => focusTags.some((t) => i.tags.includes(t)));
    }

    const now = Date.now();
    const scored = filtered.map((item) => {
      const ageDays = (now - item.updatedAt) / 86400000;
      const recencyScore = Math.max(0, 1 - ageDays / 365) * recencyWeight;
      const confidenceScore = item.confidence / 5;
      return { item, score: recencyScore * 0.3 + confidenceScore * 0.7 };
    }).sort((a, b) => b.score - a.score);

    const sections: string[] = [];
    const sources: { type: string; key: string; summary: string }[] = [];
    let totalTokens = 0;

    const appendSection = (header: string, content: string, source: { type: string; key: string; summary: string }) => {
      const section = `\n## ${header}\n${content}\n`;
      const tokens = Math.ceil(section.length / 4);
      if (totalTokens + tokens > maxTokens) return;
      sections.push(section);
      totalTokens += tokens;
      sources.push(source);
    };

    // Project info
    const project = await this.store.getProject(projectId);
    if (project) {
      appendSection("Project Overview",
        `Name: ${project.name}\nDescription: ${project.description}\nArchitecture: ${project.architecture}\nFrameworks: ${project.frameworks.join(", ")}\nLanguages: ${project.languages.join(", ")}`,
        { type: "project", key: projectId, summary: project.name }
      );
    }

    // Knowledge items
    for (const { item } of scored) {
      appendSection(`${item.type}: ${item.key}`,
        `${item.summary}\n${typeof item.value === "string" ? item.value : JSON.stringify(item.value, null, 2)}`,
        { type: "knowledge", key: item.key, summary: item.summary }
      );
    }

    // Decisions (most recent first)
    const sortedDecisions = decisions.sort((a, b) => b.updatedAt - a.updatedAt);
    for (const d of sortedDecisions) {
      appendSection(`Decision: ${d.title}`,
        `Context: ${d.context}\nDecision: ${d.decision}\nReason: ${d.reason}\nAlternatives: ${d.alternatives.join(", ")}\nStatus: ${d.status}`,
        { type: "decision", key: d.id, summary: d.title }
      );
    }

    // Documentation
    for (const doc of docs) {
      appendSection(`Doc: ${doc.title}`,
        doc.content.substring(0, 500),
        { type: "documentation", key: doc.id, summary: doc.title }
      );
    }

    return {
      context: sections.join("\n").trim(),
      tokens: totalTokens,
      sources,
    };
  }

  async buildMinimalContext(projectId: string, query: string, maxTokens: number = 2000): Promise<ContextResult> {
    const allItems = await this.store.listKnowledge(projectId);
    const decisions = await this.store.listDecisions(projectId);
    const docs = await this.store.listDocs(projectId);

    const searchText = (obj: Record<string, unknown>): string =>
      Object.values(obj).filter((v) => typeof v === "string").join(" ").toLowerCase();
    const q = query.toLowerCase();

    const relevantItems = allItems.filter(
      (i) => i.key.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q) || i.tags.some((t) => t.toLowerCase().includes(q))
    );
    const relevantDecisions = decisions.filter(
      (d) => d.title.toLowerCase().includes(q) || d.decision.toLowerCase().includes(q) || d.reason.toLowerCase().includes(q)
    );
    const relevantDocs = docs.filter(
      (d) => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q)
    );

    return this.buildContext(projectId, {
      maxTokens,
      includeDecisions: true,
      includeDocs: true,
    });
  }
}
