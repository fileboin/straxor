import * as fs from "node:fs";
import * as path from "node:path";
import { MemoryStore } from "./MemoryStore.js";
import type { KnowledgeEvent } from "../core/types.js";

export class FileStore extends MemoryStore {
  private basePath: string;
  private dirty = new Set<string>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(basePath: string) {
    super();
    this.basePath = basePath;
    this.flushTimer = setInterval(() => this.flush(), 30000);
    if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });
  }

  private projectDir(projectId: string): string {
    return path.join(this.basePath, projectId);
  }

  private filePath(projectId: string, name: string): string {
    return path.join(this.projectDir(projectId), `${name}.json`);
  }

  private async loadJson<T>(projectId: string, name: string): Promise<T | null> {
    try {
      const data = fs.readFileSync(this.filePath(projectId, name), "utf-8");
      return JSON.parse(data) as T;
    } catch { return null; }
  }

  private async saveJson(projectId: string, name: string, data: unknown): Promise<void> {
    const dir = this.projectDir(projectId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath(projectId, name), JSON.stringify(data, null, 2));
  }

  async init(projectId: string): Promise<void> {
    const dir = this.projectDir(projectId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const project = await this.loadJson<import("../core/types.js").ProjectInfo>(projectId, "project");
    if (project) await super.saveProject(project);
    const knowledge = await this.loadJson<import("../core/types.js").KnowledgeItem[]>(projectId, "knowledge") ?? [];
    for (const item of knowledge) await super.saveKnowledge(item);
    const nodes = await this.loadJson<import("../core/types.js").KnowledgeGraphNode[]>(projectId, "nodes") ?? [];
    for (const n of nodes) await super.saveNode(n);
    const edges = await this.loadJson<import("../core/types.js").KnowledgeGraphEdge[]>(projectId, "edges") ?? [];
    for (const e of edges) await super.saveEdge(e);
    const decisions = await this.loadJson<import("../core/types.js").DecisionRecord[]>(projectId, "decisions") ?? [];
    for (const d of decisions) await super.saveDecision(d);
    const docs = await this.loadJson<import("../core/types.js").DocSection[]>(projectId, "docs") ?? [];
    for (const d of docs) await super.saveDoc(d);
    const versions = await this.loadJson<import("../core/types.js").VersionSnapshot[]>(projectId, "versions") ?? [];
    for (const v of versions) await super.saveVersion(v);
  }

  async saveProject(info: import("../core/types.js").ProjectInfo): Promise<void> {
    await super.saveProject(info);
    this.dirty.add(info.id);
  }

  async saveKnowledge(item: import("../core/types.js").KnowledgeItem): Promise<void> {
    await super.saveKnowledge(item);
    this.dirty.add(item.projectId);
  }

  async deleteKnowledge(projectId: string, key: string): Promise<void> {
    await super.deleteKnowledge(projectId, key);
    this.dirty.add(projectId);
  }

  async saveNode(node: import("../core/types.js").KnowledgeGraphNode): Promise<void> {
    await super.saveNode(node);
    this.dirty.add(node.projectId);
  }

  async deleteNode(projectId: string, nodeId: string): Promise<void> {
    await super.deleteNode(projectId, nodeId);
    this.dirty.add(projectId);
  }

  async saveEdge(edge: import("../core/types.js").KnowledgeGraphEdge): Promise<void> {
    await super.saveEdge(edge);
    this.dirty.add(edge.projectId);
  }

  async deleteEdge(projectId: string, edgeId: string): Promise<void> {
    await super.deleteEdge(projectId, edgeId);
    this.dirty.add(projectId);
  }

  async saveDecision(decision: import("../core/types.js").DecisionRecord): Promise<void> {
    await super.saveDecision(decision);
    this.dirty.add(decision.projectId);
  }

  async deleteDecision(projectId: string, id: string): Promise<void> {
    await super.deleteDecision(projectId, id);
    this.dirty.add(projectId);
  }

  async saveDoc(doc: import("../core/types.js").DocSection): Promise<void> {
    await super.saveDoc(doc);
    this.dirty.add(doc.projectId);
  }

  async deleteDoc(projectId: string, id: string): Promise<void> {
    await super.deleteDoc(projectId, id);
    this.dirty.add(projectId);
  }

  async saveVersion(snapshot: import("../core/types.js").VersionSnapshot): Promise<void> {
    await super.saveVersion(snapshot);
    this.dirty.add(snapshot.projectId);
  }

  async flush(): Promise<void> {
    for (const projectId of this.dirty) {
      try {
        const knowledge = await this.listKnowledge(projectId);
        await this.saveJson(projectId, "knowledge", knowledge);
        const nodes = await this.listNodes(projectId);
        await this.saveJson(projectId, "nodes", nodes);
        const edges = await this.listEdges(projectId);
        await this.saveJson(projectId, "edges", edges);
        const decisions = await this.listDecisions(projectId);
        await this.saveJson(projectId, "decisions", decisions);
        const docs = await this.listDocs(projectId);
        await this.saveJson(projectId, "docs", docs);
        const versions = await this.listVersions(projectId);
        await this.saveJson(projectId, "versions", versions);
        const project = await this.getProject(projectId);
        if (project) await this.saveJson(projectId, "project", project);
      } catch { /* ignore */ }
    }
    this.dirty.clear();
  }

  destroy(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flush();
  }
}
