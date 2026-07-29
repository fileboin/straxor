import type { KnowledgeStore } from "./interfaces.js";
import type {
  KnowledgeItem, KnowledgeGraphNode, KnowledgeGraphEdge,
  DecisionRecord, DocSection, ProjectInfo, VersionSnapshot, KnowledgeEvent,
} from "../core/types.js";

type Listener = (event: KnowledgeEvent) => void;

export class MemoryStore implements KnowledgeStore {
  private projects = new Map<string, ProjectInfo>();
  private knowledge = new Map<string, Map<string, KnowledgeItem>>();
  private nodes = new Map<string, Map<string, KnowledgeGraphNode>>();
  private edges = new Map<string, Map<string, KnowledgeGraphEdge>>();
  private decisions = new Map<string, Map<string, DecisionRecord>>();
  private docs = new Map<string, Map<string, DocSection>>();
  private versions = new Map<string, Map<string, VersionSnapshot>>();
  private listeners = new Set<Listener>();

  private mapFor(projectId: string, map: Map<string, Map<string, unknown>>): Map<string, unknown> {
    if (!map.has(projectId)) map.set(projectId, new Map());
    return map.get(projectId)! as Map<string, unknown>;
  }

  async init(_projectId: string): Promise<void> {}
  async destroy(projectId: string): Promise<void> {
    this.projects.delete(projectId);
    this.knowledge.delete(projectId);
    this.nodes.delete(projectId);
    this.edges.delete(projectId);
    this.decisions.delete(projectId);
    this.docs.delete(projectId);
    this.versions.delete(projectId);
  }

  async getProject(projectId: string): Promise<ProjectInfo | null> { return this.projects.get(projectId) ?? null; }
  async saveProject(info: ProjectInfo): Promise<void> { this.projects.set(info.id, info); }

  async getKnowledge(projectId: string, key: string): Promise<KnowledgeItem | null> {
    return this.knowledge.get(projectId)?.get(key) ?? null;
  }
  async listKnowledge(projectId: string, type?: string): Promise<KnowledgeItem[]> {
    const items = Array.from(this.knowledge.get(projectId)?.values() ?? []);
    return type ? items.filter((i) => i.type === type) : items;
  }
  async saveKnowledge(item: KnowledgeItem): Promise<void> {
    if (!this.knowledge.has(item.projectId)) this.knowledge.set(item.projectId, new Map());
    this.knowledge.get(item.projectId)!.set(item.key, item);
  }
  async deleteKnowledge(projectId: string, key: string): Promise<void> {
    this.knowledge.get(projectId)?.delete(key);
  }
  async searchKnowledge(projectId: string, query: string): Promise<KnowledgeItem[]> {
    const q = query.toLowerCase();
    return Array.from(this.knowledge.get(projectId)?.values() ?? []).filter(
      (i) => i.key.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q) || JSON.stringify(i.value).toLowerCase().includes(q)
    );
  }

  async getNode(projectId: string, nodeId: string): Promise<KnowledgeGraphNode | null> {
    return this.nodes.get(projectId)?.get(nodeId) ?? null;
  }
  async listNodes(projectId: string): Promise<KnowledgeGraphNode[]> {
    return Array.from(this.nodes.get(projectId)?.values() ?? []);
  }
  async saveNode(node: KnowledgeGraphNode): Promise<void> {
    if (!this.nodes.has(node.projectId)) this.nodes.set(node.projectId, new Map());
    this.nodes.get(node.projectId)!.set(node.id, node);
  }
  async deleteNode(projectId: string, nodeId: string): Promise<void> {
    this.nodes.get(projectId)?.delete(nodeId);
  }
  async listEdges(projectId: string): Promise<KnowledgeGraphEdge[]> {
    return Array.from(this.edges.get(projectId)?.values() ?? []);
  }
  async saveEdge(edge: KnowledgeGraphEdge): Promise<void> {
    if (!this.edges.has(edge.projectId)) this.edges.set(edge.projectId, new Map());
    this.edges.get(edge.projectId)!.set(edge.id, edge);
  }
  async deleteEdge(projectId: string, edgeId: string): Promise<void> {
    this.edges.get(projectId)?.delete(edgeId);
  }
  async getEdgesForNode(projectId: string, nodeId: string): Promise<KnowledgeGraphEdge[]> {
    return Array.from(this.edges.get(projectId)?.values() ?? []).filter(
      (e) => e.sourceId === nodeId || e.targetId === nodeId
    );
  }

  async getDecision(projectId: string, id: string): Promise<DecisionRecord | null> {
    return this.decisions.get(projectId)?.get(id) ?? null;
  }
  async listDecisions(projectId: string): Promise<DecisionRecord[]> {
    return Array.from(this.decisions.get(projectId)?.values() ?? []);
  }
  async saveDecision(decision: DecisionRecord): Promise<void> {
    if (!this.decisions.has(decision.projectId)) this.decisions.set(decision.projectId, new Map());
    this.decisions.get(decision.projectId)!.set(decision.id, decision);
  }
  async deleteDecision(projectId: string, id: string): Promise<void> {
    this.decisions.get(projectId)?.delete(id);
  }

  async getDoc(projectId: string, id: string): Promise<DocSection | null> {
    return this.docs.get(projectId)?.get(id) ?? null;
  }
  async listDocs(projectId: string, category?: string): Promise<DocSection[]> {
    const items = Array.from(this.docs.get(projectId)?.values() ?? []);
    return category ? items.filter((d) => d.category === category) : items;
  }
  async saveDoc(doc: DocSection): Promise<void> {
    if (!this.docs.has(doc.projectId)) this.docs.set(doc.projectId, new Map());
    this.docs.get(doc.projectId)!.set(doc.id, doc);
  }
  async deleteDoc(projectId: string, id: string): Promise<void> {
    this.docs.get(projectId)?.delete(id);
  }

  async getVersion(projectId: string, id: string): Promise<VersionSnapshot | null> {
    return this.versions.get(projectId)?.get(id) ?? null;
  }
  async listVersions(projectId: string): Promise<VersionSnapshot[]> {
    return Array.from(this.versions.get(projectId)?.values() ?? []);
  }
  async saveVersion(snapshot: VersionSnapshot): Promise<void> {
    if (!this.versions.has(snapshot.projectId)) this.versions.set(snapshot.projectId, new Map());
    this.versions.get(snapshot.projectId)!.set(snapshot.id, snapshot);
  }

  subscribe(handler: (event: KnowledgeEvent) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  publishEvent(event: KnowledgeEvent): void {
    for (const listener of this.listeners) {
      try { listener(event); } catch { /* ignore */ }
    }
  }

  async flush(): Promise<void> {}
}
