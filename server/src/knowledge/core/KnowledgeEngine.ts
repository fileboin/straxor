import type { KnowledgeStore } from "../storage/interfaces.js";
import { PluginManager } from "../plugins/PluginManager.js";
import { SemanticSearch } from "../search/SemanticSearch.js";
import { ProjectMemory } from "./ProjectMemory.js";
import { KnowledgeGraphEngine } from "./KnowledgeGraph.js";
import { DecisionMemory } from "./DecisionMemory.js";
import { DocumentationEngine } from "./DocumentationEngine.js";
import { VersionKnowledge } from "./VersionKnowledge.js";
import { ContextBuilder } from "./ContextBuilder.js";
import { LearningEngine } from "./LearningEngine.js";
import type {
  KnowledgeItem, DecisionRecord, DocSection, SearchResult,
  ContextBuildOptions, ContextResult, VersionSnapshot,
  KnowledgeGraphNode, KnowledgeGraphEdge, ProjectInfo, KnowledgeType, KnowledgeEvent,
} from "./types.js";

export class KnowledgeEngine {
  public projectMemory: ProjectMemory;
  public graph: KnowledgeGraphEngine;
  public decisions: DecisionMemory;
  public docs: DocumentationEngine;
  public versions: VersionKnowledge;
  public contextBuilder: ContextBuilder;
  public learning: LearningEngine;
  public search: SemanticSearch;
  public plugins: PluginManager;

  constructor(public store: KnowledgeStore) {
    this.plugins = new PluginManager();
    this.search = new SemanticSearch();
    this.projectMemory = new ProjectMemory(store);
    this.graph = new KnowledgeGraphEngine(store);
    this.decisions = new DecisionMemory(store);
    this.docs = new DocumentationEngine(store);
    this.versions = new VersionKnowledge(store);
    this.contextBuilder = new ContextBuilder(store);
    this.learning = new LearningEngine(store);
  }

  async initProject(projectId: string): Promise<void> {
    await this.store.init(projectId);
  }

  async destroyProject(projectId: string): Promise<void> {
    await this.store.destroy(projectId);
  }

  async searchAll(projectId: string, query: string): Promise<SearchResult[]> {
    const knowledge = await this.projectMemory.listKnowledge(projectId);
    const decisions = await this.decisions.list(projectId);
    const docs = await this.docs.listDocs(projectId);
    return this.search.search(query, knowledge, decisions, docs);
  }

  async buildContext(projectId: string, options?: ContextBuildOptions): Promise<ContextResult> {
    return this.contextBuilder.buildContext(projectId, options);
  }

  async getProject(projectId: string): Promise<ProjectInfo | null> {
    return this.projectMemory.getProject(projectId);
  }

  subscribe(handler: (event: KnowledgeEvent) => void): () => void {
    return this.store.subscribe(handler);
  }

  async flush(): Promise<void> {
    await this.store.flush();
  }
}
