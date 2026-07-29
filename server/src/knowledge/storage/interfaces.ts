import type {
  KnowledgeItem,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  DecisionRecord,
  DocSection,
  ProjectInfo,
  VersionSnapshot,
  KnowledgeEvent,
} from "../core/types.js";

export interface KnowledgeStore {
  init(projectId: string): Promise<void>;
  destroy(projectId: string): Promise<void>;

  // Project info
  getProject(projectId: string): Promise<ProjectInfo | null>;
  saveProject(info: ProjectInfo): Promise<void>;

  // Knowledge items
  getKnowledge(projectId: string, key: string): Promise<KnowledgeItem | null>;
  listKnowledge(projectId: string, type?: string): Promise<KnowledgeItem[]>;
  saveKnowledge(item: KnowledgeItem): Promise<void>;
  deleteKnowledge(projectId: string, key: string): Promise<void>;
  searchKnowledge(projectId: string, query: string): Promise<KnowledgeItem[]>;

  // Graph
  getNode(projectId: string, nodeId: string): Promise<KnowledgeGraphNode | null>;
  listNodes(projectId: string): Promise<KnowledgeGraphNode[]>;
  saveNode(node: KnowledgeGraphNode): Promise<void>;
  deleteNode(projectId: string, nodeId: string): Promise<void>;
  listEdges(projectId: string): Promise<KnowledgeGraphEdge[]>;
  saveEdge(edge: KnowledgeGraphEdge): Promise<void>;
  deleteEdge(projectId: string, edgeId: string): Promise<void>;
  getEdgesForNode(projectId: string, nodeId: string): Promise<KnowledgeGraphEdge[]>;

  // Decisions
  getDecision(projectId: string, id: string): Promise<DecisionRecord | null>;
  listDecisions(projectId: string): Promise<DecisionRecord[]>;
  saveDecision(decision: DecisionRecord): Promise<void>;
  deleteDecision(projectId: string, id: string): Promise<void>;

  // Docs
  getDoc(projectId: string, id: string): Promise<DocSection | null>;
  listDocs(projectId: string, category?: string): Promise<DocSection[]>;
  saveDoc(doc: DocSection): Promise<void>;
  deleteDoc(projectId: string, id: string): Promise<void>;

  // Versions
  getVersion(projectId: string, id: string): Promise<VersionSnapshot | null>;
  listVersions(projectId: string): Promise<VersionSnapshot[]>;
  saveVersion(snapshot: VersionSnapshot): Promise<void>;

  // Events
  publishEvent(event: KnowledgeEvent): void;
  subscribe(handler: (event: KnowledgeEvent) => void): () => void;

  // Persistence
  flush(): Promise<void>;
}

export interface StoreConfig {
  type: "memory" | "file";
  basePath?: string;
}
