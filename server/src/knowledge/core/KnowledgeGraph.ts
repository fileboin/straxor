import type { KnowledgeStore } from "../storage/interfaces.js";
import type { KnowledgeGraphNode, KnowledgeGraphEdge } from "./types.js";
import { randomUUID } from "node:crypto";

export class KnowledgeGraphEngine {
  constructor(private store: KnowledgeStore) {}

  async listNodes(projectId: string): Promise<KnowledgeGraphNode[]> {
    return this.store.listNodes(projectId);
  }

  async addNode(projectId: string, label: string, type: string, properties: Record<string, unknown> = {}): Promise<KnowledgeGraphNode> {
    const now = Date.now();
    const node: KnowledgeGraphNode = {
      id: randomUUID(), projectId, label, type, properties, createdAt: now, updatedAt: now,
    };
    await this.store.saveNode(node);
    return node;
  }

  async updateNode(projectId: string, nodeId: string, updates: Partial<KnowledgeGraphNode>): Promise<KnowledgeGraphNode | null> {
    const node = await this.store.getNode(projectId, nodeId);
    if (!node) return null;
    const updated = { ...node, ...updates, updatedAt: Date.now() };
    await this.store.saveNode(updated);
    return updated;
  }

  async deleteNode(projectId: string, nodeId: string): Promise<void> {
    const edges = await this.store.getEdgesForNode(projectId, nodeId);
    for (const e of edges) await this.store.deleteEdge(projectId, e.id);
    await this.store.deleteNode(projectId, nodeId);
  }

  async listEdges(projectId: string): Promise<KnowledgeGraphEdge[]> {
    return this.store.listEdges(projectId);
  }

  async addEdge(projectId: string, sourceId: string, targetId: string, relation: string, properties: Record<string, unknown> = {}): Promise<KnowledgeGraphEdge | null> {
    const source = await this.store.getNode(projectId, sourceId);
    const target = await this.store.getNode(projectId, targetId);
    if (!source || !target) return null;
    const edge: KnowledgeGraphEdge = {
      id: randomUUID(), projectId, sourceId, targetId, relation, properties, createdAt: Date.now(),
    };
    await this.store.saveEdge(edge);
    return edge;
  }

  async deleteEdge(projectId: string, edgeId: string): Promise<void> {
    await this.store.deleteEdge(projectId, edgeId);
  }

  async getConnected(projectId: string, nodeId: string): Promise<{ node: KnowledgeGraphNode; edge: KnowledgeGraphEdge }[]> {
    const edges = await this.store.getEdgesForNode(projectId, nodeId);
    const results: { node: KnowledgeGraphNode; edge: KnowledgeGraphEdge }[] = [];
    for (const e of edges) {
      const otherId = e.sourceId === nodeId ? e.targetId : e.sourceId;
      const node = await this.store.getNode(projectId, otherId);
      if (node) results.push({ node, edge: e });
    }
    return results;
  }

  async findPath(projectId: string, fromId: string, toId: string): Promise<{ nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] } | null> {
    const visited = new Set<string>();
    const queue: string[][] = [[fromId]];
    const allEdges = await this.store.listEdges(projectId);
    const adjList = new Map<string, { nodeId: string; edgeId: string }[]>();
    for (const e of allEdges) {
      if (!adjList.has(e.sourceId)) adjList.set(e.sourceId, []);
      if (!adjList.has(e.targetId)) adjList.set(e.targetId, []);
      adjList.get(e.sourceId)!.push({ nodeId: e.targetId, edgeId: e.id });
      adjList.get(e.targetId)!.push({ nodeId: e.sourceId, edgeId: e.id });
    }
    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1];
      if (current === toId) {
        const nodes: KnowledgeGraphNode[] = [];
        const edges: KnowledgeGraphEdge[] = [];
        for (let i = 0; i < path.length; i++) {
          const node = await this.store.getNode(projectId, path[i]);
          if (node) nodes.push(node);
          if (i < path.length - 1) {
            const e = allEdges.find((edge) =>
              (edge.sourceId === path[i] && edge.targetId === path[i + 1]) ||
              (edge.sourceId === path[i + 1] && edge.targetId === path[i])
            );
            if (e) edges.push(e);
          }
        }
        return { nodes, edges };
      }
      if (visited.has(current)) continue;
      visited.add(current);
      const neighbors = adjList.get(current) ?? [];
      for (const { nodeId } of neighbors) {
        if (!visited.has(nodeId)) queue.push([...path, nodeId]);
      }
    }
    return null;
  }
}
